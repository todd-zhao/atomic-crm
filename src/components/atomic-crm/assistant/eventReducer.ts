/**
 * Pure reducer for the assistant event stream.
 *
 * The assistant service forwards `pi-durable` `watchEvents` payloads as SSE
 * frames:
 *   - `snapshot` — full state, sent on every (re)connection;
 *   - `events`   — batches of `AgentEvent` (streaming deltas, tool execution,
 *                  run lifecycle, usage, retries...);
 *   - `ping`     — keep-alive, ignored;
 *   - `end`      — the stream ended (`stopped | ended | failed`).
 *
 * Everything here is a pure function so it can be tested without a browser
 * network, React, or the backend. The panel only consumes `AssistantState`.
 */
import type { SseFrame } from "./sseParse";
import type {
  AgentEvent,
  AssistantAction,
  AssistantContentBlock,
  AssistantEntry,
  AssistantSnapshot,
  AssistantState,
  AssistantUsage,
  PendingApproval,
  ToolCard,
} from "./types";

export const initialAssistantState: AssistantState = {
  entries: [],
  streaming: {},
  tools: {},
  toolOrder: [],
  approvals: [],
  busy: false,
};

/* -------------------------------------------------------------------------- */
/* Narrowing helpers                                                          */
/* -------------------------------------------------------------------------- */

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/**
 * pi-durable entry ids are numbers; other payloads use strings. Normalise both
 * to a string so entries can be keyed and compared consistently.
 */
const asId = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : undefined;

