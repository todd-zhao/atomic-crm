import { render } from "vitest-browser-react";

import { ChannelsOnly } from "./ChannelList.stories";

describe("ChannelList", () => {
  it("lists channels and leaves hotels out", async () => {
    const screen = await render(<ChannelsOnly />);

    await expect.element(screen.getByText("Ctrip")).toBeVisible();
    await expect
      .element(screen.getByText("Waldorf Shanghai"))
      .not.toBeInTheDocument();
  });

  it("shows the channel columns of the channel directory", async () => {
    const screen = await render(<ChannelsOnly />);

    await expect.element(screen.getByText("OTA")).toBeVisible();
    await expect.element(screen.getByText("Travel")).toBeVisible();
    await expect
      .element(screen.getByText("Channel (other company)"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: /New channel/ }))
      .toHaveAttribute("href", "/channels/create");
  });
});
