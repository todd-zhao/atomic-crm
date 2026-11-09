import type { Deal, DealStatus } from "../types";

/** Deals grouped by board status (potential / active / won / exited). */
export type DealsByStatus = Record<string, Deal[]>;

/**
 * Groups deals into one column per configured status, sorted by their `index`.
 *
 * A deal whose status does not exist in the configuration (e.g. an old record
 * saved before the status field was introduced) falls back to the first status,
 * so that it never disappears from the board.
 */
export const getDealsByStatus = (
  unorderedDeals: Deal[],
  dealStatuses: DealStatus[],
): DealsByStatus => {
  if (!dealStatuses?.length) return {};
  const fallbackStatus = dealStatuses[0].value;
  const dealsByStatus = dealStatuses.reduce<DealsByStatus>((acc, status) => {
    acc[status.value] = [];
    return acc;
  }, {});

  for (const deal of unorderedDeals) {
    const status = dealStatuses.some((option) => option.value === deal.status)
      ? deal.status
      : fallbackStatus;
    dealsByStatus[status].push(deal);
  }

  for (const status of dealStatuses) {
    dealsByStatus[status.value].sort(
      (recordA, recordB) => (recordA.index ?? 0) - (recordB.index ?? 0),
    );
  }

  return dealsByStatus;
};
