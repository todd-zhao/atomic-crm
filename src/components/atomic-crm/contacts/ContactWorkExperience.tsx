import { useRecordContext } from "ra-core";

import type { Contact } from "../types";
import { formatYearRange } from "./contactModel";

/**
 * Read-only list of the contact's past positions, from the `work_experience`
 * JSON column (one row per company/title/period).
 */
export const ContactWorkExperience = () => {
  const record = useRecordContext<Contact>();
  const entries = record?.work_experience ?? [];
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, index) => {
        const position = [entry.company, entry.title]
          .filter(Boolean)
          .join(" · ");
        const period = formatYearRange(entry.start_year, entry.end_year);
        if (!position && !period) return null;
        return (
          <div key={index} className="text-sm">
            {position ? <div className="font-medium">{position}</div> : null}
            {period ? (
              <div className="text-muted-foreground text-xs">{period}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
