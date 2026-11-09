import { ResourceContextProvider } from "ra-core";
import { render } from "vitest-browser-react";

import { StoryWrapper } from "@/test/StoryWrapper";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("renders the enumerations of the new data model", async () => {
    const screen = await render(
      <StoryWrapper>
        <ResourceContextProvider value="configuration">
          <SettingsPage />
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    // One editable list per configured enumeration
    await expect.element(screen.getByText("Company kind")).toBeVisible();
    await expect.element(screen.getByText("Channel type")).toBeVisible();
    await expect.element(screen.getByText("Customer category")).toBeVisible();
    await expect.element(screen.getByText("Hotel type")).toBeVisible();
    await expect.element(screen.getByText("Hotel services")).toBeVisible();
    await expect.element(screen.getByText("Contact type")).toBeVisible();
    await expect.element(screen.getByText("Attitude")).toBeVisible();
    await expect.element(screen.getByText("Communication style")).toBeVisible();
    await expect.element(screen.getByText("Social organization")).toBeVisible();
    await expect.element(screen.getByText("Education")).toBeVisible();
    await expect.element(screen.getByText("Deal type")).toBeVisible();
    await expect.element(screen.getByText("Source")).toBeVisible();
  });

  it("no longer offers the removed deal categories and pipeline statuses", async () => {
    const screen = await render(
      <StoryWrapper>
        <ResourceContextProvider value="configuration">
          <SettingsPage />
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Customer category")).toBeVisible();
    expect(screen.container.textContent).not.toContain("Pipeline Statuses");
    expect(screen.container.textContent).not.toContain("Categories");
  });
});
