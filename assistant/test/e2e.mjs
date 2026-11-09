// End-to-end test for the assistant service, using the mock OpenAI-compatible
// provider (no real API key needed).
//
// Usage: node test/e2e.mjs
// Requires: local Supabase running, assistant service on :8787 (npm start),
// CRM seeded with the hotel demo data (contact #1 = 张伟).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ASSISTANT_URL =
  process.env.ASSISTANT_URL ?? "http://127.0.0.1:8787/assistant";
const EMAIL = process.env.CRM_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.CRM_PASSWORD ?? "password123";
const MOCK_PORT = Number(process.env.MOCK_PORT ?? 8899);

function readPublishableKey() {
  const envFile = path.join(repoRoot, ".env.development");
  const text = fs.readFileSync(envFile, "utf8");
  const match = text.match(/^VITE_SB_PUBLISHABLE_KEY=(.+)$/m);
  if (!match)
    throw new Error("VITE_SB_PUBLISHABLE_KEY not found in .env.development");
  return match[1].trim();
}

const publishableKey = readPublishableKey();
let accessToken = "";

function log(...args) {
  console.log("[e2e]", ...args);
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function waitForPort(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${port}/v1/models`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`mock provider did not start on port ${port}`);
}

async function api(method, route, body) {
  const response = await fetch(`${ASSISTANT_URL}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    throw new Error(
      `${method} ${route} -> ${response.status}: ${text.slice(0, 500)}`,
    );
  }
  return json;
}

async function supabaseRpc(route) {
  const response = await fetch(`${SUPABASE_URL}${route}`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
}

async function signIn() {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    },
  );
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(
      `Supabase sign-in failed: ${JSON.stringify(data).slice(0, 400)}`,
    );
  }
  accessToken = data.access_token;
  log("signed in as", EMAIL);
}