const safeJson = (raw: string): unknown => {
  if (!raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/* -------------------------------------------------------------------------- */
/* Entry inspection (shared with the renderer)                                */
/* -------------------------------------------------------------------------- */

/** All content blocks of an assistant entry (`entry.model[i].content`). */
export const getEntryContent = (
  entry: AssistantEntry,
): AssistantContentBlock[] => {
  const blocks: AssistantContentBlock[] = [];
  if (!Array.isArray(entry.model)) return blocks;
  for (const model of entry.model) {
    const content = asRecord(model)?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      const record = asRecord(block);
      if (record) blocks.push(record);
    }
  }
  return blocks;
};

/** The authoritative text of an entry (assistant text blocks or `data.text`). */
export const getEntryText = (entry: AssistantEntry): string => {
  const modelText = getEntryContent(entry)
    .filter((block) => block.type === "text" || block.type === undefined)
    .map((block) => asString(block.text) ?? "")
    .join("");
  if (modelText) return modelText;

  // pi.user entries store their content as a plain string in `model[i].content`.
  if (Array.isArray(entry.model)) {
    const stringText = entry.model
      .map((model) => asRecord(model)?.content)
      .filter((content): content is string => typeof content === "string")
      .join("");
    if (stringText) return stringText;
  }

  if (typeof entry.data === "string") return entry.data;
  const data = asRecord(entry.data);
  if (!data) return "";
  const direct = asString(data.text);
  if (direct) return direct;
  if (typeof data.content === "string") return data.content;
  if (Array.isArray(data.content)) {
    return data.content
      .map((block) => {
        const record = asRecord(block);
        return record ? (asString(record.text) ?? "") : "";
      })
      .join("");
  }
  return "";
};

/** Concatenated thinking blocks of an assistant entry. */
export const getEntryThinking = (entry: AssistantEntry): string =>
  getEntryContent(entry)
    .filter((block) => block.type === "thinking")
    .map((block) => asString(block.text) ?? asString(block.thinking) ?? "")
    .join("");

export type EntryToolCall = {
  id: string;
  name: string;
  args?: unknown;
};

/** Tool calls requested inside an assistant entry. */
export const getEntryToolCalls = (entry: AssistantEntry): EntryToolCall[] => {
  const calls: EntryToolCall[] = [];
  for (const block of getEntryContent(entry)) {
    const type = asString(block.type);
    if (type !== "toolCall" && type !== "tool-call" && type !== "tool_call") {
      continue;
    }
    const id =
      asString(block.id) ??
      asString(block.toolCallId) ??
      asString(block.tool_call_id);
    const name = asString(block.name) ?? asString(block.toolName);
    if (!id || !name) continue;
    calls.push({
      id,
      name,
      args: block.arguments ?? block.input ?? block.args,
    });
  }
  return calls;
};

export type EntryToolResult = {
  id?: string;
  name?: string;
  output?: unknown;
  isError: boolean;
  details?: Record<string, unknown>;
};

/** Tool result carried by a `pi.tool-result` entry. */
export const getEntryToolResult = (
  entry: AssistantEntry,
): EntryToolResult | null => {
  // pi-durable stores the tool result message (content, details, isError,
  // toolCallId, toolName) in `entry.model[0]`; `entry.data` only holds the
  // diagnostics list.
  if (Array.isArray(entry.model)) {
    for (const message of entry.model) {
      const record = asRecord(message);
      if (!record || record.role !== "toolResult") continue;
      return {
        id: asId(record.toolCallId),
        name: asString(record.toolName),
        output: record.content ?? record.output,
        isError: Boolean(record.isError),
        details: asRecord(record.details) ?? undefined,
      };
    }
  }

  if (typeof entry.data === "string") return null;
  const data = asRecord(entry.data);
  if (!data) return null;
  const name = asString(data.toolName) ?? asString(data.name);
  const id = asString(data.toolCallId) ?? asString(data.id);
  if (entry.kind !== "pi.tool-result" && name === undefined) return null;
  return {
    id,
    name,
    output: data.output ?? data.content ?? data.result,
    isError: Boolean(data.isError ?? data.is_error),
    details: asRecord(data.details) ?? undefined,
  };
};

/** Renders any tool output (string, text blocks, object...) as plain text. */
export const outputToText = (output: unknown): string => {
  if (output === null || output === undefined) return "";
  if (typeof output === "string") return output;
  if (typeof output === "number" || typeof output === "boolean") {
    return String(output);
  }
  if (Array.isArray(output)) {
    return output
      .map((item) => {
        const record = asRecord(item);
        if (!record) return outputToText(item);
        const text = asString(record.text);
        if (text) return text;
        if (record.content !== undefined) return outputToText(record.content);
        return JSON.stringify(record, null, 2);
      })
      .filter(Boolean)
      .join("\n");
  }
  const record = asRecord(output);
  if (record) {
    const text = asString(record.text);
    if (text) return text;
    if (record.content !== undefined) return outputToText(record.content);
    return JSON.stringify(record, null, 2);
  }
  return String(output);
};

/** Extracts a `pendingApproval` from a tool result `details` payload. */
export const getPendingApproval = (
  details: Record<string, unknown> | undefined,
): PendingApproval | null => {
  if (!details) return null;
  return toApproval(details.pendingApproval ?? details.pending_approval);
};

const toApproval = (value: unknown): PendingApproval | null => {
  const record = asRecord(value);
  if (!record) return null;
  const hash = asString(record.hash) ?? asString(record.argsHash);
  if (!hash) return null;
  return {
    hash,
    toolName:
      asString(record.toolName) ?? asString(record.name) ?? "unknown_tool",
    args: record.args ?? record.arguments,
    summary: asString(record.summary),
    createdAt: asString(record.createdAt) ?? asId(record.createdAt),
  };
};

const normalizeUsage = (value: unknown): AssistantUsage | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;
  const totalTokens =
    asNumber(record.totalTokens) ??
    asNumber(record.total_tokens) ??
    asNumber(record.tokens);
  const totalCost =
    asNumber(record.totalCost) ??
    asNumber(record.total_cost) ??
    asNumber(record.cost);
  if (totalTokens === undefined && totalCost === undefined) return undefined;
  return { totalTokens, totalCost };
};

const isEntry = (value: unknown): value is AssistantEntry => {
  const record = asRecord(value);
  return Boolean(record && asId(record.id) && asString(record.kind));
};

const toEntry = (value: unknown): AssistantEntry | null =>
  isEntry(value) ? { ...value, id: asId(value.id) as string } : null;

const upsertApproval = (
  approvals: PendingApproval[],
  approval: PendingApproval,
): PendingApproval[] => {
  const index = approvals.findIndex((item) => item.hash === approval.hash);
  if (index === -1) return [...approvals, approval];
  return approvals.map((item, i) => (i === index ? approval : item));
};

/* -------------------------------------------------------------------------- */
/* Snapshot                                                                   */
/* -------------------------------------------------------------------------- */

