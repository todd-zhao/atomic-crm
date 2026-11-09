import { RecordField } from "@/components/admin/record-field";
import { SelectField } from "@/components/admin/select-field";
import { Show } from "@/components/admin/show";

import { competitorLevelChoices } from "./competitorModel";

export function CompetitorShow() {
  return (
    <Show>
      <div className="flex flex-col gap-4">
        <RecordField source="name" />
        <RecordField source="brand_influence">
          <SelectField
            source="brand_influence"
            choices={competitorLevelChoices}
          />
        </RecordField>
        <RecordField source="market_price">
          <SelectField source="market_price" choices={competitorLevelChoices} />
        </RecordField>
        <RecordField source="advantages" />
        <RecordField source="weaknesses" />
      </div>
    </Show>
  );
}
