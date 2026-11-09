import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import {
  AdminAccountManagerFilter,
  NonAdminAccountManagerFilter,
  StatusBoard,
} from "./DealList.stories";

describe("DealList", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("lets an admin filter the board by account manager instead of only-mine", async () => {
    const screen = await render(<AdminAccountManagerFilter />);

    await expect.element(screen.getByText("Acme - Jane deal")).toBeVisible();
    await expect.element(screen.getByText("Acme - Marie deal")).toBeVisible();
    await expect
      .element(screen.getByText("Only deals I manage"))
      .not.toBeInTheDocument();

    await screen.getByRole("combobox", { name: "Account manager" }).click();
    await screen.getByRole("option", { name: "Marie Curie" }).click();

    await expect
      .element(screen.getByText("Acme - Jane deal"))
      .not.toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: "Clear value" });
    await clearButton.element().focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(screen.getByText("Acme - Jane deal")).toBeVisible();
    await expect.element(screen.getByText("Acme - Marie deal")).toBeVisible();
  });

  it("keeps the only-mine switch for a user who is not an admin", async () => {
    const screen = await render(<NonAdminAccountManagerFilter />);

    await expect.element(screen.getByText("Only deals I manage")).toBeVisible();
    await expect
      .element(screen.getByRole("combobox", { name: "Account manager" }))
      .not.toBeInTheDocument();
  });

  it("groups the deals into one column per status", async () => {
    const screen = await render(<StatusBoard />);

    for (const [status, label] of [
      ["potential", "Potential"],
      ["active", "Active"],
      ["won", "Won"],
      ["exited", "Exited"],
    ]) {
      const column = screen.getByTestId(`deal-column-${status}`);
      await expect.element(column).toBeVisible();
      expect(column.element().textContent).toContain(label);
    }

    await expect
      .element(screen.getByText("Acme - Potential deal"))
      .toBeVisible();
    await expect.element(screen.getByText("Acme - Active deal")).toBeVisible();
    await expect.element(screen.getByText("Acme - Won deal")).toBeVisible();
    await expect.element(screen.getByText("Acme - Exited deal")).toBeVisible();
  });

  it("colors the status column headers with the configured colors", async () => {
    const screen = await render(<StatusBoard />);

    const potentialColumn = screen.getByTestId("deal-column-potential");
    await expect.element(potentialColumn).toBeVisible();
    const dot = potentialColumn
      .element()
      .querySelector('span[aria-hidden="true"]');
    // default "potential" color, #7dbde8
    expect(dot?.getAttribute("style") ?? "").toContain("125, 189, 232");
  });

  it("shows the colored stage badge only on active deals", async () => {
    const screen = await render(<StatusBoard />);

    // active deal: its stage is shown as a badge
    await expect.element(screen.getByText("Pain identification")).toBeVisible();
    // won / potential / exited deals keep their stage hidden on the board
    await expect
      .element(screen.getByText("Budget discussion"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText("After-sales follow-up"))
      .not.toBeInTheDocument();
  });

  it("hides unassigned deals from the board and links to the lead pool", async () => {
    const screen = await render(<StatusBoard />);

    // The deal without a sales owner lives in the pool, not on the board.
    await expect
      .element(screen.getByText("Acme - Pool deal"))
      .not.toBeInTheDocument();

    // Assigned cards show their owner.
    const activeCard = screen.getByTestId("deal-card-2");
    await expect.element(activeCard).toBeVisible();
    await expect.element(activeCard.getByText(/Jane Doe/)).toBeVisible();

    // The toolbar links to the lead pool page.
    await expect
      .element(screen.getByRole("link", { name: /lead pool/i }))
      .toBeVisible();
  });
});
