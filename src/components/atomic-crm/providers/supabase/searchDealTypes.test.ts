import type { DataProvider, GetListParams } from "ra-core";
import { describe, expect, it } from "vitest";

import { searchDealTypes } from "./searchDealTypes";

const dataProviderWithConfig = (config: object) =>
  ({
    getOne: async () => ({ data: { id: 1, config } }),
  }) as unknown as DataProvider;

const searchParams: GetListParams = {
  filter: { "@or": { "name@ilike": "design" } },
};

describe("searchDealTypes", () => {
  it("adds the deal types whose label or value matches a search word", async () => {
    const dataProvider = dataProviderWithConfig({
      dealTypes: [
        { value: "new", label: "New purchase" },
        { value: "renewal", label: "Renewal" },
        { value: "upsell", label: "Renew business" },
      ],
    });

    const result = await searchDealTypes(searchParams, "renew", dataProvider);

    expect(result.filter["@or"]).toEqual({
      "name@ilike": "design",
      "deal_type@in": '("renewal","upsell")',
    });
  });

  it("matches a localized deal type label", async () => {
    const dataProvider = dataProviderWithConfig({
      dealTypes: [{ value: "new", label: "新购" }],
    });

    const result = await searchDealTypes(searchParams, "新购", dataProvider);

    expect(result.filter["@or"]["deal_type@in"]).toBe('("new")');
  });

  it("falls back to the default deal types when none are configured", async () => {
    const result = await searchDealTypes(
      searchParams,
      "upsell",
      dataProviderWithConfig({}),
    );

    expect(result.filter["@or"]["deal_type@in"]).toBe('("upsell")');
  });

  it("leaves the search unchanged when no deal type matches", async () => {
    const result = await searchDealTypes(
      searchParams,
      "acme",
      dataProviderWithConfig({}),
    );

    expect(result).toBe(searchParams);
  });
});
