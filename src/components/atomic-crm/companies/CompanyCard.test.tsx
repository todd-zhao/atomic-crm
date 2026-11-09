import { render } from "vitest-browser-react";

import { GroupCompany, Hotel } from "./CompanyCard.stories";

describe("CompanyCard", () => {
  it("tags a hotel with its customer category and hotel type", async () => {
    const screen = await render(<Hotel />);

    await expect.element(screen.getByText("Waldorf Shanghai")).toBeVisible();
    await expect.element(screen.getByText("K - Keep")).toBeVisible();
    await expect.element(screen.getByText("International chain")).toBeVisible();
  });

  it("only tags the customer category of a company without hotel fields", async () => {
    const screen = await render(<GroupCompany />);

    await expect.element(screen.getByText("Marriott Group")).toBeVisible();
    await expect.element(screen.getByText("A - Acquire")).toBeVisible();
    await expect
      .element(screen.getByText("International chain"))
      .not.toBeInTheDocument();
  });
});
