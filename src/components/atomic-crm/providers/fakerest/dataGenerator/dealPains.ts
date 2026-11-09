import { datatype, lorem } from "faker/locale/en_US";

import type { DealPain } from "../../../types";
import type { Db } from "./types";

/** One or two pains per generated deal, like a Sandler pain sheet. */
export const generateDealPains = (db: Db): DealPain[] => {
  const pains: DealPain[] = [];
  db.deals.forEach((deal) => {
    Array.from(Array(datatype.number({ min: 0, max: 2 })).keys()).forEach(
      (index) => {
        pains.push({
          id: pains.length,
          deal_id: deal.id,
          symptom: lorem.sentence(),
          cause: lorem.sentence(),
          duration: `${datatype.number({ min: 1, max: 24 })} months`,
          quantified_loss: `$${datatype.number({ min: 1000, max: 100000 })}`,
          index,
        });
      },
    );
  });
  return pains;
};
