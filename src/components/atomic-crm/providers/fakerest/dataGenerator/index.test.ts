import { describe, expect, it } from "vitest";

import { createDataProvider } from "../dataProvider";
import generateData from "./index";

describe("generateData", () => {
  it("provides demo records for the competitors and deal subtables", async () => {
    const db = generateData();

    // DealShow maintains these subtables with getList, which would throw
    // "Unknown resource" against a database missing them.
    expect(db.competitors.length).toBeGreaterThan(0);
    expect(db.deal_contacts.length).toBeGreaterThan(0);
    expect(db.deal_pains.length).toBeGreaterThan(0);
    expect(db.deal_milestones.length).toBeGreaterThan(0);
    expect(db.deal_meetings.length).toBeGreaterThan(0);

    // Every deal subtable row belongs to a generated deal.
    const dealIds = new Set(db.deals.map((deal) => deal.id));
    for (const dealContact of db.deal_contacts) {
      expect(dealIds.has(dealContact.deal_id)).toBe(true);
    }

    const dataProvider = createDataProvider({ db, latency: 0, silent: true });
    const { total } = await dataProvider.getList("competitors", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "name", order: "ASC" },
    });
    expect(total).toBe(db.competitors.length);
  });

  it("generates both company directories and a populated lead pool", async () => {
    const db = generateData();

    // Hotels and channels share the companies table, split by company_kind.
    expect(
      db.companies.some((company) => company.company_kind === "hotel"),
    ).toBe(true);
    expect(
      db.companies.some((company) => company.company_kind === "channel"),
    ).toBe(true);

    // Deals reference channel companies and some of them have no owner.
    const channelIds = new Set(
      db.companies
        .filter((company) => company.company_kind === "channel")
        .map((company) => company.id),
    );
    const channelDeals = db.deals.filter(
      (deal) => deal.source_type === "channel" && deal.channel_id != null,
    );
    expect(channelDeals.length).toBeGreaterThan(0);
    for (const deal of channelDeals) {
      expect(channelIds.has(deal.channel_id!)).toBe(true);
    }

    expect(db.deals.some((deal) => deal.is_unassigned)).toBe(true);
    for (const deal of db.deals) {
      expect(deal.is_unassigned).toBe(deal.sales_id == null);
    }

    // The lead pool page queries this filter, so it must return the pool deals.
    const dataProvider = createDataProvider({ db, latency: 0, silent: true });
    const pool = await dataProvider.getList("deals", {
      filter: { is_unassigned: true },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "created_at", order: "DESC" },
    });
    expect(pool.total).toBe(
      db.deals.filter((deal) => deal.is_unassigned).length,
    );
  });
});
