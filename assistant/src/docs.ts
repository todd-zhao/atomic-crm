import { defineDoc } from "@earendil-works/pi-durable";

/**
 * Per-conversation binding to the CRM user and the page the user is looking at.
 * Written at thread creation and refreshed on every message.
 */
export type CrmSessionState = {
  userId: string;
  page: string;
  entityId: number | null;
};

export const CrmSessionDoc = defineDoc<CrmSessionState>({
  kind: "app.crm-session",
  version: 1,
  scope: "conversation",
  history: "latest",
  fork: "initial",
  initial: () => ({ userId: "", page: "other", entityId: null }),
  checkpointWhen: () => false,
});

export type PendingApproval = {
  hash: string;
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  createdAt: number;
};

export type ApprovalState = {
  pending: PendingApproval[];
  granted: { hash: string; at: number }[];
};

/** Write tools park a call here until the user approves it in the UI. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ApprovalDoc = defineDoc<any>({
  kind: "app.crm-approvals",
  version: 1,
  scope: "conversation",
  history: "latest",
  fork: "initial",
  initial: () => ({ pending: [], granted: [] }),
  checkpointWhen: () => false,
});

export const APPROVAL_TTL_MS = 10 * 60 * 1000;
