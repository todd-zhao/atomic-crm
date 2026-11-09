import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import { useDataProvider, useListContext, type DataProvider } from "ra-core";
import { useEffect, useState } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { DealColumn } from "./DealColumn";
import type { DealsByStatus } from "./statuses";
import { getDealsByStatus } from "./statuses";

/**
 * Kanban board grouped by deal *status* (potential / active / won / exited).
 * Dragging a card between columns changes its status; dragging inside a column
 * reorders its `index`, exactly as the former stage-based board did.
 */
export const DealListContent = () => {
  const { dealStatuses } = useConfigurationContext();
  const { data: unorderedDeals, isPending, refetch } = useListContext<Deal>();
  const dataProvider = useDataProvider();

  const [dealsByStatus, setDealsByStatus] = useState<DealsByStatus>(
    getDealsByStatus([], dealStatuses),
  );

  useEffect(() => {
    if (unorderedDeals) {
      const newDealsByStatus = getDealsByStatus(unorderedDeals, dealStatuses);
      if (!isEqual(newDealsByStatus, dealsByStatus)) {
        setDealsByStatus(newDealsByStatus);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unorderedDeals]);

  if (isPending) return null;

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceStatus = source.droppableId;
    const destinationStatus = destination.droppableId;
    const sourceDeal = dealsByStatus[sourceStatus][source.index]!;
    const destinationDeal = dealsByStatus[destinationStatus][
      destination.index
    ] ?? {
      status: destinationStatus,
      index: undefined, // undefined if dropped after the last item
    };

    // compute local state change synchronously
    setDealsByStatus(
      updateDealStatusLocal(
        sourceDeal,
        { status: sourceStatus, index: source.index },
        { status: destinationStatus, index: destination.index },
        dealsByStatus,
      ),
    );

    // persist the changes
    updateDealStatus(sourceDeal, destinationDeal, dataProvider).then(() => {
      refetch();
    });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {dealStatuses.map((status) => (
          <DealColumn
            status={status.value}
            deals={dealsByStatus[status.value]}
            key={status.value}
          />
        ))}
      </div>
    </DragDropContext>
  );
};

const updateDealStatusLocal = (
  sourceDeal: Deal,
  source: { status: string; index: number },
  destination: {
    status: string;
    index?: number; // undefined if dropped after the last item
  },
  dealsByStatus: DealsByStatus,
) => {
  if (source.status === destination.status) {
    // moving deal inside the same column
    const column = dealsByStatus[source.status];
    column.splice(source.index, 1);
    column.splice(destination.index ?? column.length + 1, 0, sourceDeal);
    return {
      ...dealsByStatus,
      [destination.status]: column,
    };
  } else {
    // moving deal across columns
    const sourceColumn = dealsByStatus[source.status];
    const destinationColumn = dealsByStatus[destination.status];
    sourceColumn.splice(source.index, 1);
    destinationColumn.splice(
      destination.index ?? destinationColumn.length + 1,
      0,
      sourceDeal,
    );
    return {
      ...dealsByStatus,
      [source.status]: sourceColumn,
      [destination.status]: destinationColumn,
    };
  }
};

const updateDealStatus = async (
  source: Deal,
  destination: {
    status: string;
    index?: number; // undefined if dropped after the last item
  },
  dataProvider: DataProvider,
) => {
  if (source.status === destination.status) {
    // moving deal inside the same column
    // Fetch all the deals in this status (because the list may be filtered, but we need to update even non-filtered deals)
    const { data: columnDeals } = await dataProvider.getList("deals", {
      sort: { field: "index", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
      filter: {
        status: source.status,
        "archived_at@is": null,
        "is_unassigned@eq": false,
      },
    });
    const destinationIndex = destination.index ?? columnDeals.length + 1;

    if (source.index > destinationIndex) {
      // deal moved up, eg
      // dest   src
      //  <------
      // [4, 7, 23, 5]
      await Promise.all([
        // for all deals between destinationIndex and source.index, increase the index
        ...columnDeals
          .filter(
            (deal) =>
              deal.index >= destinationIndex && deal.index < source.index,
          )
          .map((deal) =>
            dataProvider.update("deals", {
              id: deal.id,
              data: { index: deal.index + 1 },
              previousData: deal,
            }),
          ),
        // for the deal that was moved, update its index
        dataProvider.update("deals", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
        }),
      ]);
    } else {
      // deal moved down, e.g
      // src   dest
      //  ------>
      // [4, 7, 23, 5]
      await Promise.all([
        // for all deals between source.index and destinationIndex, decrease the index
        ...columnDeals
          .filter(
            (deal) =>
              deal.index <= destinationIndex && deal.index > source.index,
          )
          .map((deal) =>
            dataProvider.update("deals", {
              id: deal.id,
              data: { index: deal.index - 1 },
              previousData: deal,
            }),
          ),
        // for the deal that was moved, update its index
        dataProvider.update("deals", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
        }),
      ]);
    }
  } else {
    // moving deal across columns
    // Fetch all the deals in both statuses (because the list may be filtered, but we need to update even non-filtered deals)
    const [{ data: sourceDeals }, { data: destinationDeals }] =
      await Promise.all([
        dataProvider.getList("deals", {
          sort: { field: "index", order: "ASC" },
          pagination: { page: 1, perPage: 100 },
          filter: {
            status: source.status,
            "archived_at@is": null,
            "is_unassigned@eq": false,
          },
        }),
        dataProvider.getList("deals", {
          sort: { field: "index", order: "ASC" },
          pagination: { page: 1, perPage: 100 },
          filter: {
            status: destination.status,
            "archived_at@is": null,
            "is_unassigned@eq": false,
          },
        }),
      ]);
    const destinationIndex = destination.index ?? destinationDeals.length + 1;

    await Promise.all([
      // decrease index on the deals after the source index in the source columns
      ...sourceDeals
        .filter((deal) => deal.index > source.index)
        .map((deal) =>
          dataProvider.update("deals", {
            id: deal.id,
            data: { index: deal.index - 1 },
            previousData: deal,
          }),
        ),
      // increase index on the deals after the destination index in the destination columns
      ...destinationDeals
        .filter((deal) => deal.index >= destinationIndex)
        .map((deal) =>
          dataProvider.update("deals", {
            id: deal.id,
            data: { index: deal.index + 1 },
            previousData: deal,
          }),
        ),
      // change the dragged deal to take the destination index and column
      dataProvider.update("deals", {
        id: source.id,
        data: {
          index: destinationIndex,
          status: destination.status,
        },
        previousData: source,
      }),
    ]);
  }
};
