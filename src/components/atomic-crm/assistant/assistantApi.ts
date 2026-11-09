/**
 * HTTP client for the built-in assistant service.
 *
 * All requests are authenticated with the current Supabase session: the access
 * token is read from the Supabase client on every call (never cached in a
 * module-level variable), and refreshed once on a 401. `EventSource` cannot
 * send an `Authorization` header, so the SSE endpoint is consumed through
 * `fetch` + `ReadableStream` and parsed by `sseParse.ts`.
 */
import { getSupabaseClient } from "../providers/supabase/supabase";
import { createSseParser, type SseFrame } from "./sseParse";
import type {
  AssistantContext,
  AssistantSettings,
  AssistantThread,
  AssistantUsage,
  PendingApproval,
} from "./types";

const DEFAULT_BASE_URL = "/assistant";

/** Margin under which a session is proactively refreshed before a request. */
const TOKEN_EXPIRY_MARGIN_SECONDS = 60;

const getBaseUrl = (): string => {
  const configured = import.meta.env.VITE_ASSISTANT_URL as string | undefined;
  const baseUrl = configured?.trim() || DEFAULT_BASE_URL;
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
};

export type AssistantErrorCode =
  | "unauthorized"
  | "not_configured"
  | "not_found"
  | "forbidden"
  | "busy"
  | "rate_limited"
  | "upstream_error"
  | "bad_request"
  | "unreachable"
  | "unknown";

/** Error raised for any non-2xx assistant response (API.md error shape). */
export class AssistantApiError extends Error {
  readonly code: AssistantErrorCode;
  readonly status: number;

  constructor(message: string, code: AssistantErrorCode, status = 0) {
    super(message);
    this.name = "AssistantApiError";
    this.code = code;
    this.status = status;
  }
}

/** Normalizes any thrown value into a code + human-readable message. */
export const describeAssistantError = (
  error: unknown,
): { code: AssistantErrorCode; message: string } => {
  if (error instanceof AssistantApiError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof TypeError) {
    return { code: "unreachable", message: error.message };
  }
  if (error instanceof Error) {
    return { code: "unknown", message: error.message };
  }
  return { code: "unknown", message: String(error) };
};

const isAssistantErrorCode = (value: unknown): value is AssistantErrorCode =>
  typeof value === "string" &&
  [
    "unauthorized",
    "not_configured",
    "not_found",
    "forbidden",
    "busy",
    "rate_limited",
    "upstream_error",
    "bad_request",
  ].includes(value);

const readError = async (response: Response): Promise<AssistantApiError> => {
  let code: AssistantErrorCode = "unknown";
  let message = `Assistant request failed (HTTP ${response.status})`;
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; message?: unknown };
    };
    if (isAssistantErrorCode(body?.error?.code)) {
      code = body.error.code;
    }
    if (typeof body?.error?.message === "string") {
      message = body.error.message;
    }
  } catch {
    // Non-JSON error body: keep the HTTP status message.
  }
  return new AssistantApiError(message, code, response.status);
};

/** Reads the current Supabase access token, refreshing it when near expiry. */
const getAccessToken = async (forceRefresh = false): Promise<string | null> => {
  const client = getSupabaseClient();
  if (forceRefresh) {
    const { data, error } = await client.auth.refreshSession();
    if (error) return null;
    return data.session?.access_token ?? null;
  }
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return null;
  const expiresAt = session.expires_at;
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt && expiresAt - now <= TOKEN_EXPIRY_MARGIN_SECONDS) {
    const { data, error } = await client.auth.refreshSession();
    if (!error && data.session?.access_token) {
      return data.session.access_token;
    }
  }
  return session.access_token;
};

const requireToken = async (): Promise<string> => {
  const token = await getAccessToken();
  if (!token) {
    throw new AssistantApiError(
      "Not authenticated with Supabase",
      "unauthorized",
      401,
    );
  }
  return token;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  signal?: AbortSignal;
};

