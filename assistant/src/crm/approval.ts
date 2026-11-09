import type { Context } from "@earendil-works/chord";
import { APPROVAL_TTL_MS, ApprovalDoc, CrmSessionDoc } from "../docs";
import { sha256Hex } from "../crypto";

/** Stable JSON: object keys sorted, so a retried call hashes identically. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(",")}}`;
}

export function approvalHash(
  toolName: string,
  args: Record<string, unknown>,
): string {
  return sha256Hex(`${toolName}\n${canonicalJson(args)}`);
}

export type ApprovalOutcome =
  | { kind: "done"; result: Record<string, unknown> }
  | { kind: "pending"; result: Record<string, unknown> };

/**
 * Write-tool gate:
 *  - no valid grant for this exact call => park it in ApprovalDoc.pending and
 *    return a model-visible "NOT EXECUTED" result (no DB write happens);
 *  - valid grant => consume it, run the write, return the result.
 */
export async function withApproval(
  api: any,
  ctx: Context,
  toolName: string,
  args: Record<string, unknown>,
  summary: (userId: string) => Promise<string>,
  execute: (
    userId: string,
  ) => Promise<{ text: string; details?: Record<string, unknown> }>,
): Promise<ApprovalOutcome> {
  const session = await api.snapshot(CrmSessionDoc, api.conversationId, ctx);
  const userId: string | undefined = session?.userId;
  if (!userId) {
    return {
      kind: "done",
      result: {
        isError: true,
        output: [
          { type: "text", text: "No CRM user is bound to this conversation." },
        ],
      },
    };
  }

  const hash = approvalHash(toolName, args);
  const now: number = api.now();
  const doc = (await api.snapshot(ApprovalDoc, api.conversationId, ctx)) ?? {
    pending: [],
    granted: [],
  };
  const granted = doc.granted.find(
    (grant: { hash: string; at: number }) =>
      grant.hash === hash && now - grant.at < APPROVAL_TTL_MS,
  );

  if (!granted) {
    const text = await summary(userId);
    await api.commit(async (tx: any) => {
      const draft = await tx.doc(ApprovalDoc, api.conversationId);
      draft.pending = draft.pending.filter((p: any) => p.hash !== hash);
      draft.pending.push({
        hash,
        toolName,
        args,
        summary: text,
        createdAt: now,
      });
      draft.granted = draft.granted.filter(
        (g: any) => now - g.at < APPROVAL_TTL_MS,
      );
    }, ctx);
    return {
      kind: "pending",
      result: {
        output: [
          {
            type: "text",
            text: `NOT EXECUTED — this action needs the user's approval (hash ${hash}). Explain what you are about to do and ask the user to approve it in the UI. Do not claim it is done.`,
          },
        ],
        details: { pendingApproval: { hash, toolName, args, summary: text } },
        diagnostics: [
          {
            severity: "info",
            message: "Awaiting user approval",
            code: "pending_approval",
          },
        ],
      },
    };
  }

  // Consume the grant before executing: a crash between the two means the user
  // approves again, which is the safe direction.
  await api.commit(async (tx: any) => {
    const draft = await tx.doc(ApprovalDoc, api.conversationId);
    draft.granted = draft.granted.filter((g: any) => g.hash !== hash);
    draft.pending = draft.pending.filter((p: any) => p.hash !== hash);
  }, ctx);

  try {
    const outcome = await execute(userId);
    return {
      kind: "done",
      result: {
        output: [{ type: "text", text: outcome.text }],
        details: {
          ...(outcome.details ?? {}),
          approvedAction: { hash, toolName },
        },
        diagnostics: [
          {
            severity: "info",
            message: "Approved by the user",
            code: "approved",
          },
        ],
      },
    };
  } catch (error) {
    return {
      kind: "done",
      result: {
        isError: true,
        output: [
          {
            type: "text",
            text: `Approved, but the action failed: ${(error as Error).message}`,
          },
        ],
        details: { approvedAction: { hash, toolName } },
      },
    };
  }
}
