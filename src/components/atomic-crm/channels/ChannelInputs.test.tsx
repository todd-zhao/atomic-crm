import { render } from "vitest-browser-react";

import { StoryWrapper } from "@/test/StoryWrapper";

import { ChannelCreate } from "./ChannelCreate";

describe("ChannelCreate", () => {
  it("renders the channel form of the channel directory", async () => {
    const screen = await render(
      <StoryWrapper>
        <ChannelCreate />
      </StoryWrapper>,
    );

    await expect.element(screen.getByPlaceholder("Channel name")).toBeVisible();
    await expect.element(screen.getByLabelText("Channel type")).toBeVisible();
    await expect.element(screen.getByLabelText("Sector")).toBeVisible();
    await expect.element(screen.getByLabelText("Website")).toBeVisible();
    await expect.element(screen.getByLabelText("Phone number")).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Create channel" }))
      .toBeVisible();
  });
});
