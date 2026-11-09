import { describe, expect, it } from "vitest";

import {
  assistantReducer,
  getEntryText,
  getEntryToolCalls,
  initialAssistantState,
  outputToText,
} from "./eventReducer";
import type { AssistantState, AssistantEntry } from "./types";

const assistantEntry = (id: string, text: string): AssistantEntry => ({
  id,
  kind: "pi.assistant",
  model: [{ content: [{ type: "text", text }] }],
});

describe("getEntryText", () => {
  it("reads text blocks from the model payload", () => {
    expect(getEntryText(assistantEntry("a1", "Hello"))).toBe("Hello");
  });

  it("falls back to data.text", () => {
    expect(
      getEntryText({ id: "u1", kind: "pi.user", data: { text: "Hi" } }),
    ).toBe("Hi");
  });

  it("reads a raw string data payload", () => {
    expect(getEntryText({ id: "u2", kind: "pi.user", data: "Hi" })).toBe("Hi");
  });

  it("reads block content arrays in data", () => {
    expect(
      getEntryText({
        id: "u3",
        kind: "pi.user",
        data: { content: [{ type: "text", text: "Hey" }] },
      }),
    ).toBe("Hey");
  });

  it("returns an empty string for unknown payloads", () => {
    expect(getEntryText({ id: "x", kind: "pi.system" })).toBe("");
  });
});

describe("getEntryToolCalls", () => {
  it("extracts tool calls from content blocks", () => {
    const entry: AssistantEntry = {
      id: "a1",
      kind: "pi.assistant",
      model: [
        {
          content: [
            { type: "text", text: "Let me check" },
            {
              type: "toolCall",
              id: "call-1",
              name: "crm_search_contacts",
              arguments: { query: "Ada" },
            },
          ],
        },
      ],
    };
    expect(getEntryToolCalls(entry)).toEqual([
      {
        id: "call-1",
        name: "crm_search_contacts",
        args: { query: "Ada" },
      },
    ]);
  });

  it("accepts tool-call variants", () => {
    const entry: AssistantEntry = {
      id: "a2",
      kind: "pi.assistant",
      model: [
        {
          content: [
            { type: "tool-call", toolCallId: "c2", toolName: "crm_list_deals" },
          ],
        },
      ],
    };
    expect(getEntryToolCalls(entry)).toEqual([
      { id: "c2", name: "crm_list_deals", args: undefined },
    ]);
  });
});

describe("outputToText", () => {
  it("stringifies content block arrays", () => {
    expect(outputToText([{ type: "text", text: "a" }, { text: "b" }])).toBe(
      "a\nb",
    );
  });

  it("pretty prints objects", () => {
    expect(outputToText({ ok: true })).toBe('{\n  "ok": true\n}');
  });

  it("handles nullish values", () => {
    expect(outputToText(undefined)).toBe("");
    expect(outputToText(null)).toBe("");
  });
});

describe("assistantReducer — snapshot", () => {
  it("replaces state and rebuilds tools from entries", () => {
    const snapshot = {
      entries: [
        {
          id: "a1",
          kind: "pi.assistant",
          model: [
            {
              content: [
                { type: "text", text: "Checking" },
                {
                  type: "toolCall",
                  id: "call-1",
                  name: "crm_get_contact",
                  arguments: { contactId: 9 },
                },
              ],
            },
          ],
        },
        {
          id: "t1",
          kind: "pi.tool-result",
          data: {
            toolCallId: "call-1",
            toolName: "crm_get_contact",
            output: [{ type: "text", text: "Ada Lovelace" }],
          },
        },
      ],
      agent: { busy: true },
      usage: { totalTokens: 120, totalCost: 0.01 },
    };
    const state = assistantReducer(initialAssistantState, {
      type: "snapshot",
      snapshot,
    });
    expect(state.entries).toHaveLength(2);
    expect(state.tools["call-1"]).toMatchObject({
      name: "crm_get_contact",
      status: "done",
      output: "Ada Lovelace",
      args: { contactId: 9 },
    });
    expect(state.toolOrder).toEqual(["call-1"]);
    expect(state.busy).toBe(true);
    expect(state.usage).toEqual({ totalTokens: 120, totalCost: 0.01 });
    expect(getEntryText(state.entries[0])).toBe("Checking");
  });

  it("keeps the generation text as streaming text", () => {
    const state = assistantReducer(initialAssistantState, {
      type: "snapshot",
      snapshot: { entries: [], generation: { text: "partial answer" } },
    });
    expect(state.streaming).toEqual({ current: "partial answer" });
  });

  it("ignores malformed entries", () => {
    const state = assistantReducer(initialAssistantState, {
      type: "snapshot",
      snapshot: { entries: [{ foo: "bar" } as never] },
    });
    expect(state.entries).toEqual([]);
  });
});

