import crypto from "node:crypto";
import { serve } from "@hono/node-server";
import { watchEvents } from "@earendil-works/pi-durable";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { assertConfig, config } from "./config";
import {
  verifyAccessToken,
  requireAuthenticatedUser,
  type UserClaims,
} from "./auth";
import { closeDb } from "./db";
import { ApprovalDoc, APPROVAL_TTL_MS } from "./docs";
import { getHarness, closeHarness, CTX } from "./harness";
import {
  deleteSettings,
  publicSettings,
  requireByok,
  saveSettings,
  testProvider,
  HttpError,
} from "./settings";
import {
  ensureAgent,
  getConversation,
  getOrCreateThread,
  getThread,
  createThread,
  listThreads,
  threadViewInfo,
  touchThread,
  updateThreadContext,
  type PageContext,
} from "./threads";

type AppEnv = { Variables: { user: UserClaims } };

const BASE = "/assistant";
const app = new Hono<AppEnv>();

app.use(
  `${BASE}/*`,
  cors({
    origin: config.corsOrigins,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 86_400,
  }),
);

// Public health check (used by the start script and container healthchecks).
app.get(`${BASE}/health`, (c) =>
  c.json({
    ok: true,
    version: config.version,
    mode: "byok",
    service: "atomic-crm-assistant",
  }),
);

// Bearer auth for everything else.
app.use(`${BASE}/*`, async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!token)
    throw new HttpError(
      401,
      "unauthorized",
      "Missing Authorization: Bearer <access_token>",
    );
  let user: UserClaims;
  try {
    user = await verifyAccessToken(token);
    requireAuthenticatedUser(user);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "unauthorized", "Invalid or expired access token");
  }
  c.set("user", user);
  await next();
});

const json = async <T>(c: any): Promise<T> => {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new HttpError(400, "bad_request", "Invalid JSON body");
  }
};

// ---------------------------------------------------------------------------
// BYOK settings
// ---------------------------------------------------------------------------

app.get(`${BASE}/settings`, async (c) =>
  c.json(await publicSettings(c.get("user").userId)),
);

app.put(`${BASE}/settings`, async (c) => {
  const body = await json<{
    baseUrl?: unknown;
    model?: unknown;
    apiKey?: unknown;
  }>(c);
  const result = await saveSettings(c.get("user").userId, body);
  return c.json(result);
});

app.delete(`${BASE}/settings`, async (c) => {
  await deleteSettings(c.get("user").userId);
  return c.json({ ok: true, configured: false });
});

app.post(`${BASE}/settings/test`, async (c) => {
  const body = await json<{
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  }>(c).catch(() => ({}));
  const result = await testProvider(c.get("user").userId, body);
  return c.json(result);
});

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

app.get(`${BASE}/threads`, async (c) => {
  const threads = await listThreads(c.get("user").userId);
  return c.json({
    threads: threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      createdAt: thread.created_at,
      lastMessageAt: thread.last_message_at,
    })),
  });
});

app.post(`${BASE}/threads`, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { new?: unknown };
  const userId = c.get("user").userId;
  const thread =
    body?.new === true
      ? await createThread(userId)
      : await getOrCreateThread(userId);
  return c.json({
    thread: {
      id: thread.id,
      title: thread.title,
      createdAt: thread.created_at,
      lastMessageAt: thread.last_message_at,
    },
  });
});

app.get(`${BASE}/threads/:id`, async (c) => {
  const user = c.get("user");
  const thread = await getThread(user.userId, c.req.param("id"));
  const [info, settings] = await Promise.all([
    threadViewInfo(thread),
    publicSettings(user.userId),
  ]);
  return c.json({
    thread: {
      id: thread.id,
      title: thread.title,
      createdAt: thread.created_at,
      lastMessageAt: thread.last_message_at,
    },
    busy: info.busy,
    configured: settings.configured,
    usage: info.usage,
  });
});

app.post(`${BASE}/threads/:id/messages`, async (c) => {
  const user = c.get("user");
  const thread = await getThread(user.userId, c.req.param("id"));
  const body = await json<{ input?: string; context?: PageContext }>(c);
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) throw new HttpError(400, "bad_request", "input is required");
  if (input.length > 12_000)
    throw new HttpError(400, "bad_request", "input is too long");

  await requireByok(user.userId);
  await ensureAgent(thread, user.userId, true);
  await updateThreadContext(thread, user.userId, body.context ?? {});

  const conversation = await getConversation(thread);
  const submission = await conversation.submit(
    {
      type: "input",
      content: input,
      requestId: crypto.randomUUID(),
      whenBusy: "followUp",
    },
    CTX,
  );
  await touchThread(thread.id, {
    lastMessageAt: true,
    title:
      !thread.title || thread.title === "New conversation"
        ? input.replace(/\s+/g, " ").slice(0, 60)
        : undefined,
  });
  return c.json({ submissionId: submission.id });
});

