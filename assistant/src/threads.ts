import type { Conversation } from "@earendil-works/pi-durable";
import { queryPrivileged } from "./db";
import { CrmSessionDoc } from "./docs";
import { getHarness, CTX } from "./harness";
import { agentModel } from "./models";
import { HttpError, requireByok } from "./settings";

export type ThreadRow = {
  id: string;
  user_id: string;
  durable_conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
};

export type PageContext = { page?: string; entityId?: number | null };

export async function listThreads(userId: string): Promise<ThreadRow[]> {
  return queryPrivileged<ThreadRow>(
    "select * from public.assistant_threads where user_id = $1 order by coalesce(last_message_at, created_at) desc",
    [userId],
  );
}

export async function getThread(
  userId: string,
  threadId: string,
): Promise<ThreadRow> {
  const rows = await queryPrivileged<ThreadRow>(
    "select * from public.assistant_threads where id = $1 and user_id = $2",
    [threadId, userId],
  );
  const thread = rows[0];
  if (!thread) throw new HttpError(404, "not_found", "Conversation not found");
  return thread;
}

/** Creates a brand-new durable conversation + thread row for this user. */
async function createConversationThread(
  userId: string,
  title: string,
): Promise<ThreadRow> {
  const cfg = await requireByok(userId);
  const harness = await getHarness();
  const conversation = await harness.createConversation(
    {
      ownership: { kind: "ownerless" },
      agent: { model: agentModel(userId, cfg.model) },
      init: async (tx: any, conversationId: any) => {
        const doc = await tx.doc(CrmSessionDoc, conversationId);
        doc.userId = userId;
      },
    },
    CTX,
  );

  const inserted = await queryPrivileged<ThreadRow>(
    `insert into public.assistant_threads (user_id, durable_conversation_id, title)
     values ($1, $2, $3)
     returning *`,
    [userId, conversation.id, title],
  );
  return inserted[0];
}

/** The thread the panel opens by default: the most recently used one. */
export async function getOrCreateThread(userId: string): Promise<ThreadRow> {
  const existing = await queryPrivileged<ThreadRow>(
    `select * from public.assistant_threads
     where user_id = $1
     order by coalesce(last_message_at, created_at) desc
     limit 1`,
    [userId],
  );
  if (existing[0]) return existing[0];
  return createConversationThread(userId, "New conversation");
}

/** Always starts a new conversation (the "New chat" button). */
export async function createThread(userId: string): Promise<ThreadRow> {
  return createConversationThread(userId, "New conversation");
}

export async function getConversation(
  thread: ThreadRow,
): Promise<Conversation> {
  const harness = await getHarness();
  const conversation = await harness.conversation(
    thread.durable_conversation_id as any,
    CTX,
  );
  if (!conversation) {
    throw new HttpError(
      409,
      "not_found",
      "The stored conversation is missing from the assistant database",
    );
  }
  return conversation;
}

/** Refresh the page context the model sees for this thread. */
export async function updateThreadContext(
  thread: ThreadRow,
  userId: string,
  context: PageContext,
): Promise<void> {
  const conversation = await getConversation(thread);
  await conversation.commit(async (tx: any) => {
    const doc = await tx.doc(CrmSessionDoc, conversation.id);
    if (!doc.userId) doc.userId = userId;
    doc.page =
      typeof context.page === "string" && context.page ? context.page : "other";
    doc.entityId =
      typeof context.entityId === "number" ? context.entityId : null;
  }, CTX);
}

/** Make sure the conversation's agent points at the user's current BYOK model. */
export async function ensureAgent(
  thread: ThreadRow,
  userId: string,
  apiKeyConfigured: boolean,
): Promise<void> {
  if (!apiKeyConfigured) return;
  const conversation = await getConversation(thread);
  const providerId = agentModel(userId, "unused").provider;
  const agent = await conversation.agent(CTX);
  if (agent.model?.provider !== providerId) {
    throw new HttpError(
      409,
      "not_configured",
      "AI provider is not configured. Add an API key in Settings → AI Assistant.",
    );
  }
}

export async function touchThread(
  threadId: string,
  updates: { title?: string; lastMessageAt?: boolean },
): Promise<void> {
  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [threadId];
  if (updates.title !== undefined) {
    params.push(updates.title);
    sets.push(`title = $${params.length}`);
  }
  if (updates.lastMessageAt) sets.push("last_message_at = now()");
  await queryPrivileged(
    `update public.assistant_threads set ${sets.join(", ")} where id = $1`,
    params,
  );
}

export async function threadViewInfo(thread: ThreadRow) {
  const conversation = await getConversation(thread);
  let busy = false;
  let usage: { totalTokens?: number; totalCost?: number } | undefined;
  try {
    const state = await conversation.viewState(CTX);
    const docs = (state as any)?.value?.docs ?? {};
    const live = docs["pi.live"];
    busy = Boolean(live?.run);
    const usageDoc = docs["pi.usage"];
    if (usageDoc) {
      const models = usageDoc.models ?? {};
      let tokens = 0;
      let cost = 0;
      for (const entry of Object.values<any>(models)) {
        tokens +=
          (entry?.totalTokens ?? 0) +
          (entry?.inputTokens ?? 0) +
          (entry?.outputTokens ?? 0);
        cost += entry?.cost?.total ?? 0;
      }
      usage = { totalTokens: tokens, totalCost: cost };
    }
  } catch {
    // view best effort
  }
  return { busy, usage };
}
