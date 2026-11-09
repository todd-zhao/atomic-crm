import { datatype, lorem } from "faker/locale/en_US";

import type { DealMilestone } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

/** One or two key events on the decision timeline of each generated deal. */
export const generateDealMilestones = (db: Db): DealMilestone[] => {
  const milestones: DealMilestone[] = [];
  db.deals.forEach((deal) => {
    Array.from(Array(datatype.number({ min: 0, max: 2 })).keys()).forEach(
      (index) => {
        milestones.push({
          id: milestones.length,
          deal_id: deal.id,
          event: lorem.words(datatype.number({ min: 2, max: 5 })),
          date: randomDate(new Date(deal.created_at))
            .toISOString()
            .split("T")[0],
          index,
        });
      },
    );
  });
  return milestones;
};