app.post(`${BASE}/threads/:id/abort`, async (c) => {
  const user = c.get("user");
  const thread = await getThread(user.userId, c.req.param("id"));
  const conversation = await getConversation(thread);
  await conversation.abort(CTX, { background: true });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// SSE: agent events for one conversation
// ---------------------------------------------------------------------------

app.get(`${BASE}/threads/:id/events`, async (c) => {
  const user = c.get("user");
  const thread = await getThread(user.userId, c.req.param("id"));
  const conversation = await getConversation(thread);
  const harness = await getHarness();
  const events = await watchEvents(harness, conversation.id as any, CTX);

  console.log(
    `[sse] client connected thread=${thread.id} conv=${conversation.id}`,
  );
  c.header("Cache-Control", "no-cache, no-transform");
  c.header("X-Accel-Buffering", "no");

  return streamSSE(c, async (sse) => {
    let stopped = false;
    const stop = () => {
      console.log(`[sse] stop thread=${thread.id}`);
      if (stopped) return;
      stopped = true;
      void events.stop();
    };
    sse.onAbort(stop);
    try {
      await sse.writeSSE({
        event: "snapshot",
        data: JSON.stringify(events.snapshot),
      });
      events.start(async (batch) => {
        console.log(
          `[sse] batch ${batch.length}: ${batch.map((event: any) => event.type).join(",")}`,
        );
        if (stopped) return;
        try {
          await sse.writeSSE({ event: "events", data: JSON.stringify(batch) });
        } catch {
          stop();
        }
      });
      while (!stopped) {
        await sse.sleep(15_000);
        if (stopped) break;
        await sse.writeSSE({
          event: "ping",
          data: JSON.stringify({ t: Date.now() }),
        });
      }
    } catch {
      stop();
    }
  });
});

// ---------------------------------------------------------------------------
// Approvals for write tools
// ---------------------------------------------------------------------------

app.get(`${BASE}/threads/:id/approvals`, async (c) => {
  const user = c.get("user");
  const thread = await getThread(user.userId, c.req.param("id"));
  const conversation = await getConversation(thread);
  const doc = (await conversation.commit(async (tx: any) => {
    // A read would suffice; a no-op commit is avoided by reading through the
    // document reader of the harness below instead.
    return tx.doc(ApprovalDoc, conversation.id);
  }, CTX)) as unknown as { pending: any[] };
  void doc;
  const state = await getHarness().then((harness) =>
    harness.snapshot(ApprovalDoc, conversation.id as any, CTX),
  );
  const now = Date.now();
  return c.json({
    pending: (state?.pending ?? []).filter(
      (item: any) => now - item.createdAt < APPROVAL_TTL_MS,
    ),
  });
});

app.post(`${BASE}/threads/:id/approvals`, async (c) => {
  const user = c.get("user");
  const thread = await getThread(user.userId, c.req.param("id"));
  const conversation = await getConversation(thread);
  const body = await json<{ hash?: string; approve?: boolean }>(c);
  const hash = body.hash;
  if (!hash || typeof hash !== "string")
    throw new HttpError(400, "bad_request", "hash is required");

  const harness = await getHarness();
  const state = await harness.snapshot(
    ApprovalDoc,
    conversation.id as any,
    CTX,
  );
  const pending = state?.pending?.find((item: any) => item.hash === hash);
  if (!pending)
    throw new HttpError(404, "not_found", "No pending approval with this hash");

  await conversation.commit(async (tx: any) => {
    const draft = await tx.doc(ApprovalDoc, conversation.id);
    draft.pending = draft.pending.filter((item: any) => item.hash !== hash);
    if (body.approve) {
      const now = Date.now();
      draft.granted = (draft.granted ?? []).filter(
        (item: any) => now - item.at < APPROVAL_TTL_MS,
      );
      draft.granted.push({ hash, at: now });
    }
  }, CTX);

  const content = body.approve
    ? `The user approved your proposal: ${pending.summary} (hash ${hash}). Retry the tool call now and report the outcome.`
    : `The user rejected your proposal: ${pending.summary}. Do not retry it; acknowledge and ask what to do instead.`;
  await conversation.submit(
    {
      type: "input",
      content,
      requestId: `approval:${body.approve ? "yes" : "no"}:${hash}`,
      whenBusy: "followUp",
    },
    CTX,
  );

  return c.json({ ok: true, executed: Boolean(body.approve) });
});

// ---------------------------------------------------------------------------
// History paging
// ---------------------------------------------------------------------------

app.get(`${BASE}/threads/:id/entries`, async (c) => {
  const user = c.get("user");
  const thread = await getThread(user.userId, c.req.param("id"));
  const conversation = await getConversation(thread);
  const limit = Math.min(
    50,
    Math.max(1, Number(c.req.query("limit") ?? 30) || 30),
  );
  const before = Number(c.req.query("before"));
  const query: any = { order: "descending" };
  if (Number.isFinite(before) && before > 1) query.maxEntryId = before - 1;
  const page = await conversation.entries(query, limit, undefined, CTX);
  const oldest = page.items.length
    ? page.items[page.items.length - 1].id
    : null;
  return c.json({ items: page.items, next: oldest });
});

app.notFound((c) =>
  c.json(
    { error: { code: "not_found", message: "Unknown assistant endpoint" } },
    404,
  ),
);

app.onError((error, c) => {
  const status =
    error instanceof HttpError ? error.status : ((error as any)?.status ?? 500);
  const code = error instanceof HttpError ? error.code : "internal_error";
  if (status >= 500) console.error("[assistant] unhandled error:", error);
  return c.json({ error: { code, message: error.message } }, status as any);
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

assertConfig();
await getHarness();

const host = process.env.HOST ?? "127.0.0.1";
const server = serve(
  { fetch: app.fetch, port: config.port, hostname: host },
  (info) => {
    console.log(
      `[assistant] listening on http://${host}:${info.port}${BASE} (BYOK, pi-durable)`,
    );
  },
);

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[assistant] ${signal}: shutting down`);
  try {
    await closeHarness();
  } catch (error) {
    console.warn("[assistant] close harness failed:", error);
  }
  try {
    await closeDb();
  } catch (error) {
    console.warn("[assistant] close db failed:", error);
  }
  server.close(() => {
    console.log("[assistant] closed");
  });
  // Fallback: never hang the container on lingering handles (let Node exit
  // naturally first so libuv/database teardown is complete).
  setTimeout(() => process.exit(0), 8_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
