import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import type { DataProvider } from "ra-core";

import { createCrmDb, StoryWrapper } from "@/test/StoryWrapper";
import { createDataProvider } from "../providers/fakerest";
import type { Db } from "../providers/fakerest/dataGenerator/types";
import { useCompanyImport } from "../dataImport/useCompanyImport";
import type { ImportRow } from "../dataImport/types";

/**
 * The company importer lives in `dataImport`, but its company-specific mapping
 * and related-company resolution are part of the company module's contract.
 */
const ImportCompanies = ({ rows }: { rows: ImportRow[] }) => {
  const processBatch = useCompanyImport();
  const [status, setStatus] = useState("ready");
  return (
    <>
      <button
        onClick={() => {
          setStatus("running");
          processBatch(rows).then(
            () => setStatus("imported"),
            () => setStatus("failed"),
          );
        }}
      >
        run import
      </button>
      <span>{status}</span>
    </>
  );
};

const listCompanies = (dataProvider: DataProvider) =>
  dataProvider.getList("companies", {
    filter: {},
    pagination: { page: 1, perPage: 25 },
    sort: { field: "id", order: "ASC" },
  });

const renderImport = async (rows: ImportRow[], db?: Partial<Db>) => {
  const dataProvider = createDataProvider({
    db: createCrmDb(db),
    latency: 0,
    silent: true,
  });
  const screen = await render(
    <StoryWrapper dataProvider={dataProvider}>
      <ImportCompanies rows={rows} />
    </StoryWrapper>,
  );
  return { dataProvider, screen };
};

describe("useCompanyImport", () => {
  it("imports the customer category and hotel fields of a company CSV", async () => {
    const { dataProvider, screen } = await renderImport([
      {
        average_room_rate: "1800.5",
        customer_category: "keep",
        hotel_services: "rooms;restaurant",
        hotel_type: "international_chain",
        name: "Waldorf Shanghai",
        opening_year: 2010,
        rooms: 260,
        sector: "hotel",
      },
    ]);

    await screen.getByRole("button", { name: "run import" }).click();
    await expect.element(screen.getByText("imported")).toBeVisible();

    const { data: companies } = await listCompanies(dataProvider);
    expect(companies[0]).toMatchObject({
      company_kind: "hotel",
      customer_category: "keep",
      hotel_services: ["rooms", "restaurant"],
      hotel_type: "international_chain",
      name: "Waldorf Shanghai",
      opening_year: 2010,
      rooms: 260,
      sector: "hotel",
    });
    expect(companies[0].average_room_rate).toBeCloseTo(1800.5);
  });

  it("imports a channel row into the channel directory", async () => {
    const { dataProvider, screen } = await renderImport([
      {
        channel_type: "ota",
        company_kind: "channel",
        name: "Ctrip",
        sector: "travel",
      },
      {
        channel_type: "ota",
        hotel_type: "international_chain",
        name: "Waldorf Shanghai",
      },
    ]);

    await screen.getByRole("button", { name: "run import" }).click();
    await expect.element(screen.getByText("imported")).toBeVisible();

    const { data: companies } = await listCompanies(dataProvider);
    expect(companies[0]).toMatchObject({
      channel_type: "ota",
      company_kind: "channel",
      name: "Ctrip",
      sector: "travel",
    });
    // Hotel fields are ignored on a channel row
    expect(companies[0].hotel_type).toBeUndefined();
    // Without company_kind a row belongs to the hotel directory, and a hotel
    // ignores the channel_type column
    expect(companies[1]).toMatchObject({
      company_kind: "hotel",
      name: "Waldorf Shanghai",
    });
    expect(companies[1].channel_type).toBeUndefined();
    expect(companies[1].hotel_type).toBe("international_chain");
  });

  it("links a hotel to the group named in the same import batch", async () => {
    const { dataProvider, screen } = await renderImport([
      { name: "Marriott Group", sector: "hotel-group" },
      {
        name: "Waldorf Shanghai",
        parent_company_id: "Marriott Group",
        sector: "hotel",
      },
    ]);

    await screen.getByRole("button", { name: "run import" }).click();
    await expect.element(screen.getByText("imported")).toBeVisible();

    const { data: companies } = await listCompanies(dataProvider);
    const group = companies.find(
      (company) => company.name === "Marriott Group",
    );
    const hotel = companies.find(
      (company) => company.name === "Waldorf Shanghai",
    );
    expect(group).toBeDefined();
    expect(hotel?.parent_company_id).toBe(group?.id);
  });
});
