import { ResourceContextProvider } from "ra-core";
import { Route, Routes } from "react-router";
import { render } from "vitest-browser-react";

import { StoryWrapper } from "@/test/StoryWrapper";
import { CompetitorList } from "./CompetitorList";
import { CompetitorShow } from "./CompetitorShow";

const competitor = {
  id: 1,
  name: "Acme Hospitality",
  brand_influence: "high",
  market_price: "medium",
  advantages: "Strong brand",
  weaknesses: "High price",
};

const renderCompetitor = (children: React.ReactNode) =>
  render(
    <StoryWrapper data={{ competitors: [competitor] }}>
      <ResourceContextProvider value="competitors">
        {children}
      </ResourceContextProvider>
    </StoryWrapper>,
  );

describe("competitors", () => {
  it("lists the competitors with their levels", async () => {
    const screen = await renderCompetitor(<CompetitorList />);

    await expect.element(screen.getByText("Acme Hospitality")).toBeVisible();
    await expect.element(screen.getByText("High")).toBeVisible();
    await expect.element(screen.getByText("Medium")).toBeVisible();
  });

  it("shows a competitor and its strengths and weaknesses", async () => {
    const screen = await render(
      <StoryWrapper
        data={{ competitors: [competitor] }}
        initialEntries={["/competitors/1/show"]}
      >
        <ResourceContextProvider value="competitors">
          <Routes>
            <Route path="/competitors/:id/show" element={<CompetitorShow />} />
          </Routes>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Acme Hospitality")).toBeVisible();
    await expect.element(screen.getByText("Strong brand")).toBeVisible();
    await expect.element(screen.getByText("High price")).toBeVisible();
  });
});
