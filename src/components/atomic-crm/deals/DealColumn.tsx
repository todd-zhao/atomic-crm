import { Droppable } from "@hello-pangea/dnd";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { ColorDot } from "./DealBadges";
import { DealCard } from "./DealCard";
import { findDealStatus, formatDealAmount } from "./dealUtils";

export const DealColumn = ({
  status,
  deals,
}: {
  /** Board status value (potential / active / won / exited). */
  status: string;
  deals: Deal[];
}) => {
  const { dealStatuses, currency } = useConfigurationContext();
  const statusOption = findDealStatus(dealStatuses, status);
  const totalBudget = deals.reduce((sum, deal) => sum + (deal.budget ?? 0), 0);

  return (
    <div
      className="flex min-w-60 flex-1 flex-col pb-8"
      data-testid={`deal-column-${status}`}
    >
      <div
        className="flex flex-col items-center gap-1 border-b-2 px-3 pb-2"
        style={{
          borderColor: statusOption?.color ?? "transparent",
        }}
      >
        <h3 className="flex items-center gap-2 text-base font-medium">
          <ColorDot color={statusOption?.color} />
          {statusOption?.label ?? status}
        </h3>
        <p className="text-sm text-muted-foreground">
          {deals.length} · {formatDealAmount(totalBudget, currency)}
        </p>
      </div>
      <Droppable droppableId={status}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={`flex flex-col rounded-2xl mt-2 gap-2 min-h-16 ${
              snapshot.isDraggingOver ? "bg-muted" : ""
            }`}
          >
            {deals.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} index={index} />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