// --- SSE client ------------------------------------------------------------
function openEventStream(threadId, onEvent) {
  const controller = new AbortController();
  const promise = (async () => {
    const response = await fetch(
      `${ASSISTANT_URL}/threads/${threadId}/events`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      },
    );
    if (!response.ok || !response.body) {
      throw new Error(`SSE failed: ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const eventLine = raw
          .split("\n")
          .find((line) => line.startsWith("event: "));
        const dataLines = raw
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.slice(6));
        if (!eventLine || !dataLines.length) continue;
        const event = eventLine.slice(7).trim();
        let data;
        try {
          data = JSON.parse(dataLines.join("\n"));
        } catch {
          continue;
        }
        onEvent(event, data);
      }
    }
  })().catch((error) => {
    if (!controller.signal.aborted) log("SSE reader error:", error.message);
  });
  return {
    close() {
      controller.abort();
      return promise;
    },
  };
}

// --- test flow -------------------------------------------------------------
const mock = spawn(
  process.execPath,
  [path.join(here, "mock-openai.mjs"), String(MOCK_PORT)],
  {
    stdio: "ignore",
  },
);

const events = [];
let stream;

try {
  await waitForPort(MOCK_PORT);
  log("mock provider up on", `:${MOCK_PORT}`);
  await signIn();

  // 1. BYOK settings
  const saved = await api("PUT", "/settings", {
    baseUrl: `http://127.0.0.1:${MOCK_PORT}/v1`,
    model: "mock-model",
    apiKey: "sk-mock-12345678",
  });
  assert(
    saved.ok === true && saved.apiKeyHint === "…5678",
    "settings saved with hint",
  );
  const settings = await api("GET", "/settings");
  assert(
    settings.configured === true &&
      settings.baseUrl.includes(String(MOCK_PORT)),
    "settings readable",
  );
  log("BYOK settings OK", JSON.stringify(settings));

  const test = await api("POST", "/settings/test", {});
  assert(test.ok === true, `settings test ok (got ${JSON.stringify(test)})`);
  log("provider test OK", test.latencyMs + "ms");

  // 2. Thread
  const created = await api("POST", "/threads");
  const threadId = created.thread.id;
  assert(threadId, "thread created");
  log("thread", threadId);

  // Reject approvals left over from previous runs so this run is deterministic.
  const staleApprovals = await api("GET", `/threads/${threadId}/approvals`);
  for (const item of staleApprovals.pending ?? []) {
    await api("POST", `/threads/${threadId}/approvals`, {
      hash: item.hash,
      approve: false,
    });
  }
  if ((staleApprovals.pending ?? []).length) {
    log("rejected stale approvals:", staleApprovals.pending.length);
  }

  stream = openEventStream(threadId, (event, data) => {
    if (event === "events" && Array.isArray(data)) events.push(...data);
    if (event === "snapshot")
      events.push({ type: "snapshot", entries: data.entries?.length ?? 0 });
  });

  // 3. Read tool round-trip
  await api("POST", `/threads/${threadId}/messages`, {
    input: "帮我找一下 张伟 的联系人资料",
    context: { page: "contacts", entityId: 9 },
  });
  const readDeadline = Date.now() + 60_000;
  while (Date.now() < readDeadline) {
    const toolEnd = events.find(
      (event) =>
        event.type === "tool_execution_end" &&
        event.toolName === "crm_search_contacts",
    );
    const messageEnd = events.filter(
      (event) => event.type === "message_end",
    ).length;
    if (toolEnd && messageEnd >= 2) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const searchEnd = events.find(
    (event) =>
      event.type === "tool_execution_end" &&
      event.toolName === "crm_search_contacts",
  );
  assert(searchEnd, "read tool crm_search_contacts executed");
  const searchEntry = searchEnd.entry;
  const searchText = JSON.stringify(searchEntry ?? {});
  assert(/张伟/.test(searchText), "search result contains 张伟");
  log("read tool OK:", searchText.slice(0, 220));

  const assistantAnswers = events.filter(
    (event) =>
      event.type === "message_end" && event.entry?.kind === "pi.assistant",
  );
  assert(
    assistantAnswers.length >= 1,
    "assistant answered after the tool call",
  );
  log(
    "assistant text:",
    JSON.stringify(
      assistantAnswers.at(-1).entry.model?.map?.((m) => m.content),
    ).slice(0, 300),
  );

  // 4. Write tool -> approval -> execute
  events.length = 0;
  await api("POST", `/threads/${threadId}/messages`, {
    input: "帮 张伟 建一个明天跟进的任务",
    context: { page: "contact", entityId: 9 },
  });

  let pending;
  const approvalDeadline = Date.now() + 60_000;
  while (Date.now() < approvalDeadline) {
    const result = await api("GET", `/threads/${threadId}/approvals`);
    if (result.pending?.length) {
      pending = result.pending[0];
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  assert(pending, "approval request was parked");
  assert(
    pending.toolName === "crm_create_task",
    "pending tool is crm_create_task",
  );
  assert(
    /张伟/.test(pending.summary),
    `approval summary mentions 张伟 (${pending.summary})`,
  );
  log("pending approval OK:", pending.summary);

  const tasksBefore = await supabaseRpc(
    "/rest/v1/tasks?select=id,text&text=like.*AI*",
  );
  const taskCountBefore = Array.isArray(tasksBefore) ? tasksBefore.length : 0;

  events.length = 0;
  const approved = await api("POST", `/threads/${threadId}/approvals`, {
    hash: pending.hash,
    approve: true,
  });
  assert(
    approved.ok === true && approved.executed === true,
    "approval accepted",
  );

  const executeDeadline = Date.now() + 60_000;
  let executed;
  while (Date.now() < executeDeadline) {
    const toolEnd = events.find(
      (event) =>
        event.type === "tool_execution_end" &&
        event.toolName === "crm_create_task" &&
        /Task created/.test(JSON.stringify(event.entry ?? {})),
    );
    if (toolEnd) {
      executed = toolEnd;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  assert(executed, "write tool executed after approval");
  log(
    "write tool executed:",
    JSON.stringify(executed.entry?.data).slice(0, 300),
  );

  // 5. Verify the row really exists through RLS as the user (poll until the
  // follow-up run has committed the insert).
  let tasks = [];
  const verifyDeadline = Date.now() + 30_000;
  while (Date.now() < verifyDeadline) {
    tasks = await supabaseRpc(
      "/rest/v1/tasks?select=id,text,due_date&text=like.*AI*",
    );
    if (Array.isArray(tasks) && tasks.length > taskCountBefore) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(
    Array.isArray(tasks) && tasks.length > taskCountBefore,
    `task row created in the CRM database (before ${taskCountBefore}, after ${Array.isArray(tasks) ? tasks.length : "n/a"})`,
  );
  const createdTask = tasks[tasks.length - 1];
  assert(
    /跟进 张伟（AI 助手创建 \d+）/.test(createdTask.text),
    `created task is the approved one (got ${createdTask.text})`,
  );
  log("database row verified:", JSON.stringify(createdTask));

  // 6. Reject flow (new proposal, then reject)
  events.length = 0;
  await api("POST", `/threads/${threadId}/messages`, {
    input: "再帮 张伟 建一个任务",
    context: { page: "contact", entityId: 9 },
  });
  let secondPending;
  const secondDeadline = Date.now() + 60_000;
  while (Date.now() < secondDeadline) {
    const result = await api("GET", `/threads/${threadId}/approvals`);
    const fresh = (result.pending ?? []).find(
      (item) => item.hash !== pending.hash,
    );
    if (fresh) {
      secondPending = fresh;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  assert(secondPending, "second approval parked");
  await api("POST", `/threads/${threadId}/approvals`, {
    hash: secondPending.hash,
    approve: false,
  });
  const stillPending = await api("GET", `/threads/${threadId}/approvals`);
  assert(
    !stillPending.pending.some((item) => item.hash === secondPending.hash),
    "rejected approval removed",
  );
  log("reject flow OK");

  // 7. New conversation ("New chat") must create a distinct, empty thread.
  const createdConversation = await api("POST", "/threads", { new: true });
  const newThreadId = createdConversation.thread.id;
  assert(newThreadId !== threadId, "new conversation has a distinct id");
  assert(
    createdConversation.thread.title === "New conversation",
    "new conversation starts untitled",
  );
  log("new conversation OK:", newThreadId);

  // 8. The conversation list is ordered by recency and contains both threads.
  const list = await api("GET", "/threads");
  assert(
    Array.isArray(list.threads) &&
      list.threads.some((item) => item.id === newThreadId) &&
      list.threads.some((item) => item.id === threadId),
    `conversation list contains both threads (${list.threads?.length})`,
  );
  assert(
    list.threads[0].id === newThreadId,
    "most recently used conversation is listed first",
  );

  // 9. The new conversation answers independently of the first one.
  if (stream) {
    await stream.close();
    stream = undefined;
  }
  events.length = 0;
  stream = openEventStream(newThreadId, (event, data) => {
    if (event === "events" && Array.isArray(data)) events.push(...data);
  });
  await new Promise((resolve) => setTimeout(resolve, 700));

  await api("POST", `/threads/${newThreadId}/messages`, {
    input: "帮我找一下 张伟 的联系人资料",
    context: { page: "dashboard", entityId: null },
  });

  const replyDeadline = Date.now() + 60_000;
  let newConversationText = "";
  while (Date.now() < replyDeadline) {
    for (const event of events) {
      if (event.type !== "message_end") continue;
      const serialized = JSON.stringify(event.entry?.model ?? []);
      if (event.entry?.kind === "pi.assistant" && /张伟/.test(serialized)) {
        newConversationText = serialized;
      }
    }
    if (newConversationText) break;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  assert(newConversationText, "new conversation answers independently");
  log("new conversation reply OK");

  // 10. The first conversation is still there and was named after its first
  // user message; the fresh one is named too.
  const conversations = await api("GET", "/threads");
  const originalThread = conversations.threads.find(
    (item) => item.id === threadId,
  );
  const freshThread = conversations.threads.find(
    (item) => item.id === newThreadId,
  );
  assert(
    originalThread?.title && originalThread.title !== "New conversation",
    `original conversation keeps its generated title (${originalThread?.title})`,
  );
  assert(
    freshThread?.title && freshThread.title !== "New conversation",
    `new conversation is named after its first message (${freshThread?.title})`,
  );
  log(
    "conversation titles OK:",
    JSON.stringify({
      original: originalThread.title,
      fresh: freshThread.title,
    }),
  );

  console.log("\n=== ASSISTANT E2E: PASS ===");
} catch (error) {
  console.error("\n=== ASSISTANT E2E: FAIL ===");
  console.error(error);
  process.exitCode = 1;
} finally {
  if (stream) await stream.close();
  mock.kill();
  // Let Node exit naturally (see Windows/libuv note in the probe report).
  setTimeout(() => process.exit(process.exitCode ?? 0), 1500).unref();
}
