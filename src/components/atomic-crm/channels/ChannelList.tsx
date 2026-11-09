import { Plus } from "lucide-react";
import { LinkBase, useTranslate, type Identifier } from "ra-core";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/admin/data-table";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SearchInput } from "@/components/admin/search-input";
import { SortButton } from "@/components/admin/sort-button";

import {
  ChannelTypeLabel,
  CompanyKindBadge,
  CompanySectorLabel,
} from "../companies/CompanyBadges";
import {
  companyShowPath,
  companyKindBasePath,
} from "../companies/companyKindPaths";
import { TopToolbar } from "../layout/TopToolbar";
import { useGetSalesName } from "../sales/useGetSalesName";
import type { Company } from "../types";

const filters = [<SearchInput source="q" alwaysOn />];

export const ChannelList = () => {
  const translate = useTranslate();

  return (
    <List
      resource="companies"
      title={translate("crm.channels.title", { _: "Channel directory" })}
      // Channels only: a permanent filter wins over the filter bar, so the
      // channel directory can never list hotels.
      filter={{ company_kind: "channel" }}
      storeKey="channelsDirectory"
      perPage={25}
      sort={{ field: "name", order: "ASC" }}
      filters={filters}
      actions={<ChannelListActions />}
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
    >
      <DataTable
        bulkActionButtons={false}
        rowClick={(_id, _resource, record) =>
          companyShowPath(record as Company)
        }
      >
        <DataTable.Col
          source="name"
          label={translate("resources.companies.fields.name")}
        />
        <DataTable.Col
          source="company_kind"
          render={(record: Company) => (
            <CompanyKindBadge kind={record.company_kind} />
          )}
        />
        <DataTable.Col
          source="channel_type"
          render={(record: Company) => (
            <ChannelTypeLabel channelType={record.channel_type} />
          )}
        />
        <DataTable.Col
          source="sector"
          render={(record: Company) => (
            <CompanySectorLabel sector={record.sector} />
          )}
        />
        <DataTable.Col
          source="city"
          label={translate("resources.companies.fields.city")}
        />
        <DataTable.NumberCol
          source="nb_contacts"
          label={translate("resources.companies.fields.nb_contacts")}
        />
        <DataTable.NumberCol
          source="nb_deals"
          label={translate("resources.companies.fields.nb_deals", {
            _: "Deals",
          })}
        />
        <DataTable.Col
          source="sales_id"
          label={translate("resources.deals.fields.sales_id")}
          render={(record: Company) => <SalesName salesId={record.sales_id} />}
        />
      </DataTable>
    </List>
  );
};

ChannelList.path = companyKindBasePath("channel");

const SalesName = ({ salesId }: { salesId?: Identifier }) => {
  const salesName = useGetSalesName(salesId, { enabled: salesId != null });
  return <>{salesName}</>;
};

const ChannelListActions = () => {
  const translate = useTranslate();
  return (
    <TopToolbar>
      <SortButton fields={["name", "created_at", "nb_contacts"]} />
      <ExportButton />
      <LinkBase
        to={`${companyKindBasePath("channel")}/create`}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        <Plus />
        {translate("crm.channels.new", { _: "New channel" })}
      </LinkBase>
    </TopToolbar>
  );
};
