import { Draggable } from "@hello-pangea/dnd";
import { RecordContextProvider, useRedirect, useTranslate } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { DealStageBadge } from "./DealBadges";
import {
  findDealSource,
  findDealStage,
  findDealType,
  formatDealAmount,
  getDealReferenceDate,
} from "./dealUtils";

export const DealCard = ({ deal, index }: { deal: Deal; index: number }) => {
  if (!deal) return null;

  return (
    <Draggable draggableId={String(deal.id)} index={index}>
      {(provided, snapshot) => (
        <DealCardContent provided={provided} snapshot={snapshot} deal={deal} />
      )}
    </Draggable>
  );
};

export const DealCardContent = ({
  provided,
  snapshot,
  deal,
  draggable = true,
}: {
  provided?: any;
  snapshot?: any;
  deal: Deal;
  /** Archived cards are not part of the board and must not look draggable. */
  draggable?: boolean;
}) => {
  const { dealSources, dealStages, dealTypes, currency } =
    useConfigurationContext();
  const translate = useTranslate();
  const redirect = useRedirect();
  const handleClick = () => {
    redirect(`/deals/${deal.id}/show`, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  // A won deal shows what was actually signed; the others show the budget.
  const amount =
    deal.status === "won" && deal.final_amount != null
      ? deal.final_amount
      : deal.budget;
  const type = findDealType(dealTypes, deal.deal_type);
  const source = findDealSource(dealSources, deal.source_type);
  const stage = findDealStage(dealStages, deal.stage);
  const referenceDate = getDealReferenceDate(deal);
  const isUnassigned = deal.sales_id == null;

  return (
    <div
      className="cursor-pointer"
      {...(draggable ? provided?.draggableProps : undefined)}
      {...(draggable ? provided?.dragHandleProps : undefined)}
      ref={draggable ? provided?.innerRef : undefined}
      onClick={handleClick}
    >
      <RecordContextProvider value={deal}>
        <Card
          data-testid={`deal-card-${deal.id}`}
          className={`gap-2 py-3 transition-all duration-200 ${
            snapshot?.isDragging
              ? "opacity-90 transform rotate-1 shadow-lg"
              : "shadow-sm hover:shadow-md"
          }`}
        >
          <CardContent className="px-3 flex flex-col gap-1.5">
            <div className="flex-1 flex">
              <p className="flex-1 text-sm font-medium">
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  link={false}
                />
                {" - "}
                {deal.name}
              </p>
              <ReferenceField
                source="company_id"
                reference="companies"
                link={false}
              >
                <CompanyAvatar width={20} height={20} />
              </ReferenceField>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {source ? <span>{source.label}</span> : null}
              {type ? <span>{type.label}</span> : null}
              {amount != null ? (
                <span className="font-medium text-foreground/80">
                  {formatDealAmount(amount, currency)}
                </span>
              ) : null}
              {referenceDate ? <span>{referenceDate}</span> : null}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {isUnassigned ? (
                <Badge variant="secondary">
                  {translate("crm.pool.unassigned")}
                </Badge>
              ) : (
                <ReferenceField
                  source="sales_id"
                  reference="sales"
                  link={false}
                />
              )}
            </div>
            {deal.status === "active" ? <DealStageBadge stage={stage} /> : null}
          </CardContent>
        </Card>
      </RecordContextProvider>
    </div>
  );
};
