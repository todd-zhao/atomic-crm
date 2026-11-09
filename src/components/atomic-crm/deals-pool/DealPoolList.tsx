import { Inbox, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  RecordContextProvider,
  useDataProvider,
  useGetIdentity,
  useGetList,
  useNotify,
  useRefresh,
  useTranslate,
  type Identifier,
} from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

import {
  findDealSource,
  formatDealAmount,
  formatDealDate,
} from "../deals/dealUtils";
import { DEALS_POOL_PATH } from "../deals/dealUtils";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

/**
 * Lead pool: deals without a sales owner. Anyone can claim a deal, which makes
 * the current user its owner and removes it from the pool (and adds it to the
 * board, which only lists assigned deals).
 *
 * Lead registers the route in CRM.tsx:
 *   import { DealPoolList } from "../deals-pool/DealPoolList";
 *   <Route path={DealPoolList.path} element={<DealPoolList />} />
 */
export const DealPoolList = () => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const { identity } = useGetIdentity();
  const { dealSources, currency } = useConfigurationContext();
  const [claimingId, setClaimingId] = useState<Identifier | null>(null);

  const { data, isPending, isError, refetch } = useGetList<Deal>("deals", {
    filter: { "is_unassigned@eq": true, "archived_at@is": null },
    sort: { field: "created_at", order: "DESC" },
    pagination: { page: 1, perPage: 100 },
  });

  const handleClaim = async (deal: Deal) => {
    if (identity?.id == null || claimingId != null) return;
    setClaimingId(deal.id);
    try {
      await dataProvider.update("deals", {
        id: deal.id,
        data: { sales_id: identity.id },
        previousData: deal,
      });
      notify("crm.pool.claimed", { type: "info", undoable: false });
      refresh();
      await refetch();
    } catch {
      notify("crm.pool.claim_error", { type: "error" });
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="mt-4 space-y-4" data-testid="deal-pool-page">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {translate("crm.pool.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate("crm.pool.description")}
        </p>
      </div>

      {isPending ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            {translate("ra.notification.http_error")}
          </CardContent>
        </Card>
      ) : !data?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Inbox className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {translate("crm.pool.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((deal) => {
            const source = findDealSource(dealSources, deal.source_type);
            return (
              <RecordContextProvider key={deal.id} value={deal}>
                <Card
                  size="sm"
                  data-testid={`pool-deal-${deal.id}`}
                  className="flex-col items-stretch justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {deal.name}
                      </p>
                      {source ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[0.7rem] text-muted-foreground">
                          {source.label}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {translate("resources.deals.fields.company_id")}:{" "}
                        <ReferenceField
                          source="company_id"
                          reference="companies"
                          link="show"
                        />
                      </span>
                      {deal.source_type === "channel" &&
                      deal.channel_id != null ? (
                        <span>
                          {translate("resources.deals.fields.channel_id")}:{" "}
                          <ReferenceField
                            source="channel_id"
                            reference="companies"
                            link={false}
                          />
                        </span>
                      ) : null}
                      <span>
                        {translate("resources.deals.fields.budget")}:{" "}
                        {deal.budget != null
                          ? formatDealAmount(deal.budget, currency)
                          : "—"}
                      </span>
                      <span>
                        {translate(
                          "resources.deals.fields.expected_closing_date",
                        )}
                        :{" "}
                        {deal.expected_closing_date
                          ? formatDealDate(deal.expected_closing_date)
                          : "—"}
                      </span>
                      <span>
                        {translate("resources.deals.fields.created_at")}:{" "}
                        {formatDealDate(deal.created_at)}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0"
                    disabled={claimingId != null}
                    onClick={() => void handleClaim(deal)}
                    data-testid={`pool-claim-${deal.id}`}
                  >
                    {claimingId === deal.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {translate("crm.pool.claim")}
                  </Button>
                </Card>
              </RecordContextProvider>
            );
          })}
        </div>
      )}
    </div>
  );
};

DealPoolList.path = DEALS_POOL_PATH;
