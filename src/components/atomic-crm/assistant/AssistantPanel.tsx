import {
  AlertTriangle,
  History,
  Loader2,
  RefreshCw,
  Sparkles,
  SquarePen,
} from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useTranslate } from "ra-core";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { Markdown } from "../misc/Markdown";
import { AssistantApprovalCard } from "./AssistantApprovalCard";
import { AssistantComposer } from "./AssistantComposer";
import { AssistantMessage } from "./AssistantMessage";
import { getEntryToolCalls } from "./eventReducer";
import type { AssistantContext, AssistantThread } from "./types";
import { useAssistantSession } from "./useAssistantSession";

const formatTokens = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const formatCost = (value: number) => `$${value.toFixed(4)}`;

/** Maps a session error code to the translated message shown in the panel. */
const loadErrorMessageKey = (code: string): string => {
  switch (code) {
    case "not_configured":
      return "crm.assistant.errors.not_configured";
    case "unauthorized":
      return "crm.assistant.errors.unauthorized";
    case "unreachable":
      return "crm.assistant.errors.unreachable";
    case "rate_limited":
      return "crm.assistant.errors.rate_limited";
    case "busy":
      return "crm.assistant.errors.busy";
    default:
      return "crm.assistant.errors.generic";
  }
};

const formatThreadDate = (value?: string | null): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const threadLabel = (thread: AssistantThread, untitled: string): string => {
  const title = thread.title?.trim();
  if (!title || title === "New conversation") return untitled;
  return title;
};

