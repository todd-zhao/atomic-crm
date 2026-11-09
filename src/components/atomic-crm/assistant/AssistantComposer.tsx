import { SendHorizontal, Square } from "lucide-react";
import { useState } from "react";
import { useTranslate } from "ra-core";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Message composer: Enter sends, Shift+Enter inserts a newline. While a run is
 * in progress the send button becomes a stop button; the input stays enabled
 * so the user can queue a follow-up (the backend queues it).
 */
export const AssistantComposer = ({
  disabled,
  busy,
  sending,
  onSend,
  onStop,
}: {
  disabled: boolean;
  busy: boolean;
  sending: boolean;
  onSend: (input: string) => Promise<boolean>;
  onStop: () => void;
}) => {
  const translate = useTranslate();
  const [value, setValue] = useState("");

  const submit = async () => {
    const input = value;
    if (!input.trim() || disabled || sending) return;
    const accepted = await onSend(input);
    if (accepted) {
      setValue("");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="shrink-0 border-t bg-background p-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={disabled}
          placeholder={translate("crm.assistant.composer.placeholder")}
          aria-label={translate("crm.assistant.composer.placeholder")}
          className="max-h-40 min-h-[2.75rem] resize-none text-sm"
          data-testid="assistant-composer"
        />
        {busy ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onStop}
            aria-label={translate("crm.assistant.composer.stop")}
            title={translate("crm.assistant.composer.stop")}
          >
            <Square className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            onClick={() => void submit()}
            disabled={disabled || sending || !value.trim()}
            aria-label={translate("crm.assistant.composer.send")}
            title={translate("crm.assistant.composer.send")}
          >
            <SendHorizontal className="size-4" />
          </Button>
        )}
      </div>
      <p className="mt-1 text-[0.65rem] text-muted-foreground">
        {translate("crm.assistant.composer.hint")}
      </p>
    </div>
  );
};
