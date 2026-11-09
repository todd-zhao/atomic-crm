import { useEffect } from "react";
import { render } from "vitest-browser-react";
import { expect } from "vitest";

import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import { StoryWrapper, buildCompany, createCrmDb } from "@/test/StoryWrapper";
import type { ProcessImportBatch } from "@/components/atomic-crm/dataImport/types";
import { useDealImport } from "@/components/atomic-crm/dataImport/useDealImport";

let processBatch: ProcessImportBatch | undefined;

const Harness = () => {
  const batch = useDealImport();
  useEffect(() => {
    processBatch = batch;
  }, [batch]);
  return null;
};

const importDeals = async (rows: Array<Record<string, string>>) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      companies: [
        buildCompany({ id: 1, name: "Acme", company_kind: "hotel" }),
        buildCompany({
          id: 2,
          name: "Globex Travel",
          company_kind: "channel",
        }),
      ],
    }),
    latency: 0,
    silent: true,
  });
  processBatch = undefined;
  await render(
    <StoryWrapper dataProvider={dataProvider}>
      <Harness />
    </StoryWrapper>,
  );
  await expect.poll(() => processBatch !== undefined).toBe(true);
  const created = await processBatch!(rows);
  expect(created).toBe(rows.length);
  const { data: deals } = await dataProvider.getList("deals", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
  });
  return deals;
};

describe("useDealImport new columns", () => {
  it("maps the channel company and the sales owner", async () => {
    const [deal] = await importDeals([
      {
        name: "Channel deal",
        company: "Acme",
        stage: "contact",
        status: "potential",
        source_type: "channel",
        channel: "Globex Travel",
        sales: "janedoe@atomic.dev",
        budget: "10000",
      },
    ]);

    expect(deal).toMatchObject({
      source_type: "channel",
      channel_id: 2,
      sales_id: 0,
      company_id: 1,
      budget: 10000,
    });
  });

  it("imports a deal without an owner into the lead pool", async () => {
    const [deal] = await importDeals([
      {
        name: "Ownerless deal",
        company: "Acme",
        stage: "contact",
        status: "potential",
        source_type: "direct",
        budget: "500",
      },
    ]);

    expect(deal.sales_id == null).toBe(true);
    // FakeRest computes the generated Postgres column on create.
    expect(deal.is_unassigned).toBe(true);
  });

  it("ignores an unknown channel instead of creating it", async () => {
    const [deal] = await importDeals([
      {
        name: "Unknown channel deal",
        company: "Acme",
        stage: "contact",
        status: "potential",
        source_type: "channel",
        channel: "Does not exist",
      },
    ]);

    expect(deal.source_type).toBe("channel");
    expect(deal.channel_id == null).toBe(true);
  });
});
