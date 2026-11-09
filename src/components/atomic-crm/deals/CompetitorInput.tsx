import { useEffect, useState } from "react";
import { useDataProvider, useTranslate } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";

/**
 * Optional competitor selector. Competitors are a standalone entity: when none
 * exists yet, the field is still rendered (and empty) with a hint inviting the
 * user to create one from the Competitors page.
 */
export const CompetitorInput = () => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const [competitorCount, setCompetitorCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { total } = await dataProvider.getList("competitors", {
          pagination: { page: 1, perPage: 1 },
        });
        if (!cancelled) setCompetitorCount(total ?? 0);
      } catch {
        // The competitors resource may not be registered yet: treat it as empty
        // rather than breaking the deal form.
        if (!cancelled) setCompetitorCount(0);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [dataProvider]);

  return (
    <div className="space-y-1">
      <ReferenceInput source="competitor_id" reference="competitors">
        <AutocompleteInput
          label="resources.deals.fields.competitor_id"
          helperText={false}
          placeholder={translate("resources.deals.fields.competitor_id")}
          modal
          clearable
        />
      </ReferenceInput>
      {competitorCount === 0 && (
        <p className="text-xs text-muted-foreground">
          {translate("resources.competitors.empty.title")} —{" "}
          {translate("resources.competitors.action.create")}
        </p>
      )}
    </div>
  );
};
