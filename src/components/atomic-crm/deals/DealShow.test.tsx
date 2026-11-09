import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { ResourceContextProvider } from "ra-core";

import {
  StoryWrapper,
  buildCompany,
  buildContact,
  buildDeal,
} from "@/test/StoryWrapper";
import { DealShow } from "./DealShow";

const data = {
  companies: [
    buildCompany({ id: 1, name: "Acme", company_kind: "hotel" }),
    buildCompany({ id: 2, name: "Globex Travel", company_kind: "channel" }),
  ],
  contacts: [
    buildContact({
      id: 1,
      first_name: "Ada",
      last_name: "Lovelace",
      company_id: 1,
      title: "CTO",
    }),
    buildContact({
      id: 2,
      first_name: "Grace",
      last_name: "Hopper",
      company_id: 1,
      title: "COO",
    }),
  ],
  competitors: [{ id: 1, name: "Globex" }],
  deals: [
    buildDeal({
      id: 1,
      name: "Hotel PMS renewal",
      company_id: 1,
      status: "active",
      stage: "pain",
      deal_type: "renewal",
      budget: 120000,
      final_amount: null,
      competitor_id: 1,
      decision_process: "CEO validates, CFO signs",
    }),
  ],
  deal_contacts: [
    {
      id: 1,
      deal_id: 1,
      contact_id: 1,
      role: "decision_maker",
      attitude: "support",
      influence: "high",
      pain: "Too much manual work",
      index: 0,
    },
  ],
  deal_pains: [
    {
      id: 1,
      deal_id: 1,
      symptom: "Manual reporting",
      cause: "No property management system",
      duration: "2 years",
      quantified_loss: "500K per year",
      index: 0,
    },
  ],
  deal_milestones: [
    {
      id: 1,
      deal_id: 1,
      event: "Pilot approved",
      date: "2026-09-15",
      index: 0,
    },
  ],
  deal_meetings: [
    {
      id: 1,
      deal_id: 1,
      meeting_date: "2026-09-01",
      customer_attendee_ids: [1],
      our_attendee_ids: [0],
      content: "Kickoff meeting",
      next_steps: "Send proposal",
    },
  ],
};

const renderDealShow = (dataOverride: Partial<typeof data> = {}) =>
  render(
    <StoryWrapper data={{ ...data, ...dataOverride }}>
      <ResourceContextProvider value="deals">
        <DealShow open id="1" />
      </ResourceContextProvider>
    </StoryWrapper>,
  );

describe("DealShow", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("shows the deal fields, status, stage, type, budget and competitor", async () => {
    const screen = await renderDealShow();

    await expect.element(screen.getByText("Hotel PMS renewal")).toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: /Jane Doe/ }))
      .toBeVisible();
    await expect.element(screen.getByText("Active")).toBeVisible();
    await expect.element(screen.getByText("Pain identification")).toBeVisible();
    await expect.element(screen.getByText("Renewal")).toBeVisible();
    await expect.element(screen.getByText(/120K/)).toBeVisible();
    await expect.element(screen.getByText("Globex")).toBeVisible();
    await expect
      .element(screen.getByText("CEO validates, CFO signs"))
      .toBeVisible();
  });

  it("shows the source channel only on channel-sourced deals", async () => {
    const screen = await renderDealShow({
      deals: [
        buildDeal({
          id: 1,
          name: "Channel-sourced deal",
          company_id: 1,
          status: "active",
          stage: "contact",
          deal_type: "new",
          source_type: "channel",
          channel_id: 2,
          budget: 10000,
        }),
      ],
    });

    await expect
      .element(screen.getByText("Channel-sourced deal"))
      .toBeVisible();
    // source label + channel company
    await expect.element(screen.getByText("Channel")).toBeVisible();
    await expect.element(screen.getByText("Globex Travel")).toBeVisible();
  });

  it("claims an unassigned deal and makes the current user its owner", async () => {
    const screen = await renderDealShow({
      deals: [
        buildDeal({
          id: 1,
          name: "Pool deal",
          company_id: 1,
          status: "potential",
          stage: "contact",
          deal_type: "new",
          sales_id: undefined,
          is_unassigned: true,
        }),
      ],
    });

    await expect.element(screen.getByText("Unassigned")).toBeVisible();
    const claimButton = screen.getByTestId("deal-claim-button");
    await expect.element(claimButton).toBeVisible();

    await claimButton.click();

    // the current user (Jane Doe) is now the sales owner, and the pool badge
    // and claim button are gone
    await expect
      .element(screen.getByRole("link", { name: /Jane Doe/ }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Unassigned"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByTestId("deal-claim-button"))
      .not.toBeInTheDocument();
  });

  it("lists stakeholders, pains, milestones and meetings from the sub-tables", async () => {
    const screen = await renderDealShow();

    // stakeholder
    const stakeholder = screen.getByTestId("deal-child-deal_contacts-1");
    await expect.element(stakeholder).toBeVisible();
    await expect.element(stakeholder.getByText("Ada Lovelace")).toBeVisible();
    await expect.element(stakeholder.getByText("Decision maker")).toBeVisible();
    await expect
      .element(stakeholder.getByText(/Too much manual work/))
      .toBeVisible();

    // pain
    const pain = screen.getByTestId("deal-child-deal_pains-1");
    await expect.element(pain.getByText("Manual reporting")).toBeVisible();
    await expect
      .element(pain.getByText(/No property management system/))
      .toBeVisible();

    // milestone
    await expect.element(screen.getByText("Pilot approved")).toBeVisible();

    // meeting: date, customer attendee, content and next steps
    const meeting = screen.getByTestId("deal-child-deal_meetings-1");
    await expect.element(meeting.getByText("Kickoff meeting")).toBeVisible();
    await expect.element(meeting.getByText(/Send proposal/)).toBeVisible();
    await expect.element(meeting.getByText(/Ada Lovelace/)).toBeVisible();

    // files section empty state
    await expect.element(screen.getByText("No files yet")).toBeVisible();
  });

  it("deletes a stakeholder from the deal_contacts sub-table", async () => {
    const screen = await renderDealShow();

    const stakeholder = screen.getByTestId("deal-child-deal_contacts-1");
    await expect.element(stakeholder).toBeVisible();

    await stakeholder.getByRole("button", { name: "Delete" }).click();

    await expect
      .element(screen.getByTestId("deal-child-deal_contacts-1"))
      .not.toBeInTheDocument();
  });
});