const request = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  let token = await requireToken();
  const send = (accessToken: string) => {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    return fetch(`${getBaseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  };

  let response = await send(token);
  if (response.status === 401) {
    const refreshed = await getAccessToken(true);
    if (refreshed) {
      token = refreshed;
      response = await send(token);
    }
  }
  if (!response.ok) {
    throw await readError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
};

export type SaveSettingsInput = {
  baseUrl: string;
  model: string;
  /** Omitted to keep the key already stored server-side. */
  apiKey?: string;
};

export type SaveSettingsResult = {
  ok: boolean;
  configured: boolean;
  apiKeyHint?: string;
};

export type TestSettingsInput = {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
};

export type TestSettingsResult = {
  ok: boolean;
  latencyMs?: number;
  model?: string;
  error?: string;
};

export type ThreadDetail = {
  thread?: AssistantThread;
  busy?: boolean;
  configured?: boolean;
  usage?: AssistantUsage;
};

export type EntryPage = {
  items?: unknown[];
  next?: number | null;
};

export const assistantApi = {
  getSettings: (signal?: AbortSignal) =>
    request<AssistantSettings>("/settings", { signal }),

  saveSettings: (input: SaveSettingsInput) =>
    request<SaveSettingsResult>("/settings", {
      method: "PUT",
      body: input,
    }),

  testSettings: (input: TestSettingsInput) =>
    request<TestSettingsResult>("/settings/test", {
      method: "POST",
      body: input,
    }),

  /** Lists the user's conversations, most recently used first. */
  listThreads: (signal?: AbortSignal) =>
    request<{ threads: AssistantThread[] }>("/threads", { signal }),

  /** Gets (or creates) the current user's default thread. */
  getDefaultThread: (signal?: AbortSignal) =>
    request<{ thread: AssistantThread }>("/threads", {
      method: "POST",
      body: {},
      signal,
    }),

  /** Starts a brand-new conversation (the "New chat" action). */
  createThread: (signal?: AbortSignal) =>
    request<{ thread: AssistantThread }>("/threads", {
      method: "POST",
      body: { new: true },
      signal,
    }),

  getThread: (threadId: string, signal?: AbortSignal) =>
    request<ThreadDetail>(`/threads/${encodeURIComponent(threadId)}`, {
      signal,
    }),

  sendMessage: (threadId: string, input: string, context: AssistantContext) =>
    request<{ submissionId?: string }>(
      `/threads/${encodeURIComponent(threadId)}/messages`,
      { method: "POST", body: { input, context } },
    ),

  abort: (threadId: string) =>
    request<{ ok: boolean }>(`/threads/${encodeURIComponent(threadId)}/abort`, {
      method: "POST",
      body: {},
    }),

  listApprovals: (threadId: string, signal?: AbortSignal) =>
    request<{ pending?: PendingApproval[] }>(
      `/threads/${encodeURIComponent(threadId)}/approvals`,
      { signal },
    ),

  resolveApproval: (threadId: string, hash: string, approve: boolean) =>
    request<{ ok: boolean; executed?: boolean }>(
      `/threads/${encodeURIComponent(threadId)}/approvals`,
      { method: "POST", body: { hash, approve } },
    ),

  listEntries: (threadId: string, before?: number, limit = 30) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before !== undefined) params.set("before", String(before));
    return request<EntryPage>(
      `/threads/${encodeURIComponent(threadId)}/entries?${params.toString()}`,
    );
  },
};

/**
 * Opens the SSE stream for a thread and feeds every frame to `onFrame`.
 *
 * Resolves when the server closes the stream. The caller owns the
 * `AbortSignal`, reconnection policy and reducer dispatch.
 */
export const streamAssistantEvents = async (
  threadId: string,
  onFrame: (frame: SseFrame) => void,
  signal: AbortSignal,
): Promise<void> => {
  let token = await requireToken();
  const connect = (accessToken: string) =>
    fetch(`${getBaseUrl()}/threads/${encodeURIComponent(threadId)}/events`, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    });

  let response = await connect(token);
  if (response.status === 401) {
    const refreshed = await getAccessToken(true);
    if (refreshed) {
      token = refreshed;
      response = await connect(token);
    }
  }
  if (!response.ok) {
    throw await readError(response);
  }
  if (!response.body) {
    throw new AssistantApiError(
      "The assistant service does not support streaming",
      "upstream_error",
      502,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser(onFrame);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
    parser.flush();
  } finally {
    reader.releaseLock();
  }
};
