import { useTranslate } from "ra-core";

import { Markdown } from "../misc/Markdown";
import { AssistantToolCard } from "./AssistantToolCard";
import {
  getEntryText,
  getEntryThinking,
  getEntryToolCalls,
  getEntryToolResult,
} from "./eventReducer";
import type { AssistantEntry, ToolCard } from "./types";

const StreamingCursor = () => (
  <span
    aria-hidden="true"
    className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-foreground/60 align-middle"
  />
);

/**
 * Renders one conversation entry. `pi.user` entries become right-aligned
 * bubbles, `pi.assistant` entries render markdown + thinking + tool cards, and
 * tool results are folded into the tool card of the matching call.
 */
export const AssistantMessage = ({
  entry,
  tools,
  streamingText,
  streaming,
  claimedToolIds,
}: {
  entry: AssistantEntry;
  tools: Record<string, ToolCard>;
  streamingText?: string;
  streaming?: boolean;
  /** Tool call ids already rendered by an assistant entry. */
  claimedToolIds: Set<string>;
}) => {
  const translate = useTranslate();

  if (entry.kind === "pi.tool-result") {
    const result = getEntryToolResult(entry);
    const id = result?.id ?? `result-${entry.id}`;
    if (!result || claimedToolIds.has(id)) return null;
    const card = tools[id] ?? {
      id,
      name: result.name ?? "tool",
      status: result.isError ? "error" : "done",
      output: undefined,
    };
    return (
      <div className="max-w-[95%]">
        <AssistantToolCard card={card} />
      </div>
    );
  }

  if (entry.kind === "pi.user") {
    const text = getEntryText(entry);
    if (!text) return null;
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm break-words whitespace-pre-wrap text-primary-foreground">
          {text}
        </div>
      </div>
    );
  }

  if (entry.kind === "pi.system") {
    const text = getEntryText(entry);
    if (!text) return null;
    return (
      <p className="rounded bg-muted/60 px-3 py-2 text-xs break-words text-muted-foreground whitespace-pre-wrap">
        {text}
      </p>
    );
  }

  if (entry.kind === "pi.reset" || entry.kind === "pi.compaction") {
    return (
      <p className="text-center text-[0.7rem] text-muted-foreground">
        {translate(
          entry.kind === "pi.reset"
            ? "crm.assistant.events.reset"
            : "crm.assistant.events.compacted",
        )}
      </p>
    );
  }

  // Assistant message (and any unknown kind carrying text).
  const text = getEntryText(entry);
  const thinking = getEntryThinking(entry);
  const calls = getEntryToolCalls(entry);
  if (!text && !thinking && calls.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" data-testid="assistant-message">
      {thinking && (
        <details className="rounded-lg border bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium">
            {translate("crm.assistant.thinking")}
          </summary>
          <p className="mt-1 break-words whitespace-pre-wrap">{thinking}</p>
        </details>
      )}
      {(text || streamingText) && (
        <Markdown className="text-sm break-words">
          {text || streamingText || ""}
        </Markdown>
      )}
      {streaming && <StreamingCursor />}
      {calls.map((call) => (
        <AssistantToolCard
          key={call.id}
          card={
            tools[call.id] ?? {
              id: call.id,
              name: call.name,
              args: call.args,
              status: "running",
            }
          }
        />
      ))}
    </div>
  );
};
