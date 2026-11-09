import {
  useCanAccess,
  useGetIdentity,
  useListContext,
  useTranslate,
} from "ra-core";
import { Inbox } from "lucide-react";
import { Link, matchPath, useLocation } from "react-router";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ReferenceInput } from "@/components/admin/reference-input";
import { FilterButton } from "@/components/admin/filter-form";
import { SearchInput } from "@/components/admin/search-input";
import { SelectInput } from "@/components/admin/select-input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DataImportButton } from "../dataImport/DataImportButton";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { TopToolbar } from "../layout/TopToolbar";
import { AccountManagerInput } from "../sales/AccountManagerInput";
import { DealArchivedList } from "./DealArchivedList";
import { DEALS_POOL_PATH } from "./dealUtils";
import { DealCreate } from "./DealCreate";
import { DealEdit } from "./DealEdit";
import { DealEmpty } from "./DealEmpty";
import { DealListContent } from "./DealListContent";
import { DealShow } from "./DealShow";
import { OnlyMineInput } from "./OnlyMineInput";

const DealList = () => {
  const { identity } = useGetIdentity();
  const { dealStatuses, dealStages, dealTypes } = useConfigurationContext();
  const translate = useTranslate();
  const { canAccess: canAccessSalesList, isPending } = useCanAccess({
    resource: "sales",
    action: "list",
  });

  if (!identity) return null;

  const dealFilters = [
    <SearchInput source="q" alwaysOn />,
    <ReferenceInput source="company_id" reference="companies">
      <AutocompleteInput
        label={false}
        placeholder={translate("resources.deals.fields.company_id")}
      />
    </ReferenceInput>,
    <SelectInput
      source="status"
      choices={dealStatuses}
      optionText="label"
      optionValue="value"
      label="resources.deals.fields.status"
      helperText={false}
    />,
    <SelectInput
      source="stage"
      choices={dealStages}
      optionText="label"
      optionValue="value"
      label="resources.deals.fields.stage"
      helperText={false}
    />,
    <SelectInput
      source="deal_type"
      choices={dealTypes}
      optionText="label"
      optionValue="value"
      label="resources.deals.fields.deal_type"
      helperText={false}
    />,
    <ReferenceInput source="competitor_id" reference="competitors">
      <AutocompleteInput
        label={false}
        placeholder={translate("resources.deals.fields.competitor_id")}
      />
    </ReferenceInput>,
    ...(isPending
      ? []
      : [
          canAccessSalesList ? (
            <AccountManagerInput source="sales_id" alwaysOn />
          ) : (
            <OnlyMineInput source="sales_id" alwaysOn />
          ),
        ]),
  ];

  return (
    <List
      perPage={100}
      // The board only shows owned deals: unassigned deals wait in the pool.
      filter={{ "archived_at@is": null, "is_unassigned@eq": false }}
      title={false}
      sort={{ field: "index", order: "DESC" }}
      filters={dealFilters}
      actions={<DealActions />}
      pagination={null}
    >
      <DealLayout />
    </List>
  );
};

const DealLayout = () => {
  const location = useLocation();
  const matchCreate = matchPath("/deals/create", location.pathname);
  const matchShow = matchPath("/deals/:id/show", location.pathname);
  const matchEdit = matchPath("/deals/:id", location.pathname);

  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters)
    return (
      <>
        <DealEmpty>
          <DealShow open={!!matchShow} id={matchShow?.params.id} />
          <DealArchivedList />
        </DealEmpty>
      </>
    );

  return (
    <div className="w-full">
      <DealListContent />
      <DealArchivedList />
      <DealCreate open={!!matchCreate} />
      <DealEdit open={!!matchEdit && !matchCreate} id={matchEdit?.params.id} />
      <DealShow open={!!matchShow} id={matchShow?.params.id} />
    </div>
  );
};

const DealActions = () => {
  const translate = useTranslate();
  return (
    <TopToolbar>
      <FilterButton />
      <DataImportButton resource="deals" />
      <ExportButton />
      <Link
        to={DEALS_POOL_PATH}
        className={cn(buttonVariants({ variant: "outline" }), "h-9")}
      >
        <Inbox className="size-4" />
        {translate("crm.navigation.deals_pool")}
      </Link>
      <CreateButton label="resources.deals.action.new" />
    </TopToolbar>
  );
};

export default DealList;
