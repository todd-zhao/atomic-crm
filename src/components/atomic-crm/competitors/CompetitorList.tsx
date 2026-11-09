import { CreateButton } from "@/components/admin/create-button";
import { DataTable } from "@/components/admin/data-table";
import { EditButton } from "@/components/admin/edit-button";
import { List } from "@/components/admin/list";
import { SelectField } from "@/components/admin/select-field";

import { TopToolbar } from "../layout/TopToolbar";
import { competitorLevelChoices } from "./competitorModel";

const CompetitorListActions = () => (
  <TopToolbar>
    <CreateButton />
  </TopToolbar>
);

export function CompetitorList() {
  return (
    <List
      actions={<CompetitorListActions />}
      sort={{ field: "name", order: "ASC" }}
    >
      <DataTable>
        <DataTable.Col source="name" />
        <DataTable.Col source="brand_influence">
          <SelectField
            source="brand_influence"
            choices={competitorLevelChoices}
          />
        </DataTable.Col>
        <DataTable.Col source="market_price">
          <SelectField source="market_price" choices={competitorLevelChoices} />
        </DataTable.Col>
        <DataTable.Col source="advantages" />
        <DataTable.Col source="weaknesses" />
        <DataTable.Col label={false}>
          <EditButton />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}
