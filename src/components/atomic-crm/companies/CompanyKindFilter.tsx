import { Check } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { companyKindBasePath } from "./companyKindPaths";

/**
 * Directory switcher shown in the filter bar of both company directories.
 *
 * The current directory is pinned: its button is not clickable, so the hotel list
 * can never load channels (and vice versa). Picking the other kind navigates to
 * the matching directory instead of mixing both in one list.
 */
export const CompanyKindFilter = ({ activeKind }: { activeKind: string }) => {
  const { companyKinds } = useConfigurationContext();
  const navigate = useNavigate();

  return (
    <>
      {companyKinds.map((kind) => {
        const isActive = kind.value === activeKind;
        return (
          <Button
            key={kind.value}
            type="button"
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            className="cursor-pointer flex flex-row items-center justify-between gap-2 px-2.5 w-full text-left whitespace-normal h-auto py-1.5"
            onClick={() => {
              if (!isActive) navigate(companyKindBasePath(kind.value));
            }}
            aria-current={isActive ? "page" : undefined}
          >
            {kind.label}
            {isActive ? <Check className="size-4 shrink-0 opacity-50" /> : null}
          </Button>
        );
      })}
    </>
  );
};
