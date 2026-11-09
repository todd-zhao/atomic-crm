import { Create } from "@/components/admin/create";
import { SimpleForm } from "@/components/admin/simple-form";

import { CompetitorInputs } from "./CompetitorInputs";

export function CompetitorCreate() {
  return (
    <Create>
      <SimpleForm>
        <CompetitorInputs />
      </SimpleForm>
    </Create>
  );
}
