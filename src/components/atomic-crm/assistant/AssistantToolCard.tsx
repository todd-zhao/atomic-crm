import {
  Check,
  ChevronRight,
  CircleAlert,
  Loader2,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { useTranslate } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { ToolCard } from "./types";

const statusBadge = (
  card: ToolCard,
  translate: ReturnType<typeof useTranslate>,
) => {
  if (card.rejected) {
    return (
      <Badge variant="destructive">
        {translate("crm.assistant.tool.rejected")}
      </Badge>
    );
  }
  switch (card.status) {
    case "running":
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="size-3 animate-spin" />
          {translate("crm.assistant.tool.running")}
        </Badge>
      );
    case "pending_approval":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/60 text-amber-700 dark:text-amber-400"
        >
          {translate("crm.assistant.tool.awaiting_approval")}
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive">
          {translate("crm.assistant.tool.failed")}
        </Badge>
      );
    case "done":
    default:
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Check className="size-3" />
          {translate("crm.assistant.tool.done")}
        </Badge>
      );
  }
};

/**
 * Collapsible card for one tool invocation: name, arguments, status and the
 * (collapsible) output. Failed calls get a destructive accent.
 */
export const AssistantToolCard = ({ card }: { card: ToolCard }) => {
  const translate = useTranslate();
  const [expanded, setExpanded] = useState(false);
  const argsText =
    card.args === undefined
      ? ""
      : typeof card.args === "string"
        ? card.args
        : JSON.stringify(card.args, null, 2);
  const output = card.output?.trim();
  const hasDetails = Boolean(argsText || output || card.error);
  const isError = card.status === "error";

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 text-xs",
        isError && "border-destructive/40 bg-destructive/5",
      )}
      data-testid="assistant-tool-card"
      data-tool-name={card.name}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        disabled={!hasDetails}
      >
        {isError ? (
          <CircleAlert className="size-3.5 shrink-0 text-destructive" />
        ) : (
          <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[0.7rem]">
          {card.name}
        </span>
        {statusBadge(card, translate)}
        {hasDetails && (
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-90",
            )}
          />
        )}
      </button>
      {expanded && hasDetails && (
        <div className="space-y-2 border-t px-2.5 py-2">
          {argsText && (
            <section>
              <p className="mb-1 font-medium text-muted-foreground">
                {translate("crm.assistant.tool.args")}
              </p>
              <pre className="max-h-48 overflow-auto rounded bg-muted/60 p-2 font-mono text-[0.68rem] whitespace-pre-wrap break-words">
                {argsText}
              </pre>
            </section>
          )}
          {(output || card.error) && (
            <section>
              <p className="mb-1 font-medium text-muted-foreground">
                {isError
                  ? translate("crm.assistant.tool.error")
                  : translate("crm.assistant.tool.output")}
              </p>
              <pre
                className={cn(
                  "max-h-64 overflow-auto rounded bg-muted/60 p-2 font-mono text-[0.68rem] whitespace-pre-wrap break-words",
                  isError && "bg-destructive/10 text-destructive",
                )}
              >
                {card.error ?? output}
              </pre>
            </section>
          )}
        </div>
      )}
      {!expanded && isError && card.error && (
        <p className="line-clamp-2 px-2.5 pb-2 text-[0.7rem] text-destructive">
          {card.error}
        </p>
      )}
    </div>
  );
};
