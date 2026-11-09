import { useMemo } from "react";
import { useLocation } from "react-router";

import { AssistantPanel } from "./AssistantPanel";
import { getAssistantContext } from "./context";

/**
 * Full-page assistant, registered as `/assistant` in both the desktop and the
 * mobile admin so the conversation can be deep-linked (e.g. from the mobile
 * navigation or a bookmark). The panel itself is the same as the one opened by
 * the header button.
 */
export const AssistantPage = () => {
  const location = useLocation();
  const context = useMemo(
    () => getAssistantContext(location.pathname),
    [location.pathname],
  );

  return (
    <div className="mx-auto h-[calc(100dvh-9rem)] max-w-3xl overflow-hidden rounded-xl border bg-background shadow-sm">
      <AssistantPanel enabled context={context} />
    </div>
  );
};

AssistantPage.path = "/assistant";