/** Rebuilds the tool cards from the entries of a snapshot. */
const toolsFromEntries = (entries: AssistantEntry[]): ToolCard[] => {
  const tools: ToolCard[] = [];
  const byId = new Map<string, ToolCard>();
  const upsert = (card: ToolCard) => {
    const existing = byId.get(card.id);
    if (existing) {
      Object.assign(existing, card);
      return;
    }
    byId.set(card.id, card);
    tools.push(card);
  };
  for (const entry of entries) {
    for (const call of getEntryToolCalls(entry)) {
      upsert({
        id: call.id,
        name: call.name,
        args: call.args,
        status: "running",
      });
    }
    const result = getEntryToolResult(entry);
    if (!result) continue;
    const id = result.id ?? `result-${entry.id}`;
    const pendingApproval = getPendingApproval(result.details);
    const existing = byId.get(id);
    upsert({
      id,
      name: result.name ?? existing?.name ?? "tool",
      args: existing?.args,
      status: pendingApproval
        ? "pending_approval"
        : result.isError
          ? "error"
          : "done",
      output: outputToText(result.output),
      error: result.isError ? outputToText(result.output) : undefined,
      pendingApproval: pendingApproval ?? undefined,
    });
  }
  return tools;
};

const applySnapshot = (
  state: AssistantState,
  snapshot: AssistantSnapshot,
): AssistantState => {
  const entries = Array.isArray(snapshot.entries)
    ? snapshot.entries
        .filter(isEntry)
        .map((entry) => ({ ...entry, id: asId(entry.id) as string }))
    : state.entries;
  const toolCards = toolsFromEntries(entries);
  const tools: Record<string, ToolCard> = {};
  for (const tool of toolCards) tools[tool.id] = tool;

  const streaming: Record<string, string> = {};
  const generation = asRecord(snapshot.generation);
  if (generation) {
    const text =
      asString(generation.text) ?? asString(generation.content) ?? "";
    if (text) {
      const entryId =
        asString(generation.entryId) ??
        asString(generation.messageId) ??
        asString(generation.id) ??
        "current";
      streaming[entryId] = text;
    }
  }

  const agent = asRecord(snapshot.agent);
  const busy = agent
    ? Boolean(agent.busy ?? agent.status === "running")
    : state.busy;

  let approvals = state.approvals;
  for (const tool of toolCards) {
    if (tool.pendingApproval)
      approvals = upsertApproval(approvals, tool.pendingApproval);
  }

  return {
    ...state,
    entries,
    streaming,
    tools,
    toolOrder: toolCards.map((tool) => tool.id),
    approvals,
    busy,
    usage: normalizeUsage(snapshot.usage) ?? state.usage,
    retry: undefined,
    error: undefined,
    ended: undefined,
  };
};

/* -------------------------------------------------------------------------- */
/* Agent events                                                               */
/* -------------------------------------------------------------------------- */

const entryIdOf = (event: AgentEvent): string | undefined =>
  asId(asRecord(event.entry)?.id) ??
  asId(event.entryId) ??
  asId(event.messageId) ??
  asId(event.message_id) ??
  asId(event.id);

type ToolEventInfo = {
  id?: string;
  name?: string;
  args?: unknown;
  output?: unknown;
  isError?: boolean;
  error?: string;
  details?: Record<string, unknown>;
};

const toolEventInfo = (event: AgentEvent): ToolEventInfo => {
  const toolCall =
    asRecord(event.toolCall) ??
    asRecord(event.tool_call) ??
    asRecord(event.call) ??
    null;
  const errorValue = event.error;
  const error =
    asString(errorValue) ??
    asString(asRecord(errorValue)?.message) ??
    asString(event.errorMessage);
  return {
    id:
      asString(event.toolCallId) ??
      asString(event.tool_call_id) ??
      asString(toolCall?.id) ??
      asString(event.id),
    name:
      asString(event.toolName) ??
      asString(event.tool_name) ??
      asString(toolCall?.name) ??
      asString(toolCall?.toolName),
    args:
      event.args ?? event.arguments ?? toolCall?.arguments ?? toolCall?.args,
    output: event.output ?? event.result ?? event.partialOutput,
    isError: Boolean(event.isError ?? event.is_error),
    error,
    details: asRecord(event.details) ?? undefined,
  };
};

const applyToolStart = (
  state: AssistantState,
  event: AgentEvent,
): AssistantState => {
  const info = toolEventInfo(event);
  if (!info.id) return state;
  const existing = state.tools[info.id];
  const card: ToolCard = {
    id: info.id,
    name: info.name ?? existing?.name ?? "tool",
    args: info.args ?? existing?.args,
    status: "running",
    output: existing?.output,
  };
  return {
    ...state,
    busy: true,
    tools: { ...state.tools, [info.id]: card },
    toolOrder: existing ? state.toolOrder : [...state.toolOrder, info.id],
  };
};

