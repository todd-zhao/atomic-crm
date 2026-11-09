import {
  createModels,
  createProvider,
  type ApiKeyAuth,
  type Model,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { config } from "./config";

/**
 * One global Models collection. BYOK providers are registered per user (the
 * provider id embeds the user id), so a conversation's agent carries the user's
 * endpoint/model while the API key stays server-side.
 */
export const models = createModels();

type CachedConfig = {
  baseUrl: string;
  model: string;
  apiKey: string;
};

const cache = new Map<string, CachedConfig>();

export type ByokConfig = CachedConfig;

export function providerIdForUser(userId: string): string {
  return `byok-${userId}`;
}

/**
 * Register (or refresh) the OpenAI-compatible provider for one user.
 * Returns the provider id to put in the conversation's agent.
 */
export function ensureUserProvider(userId: string, cfg: ByokConfig): string {
  const providerId = providerIdForUser(userId);
  const cached = cache.get(userId);
  if (
    cached &&
    cached.baseUrl === cfg.baseUrl &&
    cached.model === cfg.model &&
    cached.apiKey === cfg.apiKey
  ) {
    return providerId;
  }

  const auth: ApiKeyAuth = {
    name: "BYOK API key",
    resolve: async () => ({ auth: { apiKey: cfg.apiKey }, source: "BYOK" }),
  };

  const model: Model<"openai-completions"> = {
    id: cfg.model,
    name: cfg.model,
    api: "openai-completions",
    provider: providerId,
    baseUrl: cfg.baseUrl,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: config.contextWindow,
    maxTokens: config.maxOutputTokens,
    compat: {
      // Most OpenAI-compatible servers (DeepSeek, 硅基流动, Ollama, vLLM,
      // LM Studio, proxies) do not understand the `developer` role nor
      // `reasoning_effort` for non-reasoning models.
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
  };

  models.setProvider(
    createProvider({
      id: providerId,
      name: "BYOK (OpenAI-compatible)",
      baseUrl: cfg.baseUrl,
      auth: { apiKey: auth },
      models: [model],
      api: openAICompletionsApi(),
    }),
  );
  cache.set(userId, cfg);
  return providerId;
}

export function forgetUserProvider(userId: string): void {
  cache.delete(userId);
}

export function agentModel(userId: string, modelId: string) {
  return { provider: providerIdForUser(userId), modelId };
}
