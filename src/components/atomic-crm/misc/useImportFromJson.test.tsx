import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import type { DataProvider } from "ra-core";

import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import { createCrmDb, StoryWrapper } from "@/test/StoryWrapper";
import { useImportFromJson } from "./useImportFromJson";

/** The sample file also documents the new fields of the data model. */
const sample = {
  sales: [
    {
      id: 1,
      email: "ada@acme.example",
      first_name: "Ada",
      last_name: "Lovelace",
    },
  ],
  companies: [
    {
      id: 1,
      name: "Acme Hotel",
      customer_category: "keep",
      hotel_type: "independent",
      rooms: 120,
      opening_year: 2010,
      hotel_services: ["rooms", "meeting"],
      average_room_rate: 450.5,
    },
    {
      id: 2,
      name: "Blue Travel",
      company_kind: "channel",
      channel_type: "travel_agency",
      sector: "travel",
    },
  ],
  contacts: [
    {
      id: 1,
      company_id: 1,
      sales_id: 1,
      name: "张伟",
      contact_type: "customer",
      birthday: "1980-05-01",
      communication_style: "D",
      attitude: "friendly",
      tenure_years: 3.5,
      social_organization: "alumni",
      work_experience: [
        { start_year: 2010, end_year: 2020, company: "Acme", title: "GM" },
      ],
      education: [
        {
          start_year: 2000,
          end_year: 2004,
          school: "Fudan",
          degree: "bachelor",
        },
      ],
    },
  ],
  deals: [
    {
      id: 1,
      name: "Acme project",
      company_id: 1,
      sales_id: 1,
      stage: "budget",
      status: "active",
      deal_type: "new",
      budget: 100000,
      final_amount: 95000,
      decision_process: "The CEO decides",
      competitor: "Rival Co",
    },
    {
      id: 2,
      name: "Acme conference",
      company_id: 1,
      sales: "Ada Lovelace",
      stage: "contact",
      status: "potential",
      source_type: "channel",
      channel: "Blue Travel",
      budget: 30000,
    },
    {
      // No sales owner: the deal goes to the public pool
      id: 3,
      name: "Acme spa",
      company_id: 1,
      stage: "contact",
      status: "potential",
      budget: 12000,
    },
  ],
  notes: [
    {
      contact_id: 1,
      sales_id: 1,
      text: "Called about the renewal",
      date: "2026-01-05T09:00:00.000Z",
    },
  ],
  tasks: [
    {
      contact_id: 1,
      sales_id: 1,
      text: "Send the proposal",
      due_date: "2026-02-01T09:00:00.000Z",
    },
  ],
};

const ImportHarness = ({ file }: { file: File }) => {
  const [state, importFile] = useImportFromJson();
  useEffect(() => {
    importFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <span>{state.status}</span>;
};

const listAll = (dataProvider: DataProvider, resource: string) =>
  dataProvider.getList(resource, {
    filter: {},
    pagination: { page: 1, perPage: 25 },
    sort: { field: "id", order: "ASC" },
  });

describe("useImportFromJson", () => {
  it("maps the new company, contact and deal fields of the JSON import", async () => {
    const dataProvider = createDataProvider({
      db: createCrmDb(),
      latency: 0,
      silent: true,
    });
    const file = new File([JSON.stringify(sample)], "crm.json", {
      type: "application/json",
    });

    const screen = await render(
      <StoryWrapper dataProvider={dataProvider}>
        <ImportHarness file={file} />
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("success")).toBeVisible();

    const { data: companies } = await listAll(dataProvider, "companies");
    const companyByName = (name: string) =>
      companies.find((company: any) => company.name === name);
    const hotel = companyByName("Acme Hotel");
    expect(hotel).toMatchObject({
      // Companies default to the hotel directory, like the database
      company_kind: "hotel",
      customer_category: "keep",
      hotel_type: "independent",
      rooms: 120,
      opening_year: 2010,
      hotel_services: ["rooms", "meeting"],
      average_room_rate: 450.5,
    });
    const channel = companyByName("Blue Travel");
    expect(channel).toMatchObject({
      company_kind: "channel",
      channel_type: "travel_agency",
    });
    const { data: contacts } = await listAll(dataProvider, "contacts");
    expect(contacts[0]).toMatchObject({
      name: "张伟",
      contact_type: "customer",
      birthday: "1980-05-01",
      communication_style: "D",
      attitude: "friendly",
      tenure_years: 3.5,
      social_organization: "alumni",
      company_id: hotel!.id,
    });
    expect(contacts[0].work_experience).toEqual([
      { start_year: 2010, end_year: 2020, company: "Acme", title: "GM" },
    ]);
    expect(contacts[0].education).toEqual([
      {
        start_year: 2000,
        end_year: 2004,
        school: "Fudan",
        degree: "bachelor",
      },
    ]);

    const { data: deals } = await listAll(dataProvider, "deals");
    // Deals are created in parallel batches, so look them up by name
    const dealByName = (name: string) =>
      deals.find((deal: any) => deal.name === name);
    expect(dealByName("Acme project")).toMatchObject({
      stage: "budget",
      status: "active",
      deal_type: "new",
      budget: 100000,
      final_amount: 95000,
      decision_process: "The CEO decides",
      company_id: hotel!.id,
    });

    // The sales owner is matched by display name, the channel by its name
    const { data: sales } = await listAll(dataProvider, "sales");
    const importedSale = sales.find(
      (sale: any) => sale.email === "ada@acme.example",
    );
    expect(importedSale).toBeDefined();
    expect(dealByName("Acme conference")).toMatchObject({
      source_type: "channel",
      channel_id: channel!.id,
      sales_id: importedSale.id,
      is_unassigned: false,
    });

    // A deal without a sales owner lands in the public pool
    expect(dealByName("Acme spa")).toMatchObject({
      source_type: "direct",
      channel_id: null,
      sales_id: null,
      is_unassigned: true,
    });
    const { data: poolDeals } = await dataProvider.getList("deals", {
      filter: { is_unassigned: true },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(poolDeals.map((deal: any) => deal.name)).toEqual(["Acme spa"]);

    // The competitor named in the file is created and linked
    const { data: competitors } = await listAll(dataProvider, "competitors");
    expect(competitors).toHaveLength(1);
    expect(competitors[0].name).toBe("Rival Co");
    expect(dealByName("Acme project").competitor_id).toBe(competitors[0].id);
  });
});
