import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { StoryWrapper, buildCompany, buildDeal } from "@/test/StoryWrapper";
import type { Db } from "@/components/atomic-crm/providers/fakerest/dataGenerator/types";
import { DealPoolList } from "../deals-pool/DealPoolList";

const data = {
  companies: [
    buildCompany({ id: 1, name: "Acme Hotel", company_kind: "hotel" }),
    buildCompany({ id: 2, name: "Globex OTA", company_kind: "channel" }),
  ],
  deals: [
    buildDeal({
      id: 1,
      name: "Pool deal one",
      company_id: 1,
      status: "potential",
      stage: "contact",
      deal_type: "new",
      source_type: "direct",
      budget: 10000,
      sales_id: undefined,
      is_unassigned: true,
    }),
    buildDeal({
      id: 2,
      index: 1,
      name: "Pool deal channel",
      company_id: 1,
      status: "active",
      stage: "pain",
      deal_type: "renewal",
      source_type: "channel",
      channel_id: 2,
      budget: 20000,
      sales_id: undefined,
      is_unassigned: true,
    }),
    buildDeal({
      id: 3,
      index: 2,
      name: "Owned deal",
      company_id: 1,
      status: "active",
      stage: "solution",
      deal_type: "upsell",
      sales_id: 0,
      is_unassigned: false,
    }),
  ],
};

const renderPool = (overrides: Partial<Db> = {}) =>
  render(
    <StoryWrapper data={{ ...data, ...overrides }}>
      <DealPoolList />
    </StoryWrapper>,
  );

describe("DealPoolList", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("lists only the unassigned deals", async () => {
    const screen = await renderPool();

    await expect.element(screen.getByText("Lead pool")).toBeVisible();
    await expect.element(screen.getByText("Pool deal one")).toBeVisible();
    await expect.element(screen.getByText("Pool deal channel")).toBeVisible();
    await expect
      .element(screen.getByText("Owned deal"))
      .not.toBeInTheDocument();
    // hotel + source + channel are displayed on the rows
    await expect
      .element(screen.getByTestId("pool-deal-1").getByText(/Acme Hotel/))
      .toBeVisible();
    await expect
      .element(screen.getByTestId("pool-deal-2").getByText(/Globex OTA/))
      .toBeVisible();
  });

  it("claims a deal: the current user becomes its owner and the row leaves the pool", async () => {
    const screen = await renderPool();

    await expect.element(screen.getByTestId("pool-deal-1")).toBeVisible();
    await screen.getByTestId("pool-claim-1").click();

    await expect
      .element(screen.getByTestId("pool-deal-1"))
      .not.toBeInTheDocument();
    // the other pool deal is untouched
    await expect.element(screen.getByTestId("pool-deal-2")).toBeVisible();
  });

  it("shows the empty state when no deal is unassigned", async () => {
    const screen = await renderPool({ deals: data.deals.slice(2) });

    await expect
      .element(screen.getByText("The lead pool is empty."))
      .toBeVisible();
  });
});
