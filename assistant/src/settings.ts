import { apiKeyHint, decryptSecret, encryptSecret } from "./crypto";
import { queryPrivileged } from "./db";
import {
  agentModel,
  ensureUserProvider,
  forgetUserProvider,
  type ByokConfig,
} from "./models";
import { getHarness, CTX } from "./harness";

export type StoredCredentials = {
  user_id: string;
  base_url: string;
  model: string;
  api_key_ciphertext: string;
  api_key_hint: string;
  updated_at: string;
};

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const notConfigured = () =>
  new HttpError(
    409,
    "not_configured",
    "AI provider is not configured. Add an API key in Settings → AI Assistant.",
  );

export async function getStoredCredentials(
  userId: string,
): Promise<StoredCredentials | null> {
  const rows = await queryPrivileged<StoredCredentials>(
    "select user_id, base_url, model, api_key_ciphertext, api_key_hint, updated_at from public.assistant_credentials where user_id = $1",
    [userId],
  );
  return rows[0] ?? null;
}

export async function publicSettings(userId: string) {
  const stored = await getStoredCredentials(userId);
  if (!stored) return { configured: false };
  return {
    configured: true,
    baseUrl: stored.base_url,
    model: stored.model,
    apiKeyHint: stored.api_key_hint,
    updatedAt: stored.updated_at,
  };
}

function normalizeBaseUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "bad_request", "baseUrl is required");
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new HttpError(400, "bad_request", "baseUrl is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, "bad_request", "baseUrl must use http(s)");
  }
  return url.toString().replace(/\/+$/, "");
}

function normalizeModel(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
    throw new HttpError(400, "bad_request", "model is required");
  }
  return value.trim();
}

export async function saveSettings(
  userId: string,
  input: { baseUrl?: unknown; model?: unknown; apiKey?: unknown },
) {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const model = normalizeModel(input.model);
  const existing = await getStoredCredentials(userId);

  let apiKey: string;
  if (typeof input.apiKey === "string" && input.apiKey.trim()) {
    apiKey = input.apiKey.trim();
  } else if (existing) {
    apiKey = decryptSecret(existing.api_key_ciphertext);
  } else {
    throw new HttpError(
      400,
      "bad_request",
      "apiKey is required the first time",
    );
  }

  const ciphertext = encryptSecret(apiKey);
  const hint = apiKeyHint(apiKey);
  await queryPrivileged(
    `insert into public.assistant_credentials
       (user_id, base_url, model, api_key_ciphertext, api_key_hint, updated_at)
     values ($1, $2, $3, $4, $5, now())
     on conflict (user_id) do update
       set base_url = excluded.base_url,
           model = excluded.model,
           api_key_ciphertext = excluded.api_key_ciphertext,
           api_key_hint = excluded.api_key_hint,
           updated_at = now()`,
    [userId, baseUrl, model, ciphertext, hint],
  );

  await refreshUserProvider({ userId, baseUrl, model, apiKey });
  return { ok: true, configured: true, apiKeyHint: hint };
}

/** Register the user's provider and repoint their existing conversations at it. */
export async function refreshUserProvider(
  cfg: ByokConfig & { userId: string },
) {
  ensureUserProvider(cfg.userId, cfg);
  const harness = await getHarness();
  const threads = await queryPrivileged<{ durable_conversation_id: string }>(
    "select durable_conversation_id from public.assistant_threads where user_id = $1",
    [cfg.userId],
  );
  const agentModelRef = agentModel(cfg.userId, cfg.model);
  for (const thread of threads) {
    const conversation = await harness.conversation(
      thread.durable_conversation_id as any,
      CTX,
    );
    if (!conversation) continue;
    try {
      const agent = await conversation.agent(CTX);
      if (
        agent.model?.provider !== agentModelRef.provider ||
        agent.model?.modelId !== agentModelRef.modelId
      ) {
        await conversation.configure({ model: agentModelRef }, CTX);
      }
    } catch (error) {
      console.warn(
        "[settings] could not reconfigure conversation",
        thread.durable_conversation_id,
        error,
      );
    }
  }
}

/**
 * Register the provider from stored credentials and return them.
 * Throws 409 `not_configured` when the user has not saved a key yet.
 */
export async function requireByok(userId: string): Promise<ByokConfig> {
  const stored = await getStoredCredentials(userId);
  if (!stored) throw notConfigured();
  const apiKey = decryptSecret(stored.api_key_ciphertext);
  ensureUserProvider(userId, {
    baseUrl: stored.base_url,
    model: stored.model,
    apiKey,
  });
  return { baseUrl: stored.base_url, model: stored.model, apiKey };
}

export async function deleteSettings(userId: string): Promise<void> {
  await queryPrivileged(
    "delete from public.assistant_credentials where user_id = $1",
    [userId],
  );
  forgetUserProvider(userId);
}

/** Cheap provider check used by the Settings "Test" button. */
export async function testProvider(
  userId: string,
  override?: Partial<ByokConfig>,
) {
  const stored = await getStoredCredentials(userId);
  if (!stored && !override?.apiKey) throw notConfigured();
  const cfg: ByokConfig = {
    baseUrl: override?.baseUrl ?? stored!.base_url,
    model: override?.model ?? stored!.model,
    apiKey: override?.apiKey ?? decryptSecret(stored!.api_key_ciphertext),
  };
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const started = Date.now();

  const attempt = async (url: string, init: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.text();
    return { response, body };
  };

  try {
    // Most OpenAI-compatible servers expose /models; fall back to a minimal
    // chat completion for endpoints that do not.
    const modelsResponse = await attempt(`${base}/models`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
    });
    if (modelsResponse.response.ok) {
      return {
        ok: true,
        latencyMs: Date.now() - started,
        model: cfg.model,
        checked: "models",
      };
    }
    const chatResponse = await attempt(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
    });
    if (chatResponse.response.ok) {
      return {
        ok: true,
        latencyMs: Date.now() - started,
        model: cfg.model,
        checked: "chat",
      };
    }
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: `Provider rejected the request (HTTP ${chatResponse.response.status}): ${chatResponse.body.slice(0, 300)}`,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: (error as Error).message,
    };
  }
}