describe("assistantReducer — agent events", () => {
  it("tracks busy state on run_start / run_end", () => {
    let state = assistantReducer(initialAssistantState, {
      type: "events",
      events: [{ type: "run_start" }],
    });
    expect(state.busy).toBe(true);
    state = assistantReducer(state, {
      type: "events",
      events: [{ type: "run_end", kind: "stopped" }],
    });
    expect(state.busy).toBe(false);
    expect(state.ended).toBe("stopped");
  });

  it("accumulates streaming deltas and keeps message_end authoritative", () => {
    let state: AssistantState = assistantReducer(initialAssistantState, {
      type: "events",
      events: [
        {
          type: "message_update",
          messageId: "m1",
          changes: [{ type: "text_delta", delta: "Hel" }],
        },
      ],
    });
    state = assistantReducer(state, {
      type: "events",
      events: [
        {
          type: "message_update",
          messageId: "m1",
          changes: [{ type: "text_delta", delta: "lo" }],
        },
      ],
    });
    expect(state.streaming.m1).toBe("Hello");

    state = assistantReducer(state, {
      type: "events",
      events: [
        {
          type: "message_end",
          entry: assistantEntry("m1", "Hello world"),
        },
      ],
    });
    expect(state.streaming.m1).toBeUndefined();
    expect(getEntryText(state.entries[0])).toBe("Hello world");
  });

  it("appends and replaces entries by id", () => {
    let state = assistantReducer(initialAssistantState, {
      type: "events",
      events: [
        {
          type: "entry_appended",
          entry: assistantEntry("a1", "first"),
        },
      ],
    });
    state = assistantReducer(state, {
      type: "events",
      events: [
        {
          type: "entry_appended",
          entry: assistantEntry("a1", "second"),
        },
      ],
    });
    expect(state.entries).toHaveLength(1);
    expect(getEntryText(state.entries[0])).toBe("second");
  });

  it("tracks tool execution start / update / end", () => {
    let state = assistantReducer(initialAssistantState, {
      type: "events",
      events: [
        {
          type: "tool_execution_start",
          toolCallId: "call-1",
          toolName: "crm_search_contacts",
          args: { query: "Ada" },
        },
      ],
    });
    expect(state.tools["call-1"]).toMatchObject({
      status: "running",
      name: "crm_search_contacts",
      args: { query: "Ada" },
    });
    expect(state.toolOrder).toEqual(["call-1"]);

    state = assistantReducer(state, {
      type: "events",
      events: [
        {
          type: "tool_execution_update",
          toolCallId: "call-1",
          partialOutput: "partial ",
        },
      ],
    });
    expect(state.tools["call-1"].output).toBe("partial ");

    state = assistantReducer(state, {
      type: "events",
      events: [
        {
          type: "tool_execution_end",
          toolCallId: "call-1",
          output: [{ type: "text", text: "done" }],
        },
      ],
    });
    expect(state.tools["call-1"]).toMatchObject({
      status: "done",
      output: "done",
    });
  });

  it("marks failing tools as errors", () => {
    const state = assistantReducer(initialAssistantState, {
      type: "events",
      events: [
        {
          type: "tool_execution_start",
          toolCallId: "call-1",
          toolName: "crm_get_contact",
        },
        {
          type: "tool_execution_end",
          toolCallId: "call-1",
          isError: true,
          error: "boom",
        },
      ],
    });
    expect(state.tools["call-1"]).toMatchObject({
      status: "error",
      error: "boom",
    });
  });

  it("surfaces pending approvals from tool details", () => {
    const state = assistantReducer(initialAssistantState, {
      type: "events",
      events: [
        {
          type: "tool_execution_start",
          toolCallId: "call-1",
          toolName: "crm_create_task",
        },
        {
          type: "tool_execution_end",
          toolCallId: "call-1",
          output: "NOT EXECUTED: awaiting user approval",
          details: {
            pendingApproval: {
              hash: "abc123",
              toolName: "crm_create_task",
              args: { contactId: 9 },
              summary: "Create a follow-up task",
            },
          },
        },
      ],
    });
    expect(state.tools["call-1"].status).toBe("pending_approval");
    expect(state.tools["call-1"].pendingApproval?.hash).toBe("abc123");
    expect(state.approvals).toEqual([
      {
        hash: "abc123",
        toolName: "crm_create_task",
        args: { contactId: 9 },
        summary: "Create a follow-up task",
        createdAt: undefined,
      },
    ]);
  });

  it("picks up approvals from tool-result entries", () => {
    const state = assistantReducer(initialAssistantState, {
      type: "events",
      events: [
        {
          type: "entry_appended",
          entry: {
            id: "t1",
            kind: "pi.tool-result",
            data: {
              toolCallId: "call-1",
              toolName: "crm_add_contact_note",
              output: "approval required",
              details: {
                pendingApproval: {
                  hash: "h1",
                  toolName: "crm_add_contact_note",
                  summary: "Add a note",
                },
              },
            },
          },
        },
      ],
    });
    expect(state.approvals.map((approval) => approval.hash)).toEqual(["h1"]);
    expect(state.tools["call-1"].status).toBe("pending_approval");
  });

  it("records auto retries and task failures", () => {
    let state = assistantReducer(initialAssistantState, {
      type: "events",
      events: [
        { type: "auto_retry_start", attempt: 2, errorMessage: "rate limited" },
      ],
    });
    expect(state.retry).toEqual({ attempt: 2, message: "rate limited" });
    state = assistantReducer(state, {
      type: "events",
      events: [{ type: "task_failed", error: { message: "kaput" } }],
    });
    expect(state.error).toBe("kaput");
    expect(state.busy).toBe(false);
  });
});