const applyToolUpdate = (
  state: AssistantState,
  event: AgentEvent,
): AssistantState => {
  const info = toolEventInfo(event);
  if (!info.id) return state;
  const existing = state.tools[info.id];
  if (!existing) {
    return applyToolStart(state, event);
  }
  const chunk =
    asString(event.partialOutput) ??
    asString(event.delta) ??
    asString(event.chunk);
  const output =
    chunk !== undefined
      ? `${existing.output ?? ""}${chunk}`
      : info.output !== undefined
        ? outputToText(info.output)
        : existing.output;
  return {
    ...state,
    tools: {
      ...state.tools,
      [info.id]: { ...existing, output, status: "running" },
    },
  };
};

const applyToolEnd = (
  state: AssistantState,
  event: AgentEvent,
): AssistantState => {
  const info = toolEventInfo(event);
  if (!info.id) return state;
  const existing = state.tools[info.id];
  const pendingApproval = getPendingApproval(info.details);
  const output = outputToText(info.output);
  const card: ToolCard = {
    id: info.id,
    name: info.name ?? existing?.name ?? "tool",
    args: info.args ?? existing?.args,
    status: pendingApproval
      ? "pending_approval"
      : info.isError || info.error
        ? "error"
        : "done",
    output: output || existing?.output,
    error: info.isError || info.error ? (info.error ?? output) : undefined,
    pendingApproval: pendingApproval ?? undefined,
  };
  const approvals = pendingApproval
    ? upsertApproval(state.approvals, pendingApproval)
    : state.approvals;
  return {
    ...state,
    tools: { ...state.tools, [info.id]: card },
    toolOrder: existing ? state.toolOrder : [...state.toolOrder, info.id],
    approvals,
  };
};

const appendEntry = (
  state: AssistantState,
  entry: AssistantEntry,
): AssistantState => {
  const index = state.entries.findIndex((item) => item.id === entry.id);
  const entries =
    index === -1
      ? [...state.entries, entry]
      : state.entries.map((item, i) =>
          i === index ? { ...item, ...entry } : item,
        );

  let next: AssistantState = { ...state, entries };

  // A tool-result entry carries the authoritative tool output and possibly a
  // pending approval (see API.md "审批协议").
  const result = getEntryToolResult(entry);
  if (result) {
    const id = result.id ?? `result-${entry.id}`;
    const existing = state.tools[id];
    const pendingApproval = getPendingApproval(result.details);
    const output = outputToText(result.output);
    next = {
      ...next,
      tools: {
        ...next.tools,
        [id]: {
          id,
          name: result.name ?? existing?.name ?? "tool",
          args: existing?.args,
          status: pendingApproval
            ? "pending_approval"
            : result.isError
              ? "error"
              : existing?.status === "running"
                ? "done"
                : (existing?.status ?? "done"),
          output: output || existing?.output,
          error: result.isError ? output || existing?.error : existing?.error,
          pendingApproval: pendingApproval ?? existing?.pendingApproval,
        },
      },
      toolOrder: existing ? next.toolOrder : [...next.toolOrder, id],
    };
    if (pendingApproval) {
      next = {
        ...next,
        approvals: upsertApproval(next.approvals, pendingApproval),
      };
    }
  }

  return next;
};

