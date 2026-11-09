import { Edit } from "@/components/admin/edit";
import { SimpleForm } from "@/components/admin/simple-form";

import { CompetitorInputs } from "./CompetitorInputs";

export function CompetitorEdit() {
  return (
    <Edit>
      <SimpleForm>
        <CompetitorInputs />
      </SimpleForm>
    </Edit>
  );
}
