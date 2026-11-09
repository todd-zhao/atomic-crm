import { lorem, random } from "faker/locale/en_US";

import type { Competitor } from "../../../types";
import type { Db } from "./types";

const competitorNames = [
  "Acme Hospitality",
  "Blue Sky Hotels",
  "Grand Vista Group",
  "Harbor Suites",
  "Metro Lodging",
  "Pacific Resorts",
];

/** Demo competitors, referenced by the generated deals. */
export const generateCompetitors = (db: Db): Competitor[] =>
  competitorNames.map((name, index) => ({
    id: index,
    name,
    brand_influence: random.arrayElement(["high", "medium", "low"]),
    market_price: random.arrayElement(["high", "medium", "low"]),
    advantages: lorem.sentence(),
    weaknesses: lorem.sentence(),
    created_at: new Date().toISOString(),
    sales_id: db.sales?.[index % (db.sales.length || 1)]?.id,
  }));