const applyAgentEvent = (
  state: AssistantState,
  event: AgentEvent,
): AssistantState => {
  switch (event.type) {
    case "run_start":
      return { ...state, busy: true, error: undefined, ended: undefined };
    case "run_end":
    case "run_finished": {
      const kind = asString(event.kind) ?? asString(event.status);
      return {
        ...state,
        busy: false,
        retry: undefined,
        ended: kind === "stopped" || kind === "failed" ? kind : state.ended,
      };
    }
    case "turn_start":
    case "turn_end":
    case "inbox_update":
    case "deferred_poll":
      return state;
    case "message_start": {
      const entry = toEntry(event.entry);
      const next = { ...state, busy: true };
      return entry ? appendEntry(next, entry) : next;
    }
    case "message_update": {
      const changes = Array.isArray(event.changes) ? event.changes : [];
      const key = entryIdOf(event) ?? "current";
      let streaming = state.streaming;
      for (const change of changes) {
        const record = asRecord(change);
        if (!record) continue;
        const type = asString(record.type);
        if (type !== "text_delta" && type !== "text") continue;
        const delta = asString(record.delta) ?? asString(record.text);
        if (!delta) continue;
        streaming = {
          ...streaming,
          [key]: (streaming[key] ?? "") + delta,
        };
      }
      return { ...state, streaming, busy: true };
    }
    case "message_end": {
      const entry = toEntry(event.entry);
      const entryId = entry?.id ?? entryIdOf(event);
      const streaming = { ...state.streaming };
      if (entryId) delete streaming[entryId];
      delete streaming.current;
      const next = entry ? appendEntry(state, entry) : state;
      return { ...next, streaming, busy: true };
    }
    case "entry_appended": {
      const entry = toEntry(event.entry);
      return entry ? appendEntry(state, entry) : state;
    }
    case "tool_execution_start":
      return applyToolStart(state, event);
    case "tool_execution_update":
      return applyToolUpdate(state, event);
    case "tool_execution_end":
      return applyToolEnd(state, event);
    case "auto_retry_start":
      return {
        ...state,
        retry: {
          attempt: asNumber(event.attempt) ?? 1,
          message: asString(event.errorMessage) ?? asString(event.message),
        },
      };
    case "auto_retry_end":
      return { ...state, retry: undefined };
    case "usage_changed":
      return {
        ...state,
        usage: normalizeUsage(event.usage ?? event) ?? state.usage,
      };
    case "task_failed":
    case "run_failed": {
      const errorValue = event.error;
      const error =
        asString(errorValue) ??
        asString(asRecord(errorValue)?.message) ??
        asString(event.message) ??
        "task_failed";
      return { ...state, error, busy: false };
    }
    default:
      return state;
  }
};

export const applyAgentEvents = (
  state: AssistantState,
  events: AgentEvent[],
): AssistantState => {
  let next = state;
  for (const event of events) {
    const record = asRecord(event);
    if (!record) continue;
    next = applyAgentEvent(next, event);
  }
  return next;
};

/* -------------------------------------------------------------------------- */
/* SSE frames                                                                 */
/* -------------------------------------------------------------------------- */

/** Applies one parsed SSE frame to the state. Malformed payloads are ignored. */
export const applySseFrame = (
  state: AssistantState,
  frame: SseFrame,
): AssistantState => {
  switch (frame.event) {
    case "snapshot": {
      const parsed = asRecord(safeJson(frame.data));
      if (!parsed) return state;
      return applySnapshot(state, parsed as AssistantSnapshot);
    }
    case "events": {
      const parsed = safeJson(frame.data);
      if (Array.isArray(parsed)) {
        return applyAgentEvents(state, parsed as AgentEvent[]);
      }
      const nested = asRecord(parsed)?.events;
      if (Array.isArray(nested)) {
        return applyAgentEvents(state, nested as AgentEvent[]);
      }
      return state;
    }
    case "end": {
      const parsed = asRecord(safeJson(frame.data));
      const kind = asString(parsed?.kind);
      return {
        ...state,
        busy: false,
        ended: kind === "stopped" || kind === "failed" ? kind : "ended",
      };
    }
    case "ping":
    default:
      return state;
  }
};

/** Clears the pending approval flag of a tool card once the user answered. */
const resolveToolApproval = (
  tools: Record<string, ToolCard>,
  hash: string,
  approved: boolean,
): Record<string, ToolCard> => {
  const next = { ...tools };
  for (const [id, tool] of Object.entries(tools)) {
    if (tool.pendingApproval?.hash !== hash) continue;
    next[id] = {
      ...tool,
      pendingApproval: undefined,
      rejected: !approved,
      status: approved ? "running" : "done",
      error: undefined,
    };
  }
  return next;
};

export const assistantReducer = (
  state: AssistantState,
  action: AssistantAction,
): AssistantState => {
  switch (action.type) {
    case "frame":
      return applySseFrame(state, action.frame);
    case "snapshot":
      return applySnapshot(state, action.snapshot);
    case "events":
      return applyAgentEvents(state, action.events);
    case "end": {
      const kind = action.kind;
      return {
        ...state,
        busy: false,
        ended: kind === "stopped" || kind === "failed" ? kind : "ended",
      };
    }
    case "approvals":
      return { ...state, approvals: action.pending };
    case "approval_resolved":
      return {
        ...state,
        approvals: state.approvals.filter(
          (approval) => approval.hash !== action.hash,
        ),
        tools: resolveToolApproval(state.tools, action.hash, action.approved),
      };
    case "busy":
      return { ...state, busy: action.busy };
    case "usage":
      return { ...state, usage: action.usage ?? state.usage };
    case "error":
      return { ...state, error: action.error };
    case "reset":
      return { ...initialAssistantState };
    default:
      return state;
  }
};
