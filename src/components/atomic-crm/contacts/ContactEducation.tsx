import { useRecordContext } from "ra-core";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact } from "../types";
import { findOptionLabel, formatYearRange } from "./contactModel";

/**
 * Read-only list of the contact's schools, from the `education` JSON column
 * (one row per school/major/degree/period).
 */
export const ContactEducation = () => {
  const record = useRecordContext<Contact>();
  const { educationDegrees } = useConfigurationContext();
  const entries = record?.education ?? [];
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, index) => {
        const school = [entry.school, entry.major].filter(Boolean).join(" · ");
        const degree =
          findOptionLabel(educationDegrees, entry.degree) ?? entry.degree;
        const period = formatYearRange(entry.start_year, entry.end_year);
        const details = [period, degree].filter(Boolean).join(" · ");
        if (!school && !details) return null;
        return (
          <div key={index} className="text-sm">
            {school ? <div className="font-medium">{school}</div> : null}
            {details ? (
              <div className="text-muted-foreground text-xs">{details}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
