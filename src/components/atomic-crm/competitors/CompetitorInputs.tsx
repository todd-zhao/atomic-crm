import { required } from "ra-core";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";

import { competitorLevelChoices } from "./competitorModel";

/** Fields of a competitor: the four corners of the competitor information table. */
export function CompetitorInputs() {
  return (
    <div className="space-y-4 w-full">
      <TextInput source="name" validate={required()} helperText={false} />
      <SelectInput
        source="brand_influence"
        choices={competitorLevelChoices}
        helperText={false}
      />
      <SelectInput
        source="market_price"
        choices={competitorLevelChoices}
        helperText={false}
      />
      <TextInput source="advantages" multiline rows={4} helperText={false} />
      <TextInput source="weaknesses" multiline rows={4} helperText={false} />
    </div>
  );
}
