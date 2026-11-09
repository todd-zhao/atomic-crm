import { Check, Loader2, ShieldQuestion, X } from "lucide-react";
import { useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";

import type { PendingApproval } from "./types";

/**
 * Approval card for a write tool call blocked by the assistant backend (see
 * API.md "审批协议"). Approving grants the tool once and resubmits a follow-up
 * input on the server; rejecting tells the model not to retry.
 */
export const AssistantApprovalCard = ({
  approval,
  busy,
  onResolve,
}: {
  approval: PendingApproval;
  busy: boolean;
  onResolve: (hash: string, approve: boolean) => void;
}) => {
  const translate = useTranslate();
  const argsText =
    approval.args === undefined
      ? ""
      : typeof approval.args === "string"
        ? approval.args
        : JSON.stringify(approval.args, null, 2);

  return (
    <div
      className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3"
      data-testid="assistant-approval-card"
    >
      <div className="flex items-start gap-2">
        <ShieldQuestion className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">
            {translate("crm.assistant.approval.title")}
          </p>
          <p className="text-xs break-words text-muted-foreground">
            {approval.summary ||
              translate("crm.assistant.approval.fallback_summary")}
          </p>
          <p className="text-[0.7rem] text-muted-foreground">
            <span className="font-medium">
              {translate("crm.assistant.approval.tool")}
            </span>{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">
              {approval.toolName}
            </code>
          </p>
          {argsText && (
            <details className="text-[0.7rem] text-muted-foreground">
              <summary className="cursor-pointer select-none">
                {translate("crm.assistant.approval.args")}
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/60 p-2 font-mono whitespace-pre-wrap break-words">
                {argsText}
              </pre>
            </details>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => onResolve(approval.hash, true)}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {translate("crm.assistant.approval.approve")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onResolve(approval.hash, false)}
            >
              <X className="size-3.5" />
              {translate("crm.assistant.approval.reject")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
