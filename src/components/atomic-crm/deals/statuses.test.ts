import { describe, expect, it } from "vitest";

import {
  defaultDealStatuses,
  defaultDealStages,
} from "../root/defaultConfiguration";
import type { Deal } from "../types";
import { getDealsByStatus } from "./statuses";

const buildDeal = (overrides: Partial<Deal>): Deal =>
  ({
    id: 1,
    name: "Deal",
    company_id: 1,
    stage: "contact",
    status: "potential",
    created_at: "2025-01-01T09:00:00.000Z",
    updated_at: "2025-01-01T09:00:00.000Z",
    index: 0,
    ...overrides,
  }) as Deal;

describe("getDealsByStatus", () => {
  it("creates one column per configured status", () => {
    const grouped = getDealsByStatus([], defaultDealStatuses);
    expect(Object.keys(grouped)).toEqual(
      defaultDealStatuses.map((status) => status.value),
    );
    expect(Object.values(grouped).every((column) => column.length === 0)).toBe(
      true,
    );
  });

  it("groups deals by status and sorts each column by index", () => {
    const deals = [
      buildDeal({ id: 1, status: "active", index: 2 }),
      buildDeal({ id: 2, status: "potential", index: 1 }),
      buildDeal({ id: 3, status: "active", index: 0 }),
    ];
    const grouped = getDealsByStatus(deals, defaultDealStatuses);

    expect(grouped.active.map((deal) => deal.id)).toEqual([3, 1]);
    expect(grouped.potential.map((deal) => deal.id)).toEqual([2]);
    expect(grouped.won).toEqual([]);
  });

  it("falls back to the first status for an unknown or missing status", () => {
    const deals = [
      buildDeal({ id: 1, status: "opportunity" }),
      buildDeal({ id: 2, status: undefined as unknown as string }),
    ];
    const grouped = getDealsByStatus(deals, defaultDealStatuses);

    expect(
      grouped[defaultDealStatuses[0].value].map((deal) => deal.id),
    ).toEqual([1, 2]);
  });

  it("returns no column when no status is configured", () => {
    expect(getDealsByStatus([buildDeal({})], [])).toEqual({});
  });

  it("works with the default Sandler stages as a cross-check", () => {
    // The board groups by status, but the stage config is what colors active
    // deals: it must stay a 6-value Sandler pipeline.
    expect(defaultDealStages).toHaveLength(6);
  });
});