describe("assistantReducer — frames and actions", () => {
  it("routes frames to the matching payload", () => {
    let state = assistantReducer(initialAssistantState, {
      type: "frame",
      frame: {
        event: "snapshot",
        data: JSON.stringify({ entries: [], agent: { busy: false } }),
      },
    });
    expect(state.busy).toBe(false);

    state = assistantReducer(state, {
      type: "frame",
      frame: {
        event: "events",
        data: JSON.stringify([{ type: "run_start" }]),
      },
    });
    expect(state.busy).toBe(true);

    state = assistantReducer(state, {
      type: "frame",
      frame: { event: "ping", data: '{"t":1}' },
    });
    expect(state.busy).toBe(true);

    state = assistantReducer(state, {
      type: "frame",
      frame: { event: "end", data: '{"kind":"failed"}' },
    });
    expect(state.busy).toBe(false);
    expect(state.ended).toBe("failed");
  });

  it("ignores malformed frame payloads", () => {
    const state = assistantReducer(initialAssistantState, {
      type: "frame",
      frame: { event: "snapshot", data: "{not json" },
    });
    expect(state).toBe(initialAssistantState);
  });

  it("replaces the pending approvals from the approvals endpoint", () => {
    const pending = [
      { hash: "h1", toolName: "crm_create_task", summary: "Create a task" },
    ];
    const state = assistantReducer(initialAssistantState, {
      type: "approvals",
      pending,
    });
    expect(state.approvals).toEqual(pending);
  });

  it("clears a resolved approval and updates its tool card", () => {
    let state = assistantReducer(initialAssistantState, {
      type: "events",
      events: [
        {
          type: "tool_execution_start",
          toolCallId: "call-1",
          toolName: "crm_create_task",
        },
        {
          type: "tool_execution_end",
          toolCallId: "call-1",
          details: {
            pendingApproval: { hash: "h1", toolName: "crm_create_task" },
          },
        },
      ],
    });
    state = assistantReducer(state, {
      type: "approval_resolved",
      hash: "h1",
      approved: false,
    });
    expect(state.approvals).toEqual([]);
    expect(state.tools["call-1"].rejected).toBe(true);
    expect(state.tools["call-1"].pendingApproval).toBeUndefined();
    expect(state.tools["call-1"].status).toBe("done");
  });

  it("resets to the initial state", () => {
    const state = assistantReducer(
      {
        ...initialAssistantState,
        busy: true,
        entries: [assistantEntry("a", "b")],
      },
      { type: "reset" },
    );
    expect(state).toEqual(initialAssistantState);
  });
});
