import { render } from "vitest-browser-react";

import { HotelsOnly } from "./CompanyList.stories";

describe("CompanyList", () => {
  it("lists hotels and leaves channels out", async () => {
    const screen = await render(<HotelsOnly />);

    await expect.element(screen.getByText("Waldorf Shanghai")).toBeVisible();
    await expect.element(screen.getByText("Ctrip")).not.toBeInTheDocument();
  });

  it("offers the channel directory from the company kind filter", async () => {
    const screen = await render(<HotelsOnly />);

    await expect
      .element(
        screen.getByRole("button", { name: /Hotel \(direct customer\)/ }),
      )
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("button", { name: /Channel \(other company\)/ }),
      )
      .toBeVisible();
  });
});
