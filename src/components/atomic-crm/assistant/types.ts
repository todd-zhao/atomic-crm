/**
 * Wire types for the built-in AI assistant.
 *
 * The shape of the entries and events is the one exposed by `pi-durable` 1.4.0
 * through the assistant service (see `assistant/API.md`). It is deliberately
 * loose: the service forwards the runtime payloads as-is and the frontend must
 * keep working when the runtime adds fields. Everything below is therefore
 * typed as `unknown` where possible and narrowed defensively at render time.
 */

import type { SseFrame } from "./sseParse";

/** Page context sent along with every message (see API.md `context.page`). */
export type AssistantPage =
  | "dashboard"
  | "contacts"
  | "contact"
  | "companies"
  | "company"
  | "deals"
  | "deal"
  | "tasks"
  | "settings"
  | "other";

export type AssistantContext = {
  page: AssistantPage;
  entityId: number | null;
};

/** GET /settings — BYOK configuration as seen by the browser (never the key). */
export type AssistantSettings = {
  configured: boolean;
  baseUrl?: string;
  model?: string;
  apiKeyHint?: string;
  updatedAt?: string;
};

export type AssistantThread = {
  id: string;
  title?: string;
  createdAt?: string;
  lastMessageAt?: string | null;
};

export type AssistantUsage = {
  totalTokens?: number;
  totalCost?: number;
};

/** A write operation waiting for the user's approval (GET /approvals). */
export type PendingApproval = {
  hash: string;
  toolName: string;
  args?: unknown;
  summary?: string;
  createdAt?: string;
};

export type ToolCallStatus = "running" | "done" | "error" | "pending_approval";

/** Presentation state for a single tool invocation card. */
export type ToolCard = {
  id: string;
  name: string;
  args?: unknown;
  status: ToolCallStatus;
  output?: string;
  error?: string;
  pendingApproval?: PendingApproval;
  /** Set when the user explicitly rejected the approval request. */
  rejected?: boolean;
};

/** One content block of an assistant model message. */
export type AssistantContentBlock = {
  type?: string;
  text?: string;
  thinking?: string;
  id?: string;
  toolCallId?: string;
  toolName?: string;
  name?: string;
  arguments?: unknown;
  input?: unknown;
  [key: string]: unknown;
};

/** `pi-durable` `EntryRecord` (`{ id, kind, model?, data? }`). */
export type AssistantEntry = {
  id: string;
  kind: string;
  model?: Array<{ content?: AssistantContentBlock[]; [key: string]: unknown }>;
  data?: unknown;
  [key: string]: unknown;
};

/** The `snapshot` SSE frame payload. */
export type AssistantSnapshot = {
  entries?: AssistantEntry[];
  generation?: unknown;
  tools?: unknown;
  inbox?: unknown;
  agent?: unknown;
  usage?: unknown;
};

/** One raw `AgentEvent` forwarded by the service. */
export type AgentEvent = {
  type?: string;
  [key: string]: unknown;
};

/** Everything the panel renders, rebuilt from snapshots and event batches. */
export type AssistantState = {
  entries: AssistantEntry[];
  /** Best-effort streaming text, keyed by entry id (or `current`). */
  streaming: Record<string, string>;
  tools: Record<string, ToolCard>;
  /** Tool ids in the order they were first seen. */
  toolOrder: string[];
  approvals: PendingApproval[];
  busy: boolean;
  usage?: AssistantUsage;
  retry?: { attempt: number; message?: string };
  error?: string;
  ended?: "stopped" | "ended" | "failed";
};

export type AssistantAction =
  | { type: "frame"; frame: SseFrame }
  | { type: "snapshot"; snapshot: AssistantSnapshot }
  | { type: "events"; events: AgentEvent[] }
  | { type: "end"; kind?: string }
  | { type: "approvals"; pending: PendingApproval[] }
  | { type: "approval_resolved"; hash: string; approved: boolean }
  | { type: "busy"; busy: boolean }
  | { type: "usage"; usage?: AssistantUsage }
  | { type: "error"; error?: string }
  | { type: "reset" };
