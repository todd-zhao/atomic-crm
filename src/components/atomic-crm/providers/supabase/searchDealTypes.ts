import type { DataProvider, GetListParams } from "ra-core";

import { defaultDealTypes } from "../../root/defaultConfiguration";
import type { LabeledValue } from "../../types";

/**
 * The deal list search box matches its words against the deal name and
 * description with ilike. Deal types are stored by value (e.g. "new"), while
 * users type the configured label (e.g. "New purchase" or "新购"): the matching
 * type values are added to the full-text search as a `deal_type` filter.
 */
export const searchDealTypes = async (
  params: GetListParams,
  q: string | undefined,
  dataProvider: DataProvider,
): Promise<GetListParams> => {
  if (!q) return params;
  const { data } = await dataProvider.getOne("configuration", { id: 1 });
  const dealTypes: LabeledValue[] = data?.config?.dealTypes ?? defaultDealTypes;
  const words = q.toLowerCase().trim().split(/\s+/);
  const matches = dealTypes.filter(({ value, label }) =>
    words.some(
      (word) =>
        value.toLowerCase().includes(word) ||
        label.toLowerCase().includes(word),
    ),
  );
  if (matches.length === 0) return params;
  return {
    ...params,
    filter: {
      ...params.filter,
      "@or": {
        ...params.filter["@or"],
        "deal_type@in": `(${matches.map(({ value }) => `"${value}"`).join(",")})`,
      },
    },
  };
};
