import { render } from "vitest-browser-react";

import {
  ChannelOfTheDirectory,
  GroupCompany,
  HotelOfAGroup,
} from "./CompanyShow.stories";

describe("CompanyShow", () => {
  it("shows the hotel fields of a hotel", async () => {
    const screen = await render(<HotelOfAGroup />);

    await expect.element(screen.getByText("Waldorf Shanghai")).toBeVisible();
    await expect.element(screen.getByText(/K - Keep/)).toBeVisible();
    await expect.element(screen.getByText(/International chain/)).toBeVisible();
    await expect
      .element(screen.getByText(/Number of rooms: 260/))
      .toBeVisible();
    await expect.element(screen.getByText(/Opening year: 2010/)).toBeVisible();
    await expect
      .element(
        screen.getByText(/Rooms \/ Food & Beverage \/ Meetings & Events/),
      )
      .toBeVisible();
    await expect
      .element(screen.getByText(/Average room rate: CN¥1,800/))
      .toBeVisible();
  });

  it("links a hotel to its parent group", async () => {
    const screen = await render(<HotelOfAGroup />);

    await expect
      .element(screen.getByRole("link", { name: "Marriott Group" }))
      .toHaveAttribute("href", "/companies/1/show");
  });

  it("does not show hotel fields for a group company", async () => {
    const screen = await render(<GroupCompany />);

    await expect.element(screen.getByText("Marriott Group")).toBeVisible();
    await expect
      .element(screen.getByText("Number of rooms"))
      .not.toBeInTheDocument();
  });

  it("shows the channel details of a channel and no hotel fields", async () => {
    const screen = await render(<ChannelOfTheDirectory />);

    await expect.element(screen.getByText("Ctrip")).toBeVisible();
    await expect
      .element(screen.getByText(/Company kind: Channel \(other company\)/))
      .toBeVisible();
    await expect.element(screen.getByText(/Channel type: OTA/)).toBeVisible();
    await expect.element(screen.getByText(/Sector: Travel/)).toBeVisible();
    await expect
      .element(screen.getByText(/Number of rooms/))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText(/Customer category/))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByText(/Hotel details/))
      .not.toBeInTheDocument();
  });

  it("edits a channel from the channel directory", async () => {
    const screen = await render(<ChannelOfTheDirectory />);

    await expect
      .element(screen.getByRole("link", { name: "Edit channel" }))
      .toHaveAttribute("href", "/channels/3");
  });
});
