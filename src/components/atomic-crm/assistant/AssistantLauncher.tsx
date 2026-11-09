import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslate } from "ra-core";
import { useLocation } from "react-router";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { AssistantPanel } from "./AssistantPanel";
import { getAssistantContext } from "./context";

/**
 * Trigger + right-side sheet hosting the assistant panel. Mounted from the
 * desktop header (`variant="header"`) and from the mobile bottom navigation
 * (`variant="mobile"`). The sheet is 420px wide from the `sm` breakpoint and
 * full screen on phones.
 */
export const AssistantLauncher = ({
  variant,
}: {
  variant: "header" | "mobile";
}) => {
  const translate = useTranslate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const context = useMemo(
    () => getAssistantContext(location.pathname),
    [location.pathname],
  );

  const trigger =
    variant === "header" ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
        aria-label={translate("crm.assistant.open")}
        title={translate("crm.assistant.open")}
        data-testid="assistant-header-button"
      >
        <Sparkles className="size-4 text-primary" />
        <span className="hidden lg:inline">
          {translate("crm.assistant.open")}
        </span>
      </Button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={translate("crm.assistant.open")}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "flex h-auto w-14 flex-col gap-1 rounded-md px-1 py-2 text-muted-foreground",
        )}
        data-testid="assistant-mobile-button"
      >
        <Sparkles className="size-6" />
        <span className="text-[0.6rem] font-medium">
          {translate("crm.assistant.short_label")}
        </span>
      </button>
    );

  return (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="data-[side=right]:w-full gap-0 p-0 data-[side=right]:sm:max-w-[420px]"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">
            {translate("crm.assistant.title")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {translate("crm.assistant.description")}
          </SheetDescription>
          <AssistantPanel
            enabled={open}
            context={context}
            onClose={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
};
