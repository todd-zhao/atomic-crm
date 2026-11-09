import { render } from "vitest-browser-react";

import { WithAndWithoutName } from "./SalesList.stories";

describe("SalesList", () => {
  it("shows the full name when the sale has one", async () => {
    const screen = await render(<WithAndWithoutName />);

    await expect.element(screen.getByText("张伟")).toBeVisible();
    await expect.element(screen.getByText("Full name")).toBeVisible();
  });

  it("falls back to the first and last name for sales without a name", async () => {
    const screen = await render(<WithAndWithoutName />);

    await expect.element(screen.getByText("Marie Curie")).toBeVisible();
    await expect.element(screen.getByText("Wei Zhang")).not.toBeInTheDocument();
  });

  it("keeps the email column", async () => {
    const screen = await render(<WithAndWithoutName />);

    await expect.element(screen.getByText("zhangwei@atomic.dev")).toBeVisible();
    await expect.element(screen.getByText("marie@atomic.dev")).toBeVisible();
  });
});
