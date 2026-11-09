/**
 * Shared choices for the competitor resource.
 *
 * The values are stored as-is in `competitors.brand_influence` and
 * `competitors.market_price`; the labels are i18n keys, which react-admin
 * translates automatically in the select inputs and fields.
 */
export const competitorLevelChoices = [
  { id: "high", name: "resources.competitors.levels.high" },
  { id: "medium", name: "resources.competitors.levels.medium" },
  { id: "low", name: "resources.competitors.levels.low" },
];