const ConversationHistoryMenu = ({
  threads,
  activeThreadId,
  onSelect,
}: {
  threads: AssistantThread[];
  activeThreadId: string | null;
  onSelect: (threadId: string) => void;
}) => {
  const translate = useTranslate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={translate("crm.assistant.conversations.history")}
            title={translate("crm.assistant.conversations.history")}
            data-testid="assistant-history"
          />
        }
      >
        <History className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-80 w-72 overflow-y-auto"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {translate("crm.assistant.conversations.history")}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {threads.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {translate("crm.assistant.conversations.empty")}
          </div>
        ) : (
          threads.map((thread) => (
            <DropdownMenuItem
              key={thread.id}
              onClick={() => onSelect(thread.id)}
              className="flex cursor-pointer flex-col items-start gap-0.5"
              data-testid="assistant-history-item"
              data-active={thread.id === activeThreadId ? "true" : undefined}
            >
              <span
                className={cn(
                  "line-clamp-1 text-xs font-medium",
                  thread.id === activeThreadId && "text-primary",
                )}
              >
                {threadLabel(
                  thread,
                  translate("crm.assistant.conversations.untitled"),
                )}
              </span>
              <span className="text-[0.65rem] text-muted-foreground">
                {formatThreadDate(thread.lastMessageAt ?? thread.createdAt)}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const ErrorBox = ({
  title,
  message,
  onRetry,
  retryLabel,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) => (
  <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
    <div className="min-w-0 flex-1 space-y-1">
      <p className="font-medium text-destructive">{title}</p>
      {message && (
        <p className="break-words text-muted-foreground">{message}</p>
      )}
      {onRetry && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-1"
          onClick={onRetry}
        >
          <RefreshCw className="size-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  </div>
);

const NotConfiguredBanner = ({ onClose }: { onClose?: () => void }) => {
  const translate = useTranslate();
  return (
    <div className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 space-y-1">
          <p className="font-medium">
            {translate("crm.assistant.not_configured.title")}
          </p>
          <p className="break-words text-muted-foreground">
            {translate("crm.assistant.not_configured.description")}
          </p>
          <Link
            to="/settings"
            onClick={onClose}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-1",
            )}
          >
            {translate("crm.assistant.not_configured.action")}
          </Link>
        </div>
      </div>
    </div>
  );
};

const EmptyState = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="size-6 text-primary" />
      </div>
      <p className="text-sm font-medium">
        {translate("crm.assistant.empty.title")}
      </p>
      <p className="max-w-xs text-xs text-muted-foreground">
        {translate("crm.assistant.empty.description")}
      </p>
    </div>
  );
};

/**
 * The assistant conversation panel. Rendered inside a right-side sheet on
 * desktop (420px wide) and full screen on mobile; also used as the body of the
 * `/assistant` route.
 */
export const AssistantPanel = ({
  enabled,
  context,
  onClose,
  className,
}: {
  enabled: boolean;
  context: AssistantContext;
  onClose?: () => void;
  className?: string;
}) => {
  const translate = useTranslate();
  const session = useAssistantSession({ enabled, context });
  const { state, settings, settingsError, loading, threadError } = session;
  const scrollRef = useRef<HTMLDivElement>(null);

  const contentKey = `${state.entries.length}:${state.toolOrder.length}:${state.approvals.length}:${state.busy}:${Object.keys(state.streaming).join(",")}`;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [contentKey]);

  const claimedToolIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of state.entries) {
      for (const call of getEntryToolCalls(entry)) {
        ids.add(call.id);
      }
    }
    return ids;
  }, [state.entries]);

  const lastAssistantId = useMemo(() => {
    for (let index = state.entries.length - 1; index >= 0; index -= 1) {
      if (state.entries[index].kind === "pi.assistant") {
        return state.entries[index].id;
      }
    }
    return null;
  }, [state.entries]);

  const transientStreaming = state.streaming.current;
  const showTransientStreaming =
    Boolean(transientStreaming) &&
    state.busy &&
    !state.entries.some((entry) => entry.id === "current");

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col bg-background", className)}
      data-testid="assistant-panel"
    >
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3 pr-12">
        <Sparkles className="size-5 text-primary" />
        <h2 className="text-base font-semibold">
          {translate("crm.assistant.title")}
        </h2>
        {state.busy && (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="size-3 animate-spin" />
            {translate("crm.assistant.busy")}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={settings?.configured === false || session.creating}
            aria-label={translate("crm.assistant.conversations.new")}
            title={translate("crm.assistant.conversations.new")}
            data-testid="assistant-new-chat"
            onClick={() => void session.newConversation()}
          >
            {session.creating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SquarePen className="size-4" />
            )}
          </Button>
          <ConversationHistoryMenu
            threads={session.threads}
            activeThreadId={session.threadId}
            onSelect={session.openThread}
          />
          <div className="truncate text-[0.7rem] text-muted-foreground">
            {state.usage &&
            (state.usage.totalTokens || state.usage.totalCost) ? (
              <span>
                {state.usage.totalTokens !== undefined
                  ? translate("crm.assistant.usage.tokens", {
                      count: formatTokens(state.usage.totalTokens),
                    })
                  : null}
                {state.usage.totalTokens !== undefined &&
                state.usage.totalCost !== undefined
                  ? " · "
                  : null}
                {state.usage.totalCost !== undefined
                  ? translate("crm.assistant.usage.cost", {
                      cost: formatCost(state.usage.totalCost),
                    })
                  : null}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {settings && !settings.configured && (
        <NotConfiguredBanner onClose={onClose} />
      )}
      {session.connectionError && (
        <div className="shrink-0 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-[0.7rem] text-muted-foreground">
          {translate(
            session.connectionError.code === "unauthorized"
              ? "crm.assistant.errors.unauthorized"
              : "crm.assistant.errors.reconnecting",
          )}
        </div>
      )}
      {settingsError && (
        <div className="shrink-0 border-b bg-muted/40 px-4 py-2 text-[0.7rem] text-muted-foreground">
          {translate("crm.assistant.errors.settings_load")}
        </div>
      )}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
        data-testid="assistant-messages"
      >
        {loading && state.entries.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
            <Spinner size="small" />
            {translate("crm.assistant.loading")}
          </div>
        )}

        {threadError && (
          <ErrorBox
            title={translate("crm.assistant.errors.load_title")}
            message={translate(loadErrorMessageKey(threadError.code))}
            onRetry={session.reload}
            retryLabel={translate("crm.assistant.retry")}
          />
        )}

        {!loading && !threadError && state.entries.length === 0 && (
          <EmptyState />
        )}

        {state.entries.map((entry) => (
          <AssistantMessage
            key={entry.id}
            entry={entry}
            tools={state.tools}
            streamingText={state.streaming[entry.id]}
            streaming={Boolean(state.busy && entry.id === lastAssistantId)}
            claimedToolIds={claimedToolIds}
          />
        ))}

        {showTransientStreaming && (
          <div className="space-y-2" data-testid="assistant-streaming">
            <Markdown className="text-sm break-words">
              {transientStreaming ?? ""}
            </Markdown>
            <span
              aria-hidden="true"
              className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-foreground/60 align-middle"
            />
          </div>
        )}

        {state.retry && (
          <p className="text-[0.7rem] text-muted-foreground">
            {translate("crm.assistant.retrying", {
              attempt: state.retry.attempt,
              message: state.retry.message ?? "",
            })}
          </p>
        )}

        {state.error && (
          <ErrorBox
            title={translate("crm.assistant.errors.generic")}
            message={state.error}
          />
        )}

        {state.ended === "stopped" && !state.busy && (
          <p className="text-center text-[0.7rem] text-muted-foreground">
            {translate("crm.assistant.stopped")}
          </p>
        )}
      </div>

      {state.approvals.length > 0 && (
        <div className="shrink-0 space-y-2 border-t bg-background px-4 py-3">
          {state.approvals.map((approval) => (
            <AssistantApprovalCard
              key={approval.hash}
              approval={approval}
              busy={session.resolvingHash !== null}
              onResolve={(hash, approve) =>
                void session.resolveApproval(hash, approve)
              }
            />
          ))}
        </div>
      )}

      <AssistantComposer
        disabled={settings?.configured === false || !session.threadId}
        busy={state.busy}
        sending={session.sending}
        onSend={session.send}
        onStop={() => void session.stop()}
      />
    </div>
  );
};
