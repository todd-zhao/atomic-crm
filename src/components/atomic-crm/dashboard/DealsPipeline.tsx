import { DollarSign } from "lucide-react";
import { useGetIdentity, useGetList, useTranslate } from "ra-core";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { Card } from "@/components/ui/card";

import { SimpleList } from "../simple-list/SimpleList";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

/**
 * This component displays the deals pipeline for the current user, grouped by
 * board status like the Kanban board (potential, active, won; exited deals are
 * left out as they no longer bring revenue).
 */
export const DealsPipeline = () => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const { dealStatuses, currency } = useConfigurationContext();
  const { data, total, isPending } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "updated_at", order: "DESC" },
      filter: { "status@neq": "exited", sales_id: identity?.id },
    },
    { enabled: Number.isInteger(identity?.id) },
  );

  const getOrderedDeals = (data?: Deal[]): Deal[] | undefined => {
    if (!data) {
      return;
    }
    const deals: Deal[] = [];
    dealStatuses
      .filter((status) => status.value !== "exited")
      .forEach((status) =>
        data
          .filter((deal) => deal.status === status.value)
          .forEach((deal) => deals.push(deal)),
      );
    return deals;
  };

  const statusLabel = (deal: Deal) =>
    dealStatuses.find((status) => status.value === deal.status)?.label ??
    deal.status;

  return (
    <>
      <div className="flex items-center mb-4">
        <div className="ml-8 mr-8 flex">
          <DollarSign className="text-muted-foreground w-6 h-6" />
        </div>
        <Link
          className="text-xl font-semibold text-muted-foreground hover:underline"
          to="/deals"
        >
          {translate("crm.dashboard.deals_pipeline")}
        </Link>
      </div>
      <Card>
        <SimpleList<Deal>
          resource="deals"
          linkType="show"
          data={getOrderedDeals(data)}
          total={total}
          isPending={isPending}
          primaryText={(deal) => deal.name}
          secondaryText={(deal) =>
            `${(deal.budget ?? deal.final_amount ?? 0).toLocaleString("en-US", {
              notation: "compact",
              style: "currency",
              currency,
              currencyDisplay: "narrowSymbol",
              minimumSignificantDigits: 3,
            })} , ${statusLabel(deal)}`
          }
          leftAvatar={(deal) => (
            <ReferenceField
              source="company_id"
              record={deal}
              reference="companies"
              resource="deals"
              link={false}
            >
              <CompanyAvatar width={20} height={20} />
            </ReferenceField>
          )}
        />
      </Card>
    </>
  );
};
