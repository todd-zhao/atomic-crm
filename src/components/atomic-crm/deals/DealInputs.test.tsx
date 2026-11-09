import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { CreateForm } from "./DealInputs.stories";

describe("DealInputs", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });

  it("renders the new deal fields", async () => {
    const screen = await render(<CreateForm />);

    await expect.element(screen.getByLabelText(/deal name/i)).toBeVisible();
    await expect.element(screen.getByLabelText(/deal type/i)).toBeVisible();
    await expect.element(screen.getByLabelText(/status/i)).toBeVisible();
    await expect
      .element(screen.getByLabelText(/methodology stage/i))
      .toBeVisible();
    await expect.element(screen.getByLabelText(/budget/i)).toBeVisible();
    await expect
      .element(screen.getByLabelText(/final deal amount/i))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText(/expected closing date/i))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText(/decision process/i))
      .toBeVisible();
    await expect.element(screen.getByLabelText(/competitor/i)).toBeVisible();
  });

  it("suggests creating a competitor when none exists", async () => {
    // The story data has no competitors resource at all, which is the state of
    // a fresh installation: the field stays usable and a hint invites the user
    // to create the first competitor.
    const screen = await render(<CreateForm />);

    await expect
      .element(screen.getByText(/no competitors found/i))
      .toBeVisible();
  });

  it("does not show the competitor hint when some exist", async () => {
    const screen = await render(
      <CreateForm
        data={{
          companies: [{ id: 1, name: "Smith Corp", sales_id: 0 }],
          competitors: [{ id: 1, name: "Globex" }],
        }}
      />,
    );

    await expect
      .element(screen.getByText(/no competitors found/i))
      .not.toBeInTheDocument();
  });

  it("renders the sales owner with the lead-pool hint", async () => {
    const screen = await render(<CreateForm />);

    await expect.element(screen.getByLabelText(/sales owner/i)).toBeVisible();
    await expect.element(screen.getByText(/lead pool/i)).toBeVisible();
  });

  it("shows the source channel only for channel-sourced deals", async () => {
    const screen = await render(<CreateForm />);

    // direct is the default source: no channel field yet
    await expect
      .element(screen.getByLabelText(/source channel/i))
      .not.toBeInTheDocument();

    await screen.getByRole("combobox", { name: /^source/i }).click();
    await screen.getByRole("option", { name: "Channel" }).click();

    await expect
      .element(screen.getByLabelText(/source channel/i))
      .toBeVisible();
  });
});
