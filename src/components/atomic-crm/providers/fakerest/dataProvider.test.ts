import { describe, expect, it } from "vitest";

import type { Db } from "./dataGenerator/types";
import { createDataProvider } from "./dataProvider";

describe("fakerest dataProvider", () => {
  it("removes a deleted tag from contacts without touching other fields", async () => {
    const lastSeen = "2020-01-01T00:00:00.000Z";
    const dataProvider = createDataProvider({
      db: {
        tags: [
          { id: 1, name: "vip", color: "#fff" },
          { id: 2, name: "lead", color: "#000" },
        ],
        contacts: [
          { id: 1, first_name: "Ann", tags: [1, 2], last_seen: lastSeen },
          { id: 2, first_name: "Bob", tags: [2], last_seen: lastSeen },
        ],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    await dataProvider.delete("tags", { id: 1 });

    const { data: contacts } = await dataProvider.getMany("contacts", {
      ids: [1, 2],
    });
    expect(contacts.map((c) => c.tags)).toEqual([[2], [2]]);
    expect(contacts.map((c) => c.last_seen)).toEqual([lastSeen, lastSeen]);
  });

  it("ignores unknown ids when getting many tags", async () => {
    const dataProvider = createDataProvider({
      db: { tags: [{ id: 2, name: "lead", color: "#000" }] } as unknown as Db,
      latency: 0,
      silent: true,
    });

    const { data: tags } = await dataProvider.getMany("tags", { ids: [1, 2] });

    expect(tags.map((tag) => tag.id)).toEqual([2]);
  });

  it("lists a task created in the app before older ones in the global search", async () => {
    const dataProvider = createDataProvider({
      db: {
        companies: [],
        contacts: [{ id: 1, first_name: "Ann", nb_tasks: 1 }],
        deals: [],
        contact_notes: [],
        deal_notes: [],
        tasks: [
          {
            id: 1,
            contact_id: 1,
            text: "Call back",
            created_at: "2020-01-01T00:00:00.000Z",
            done_date: null,
          },
        ],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    await dataProvider.create("tasks", {
      data: { contact_id: 1, text: "Call again", done_date: null },
    });
    const results = await dataProvider.globalSearch("call", ["tasks"], 10);

    expect(results.map((result) => result.title)).toEqual([
      "Call again",
      "Call back",
    ]);
  });

  it("persists the optional full name of a sale on signup, create and update", async () => {
    const dataProvider = createDataProvider({
      db: {
        companies: [],
        contacts: [],
        contact_notes: [],
        deals: [],
        deal_notes: [],
        configuration: [{ id: 1, config: {} }],
        sales: [],
        tags: [],
        tasks: [],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    await dataProvider.signUp({
      email: "wei@example.com",
      password: "secret",
      name: "张伟",
      first_name: "Wei",
      last_name: "Zhang",
    });
    const { data: signedUp } = await dataProvider.getList("sales", {
      filter: { email: "wei@example.com" },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    expect(signedUp[0]).toMatchObject({ name: "张伟" });

    const created = await dataProvider.salesCreate({
      administrator: false,
      disabled: false,
      email: "na@example.com",
      first_name: "Na",
      last_name: "Li",
      name: "李娜",
    });
    expect(created.name).toBe("李娜");

    const updated = await dataProvider.salesUpdate(created.id, {
      name: "李娜娜",
    });
    expect(updated.name).toBe("李娜娜");
  });

  it("finds an old contact in the global search despite many newer notes mentioning them", async () => {
    const dataProvider = createDataProvider({
      db: {
        companies: [],
        contacts: [
          {
            id: 1,
            first_name: "Marc",
            last_name: "Durand",
            first_seen: "2021-03-01T00:00:00.000Z",
          },
        ],
        deals: [],
        tasks: [],
        contact_notes: Array.from({ length: 20 }, (_, index) => ({
          id: index + 1,
          contact_id: 1,
          text: `Called Marc about the renewal (${index})`,
          date: "2026-09-01T00:00:00.000Z",
          attachments: [],
        })),
        deal_notes: [],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    const results = await dataProvider.globalSearch(
      "marc",
      ["contacts", "contact_notes"],
      10,
    );

    expect(
      results.filter((result) => result.resource === "contacts"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.resource === "contact_notes"),
    ).toHaveLength(10);
  });

  it("finds a deal in the global search by its type, stage or status", async () => {
    const dataProvider = createDataProvider({
      db: {
        companies: [],
        contacts: [],
        deals: [
          {
            id: 1,
            name: "Acme rebrand",
            deal_type: "renewal",
            stage: "budget",
            status: "won",
            description: "New logo",
          },
          { id: 2, name: "Design review", description: "No deal type" },
        ],
        tasks: [],
        contact_notes: [],
        deal_notes: [],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    const typeResults = await dataProvider.globalSearch(
      "renewal",
      ["deals"],
      10,
    );
    const statusResults = await dataProvider.globalSearch("won", ["deals"], 10);
    const designResults = await dataProvider.globalSearch(
      "design",
      ["deals"],
      10,
    );

    expect(typeResults.map((result) => result.content)).toEqual([
      "renewal · budget · won · New logo",
    ]);
    expect(statusResults.map((result) => result.title)).toEqual([
      "Acme rebrand",
    ]);
    // The description is searched as well
    expect(designResults.map((result) => result.title)).toEqual([
      "Design review",
    ]);
  });

  it("finds a company by its directory kind and channel type", async () => {
    const dataProvider = createDataProvider({
      db: {
        companies: [
          {
            id: 1,
            name: "Acme Hotel",
            company_kind: "hotel",
            sector: "hotel",
          },
          {
            id: 2,
            name: "Blue Travel",
            company_kind: "channel",
            channel_type: "travel_agency",
            sector: "travel",
          },
        ],
        contacts: [],
        deals: [],
        tasks: [],
        contact_notes: [],
        deal_notes: [],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    const channelResults = await dataProvider.globalSearch(
      "channel",
      ["companies"],
      10,
    );
    const agencyResults = await dataProvider.globalSearch(
      "travel agency",
      ["companies"],
      10,
    );

    expect(channelResults.map((result) => result.title)).toEqual([
      "Blue Travel",
    ]);
    expect(agencyResults.map((result) => result.title)).toEqual([
      "Blue Travel",
    ]);
  });

  it("finds a channel-sourced deal by its channel name", async () => {
    const dataProvider = createDataProvider({
      db: {
        companies: [
          { id: 2, name: "Blue Travel", company_kind: "channel" },
          { id: 3, name: "Acme Hotel", company_kind: "hotel" },
        ],
        contacts: [],
        deals: [
          {
            id: 1,
            name: "Acme summit",
            company_id: 3,
            source_type: "channel",
            channel_id: 2,
            stage: "contact",
            status: "active",
          },
        ],
        tasks: [],
        contact_notes: [],
        deal_notes: [],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    const results = await dataProvider.globalSearch(
      "blue travel",
      ["deals"],
      10,
    );

    expect(results.map((result) => result.title)).toEqual(["Acme summit"]);
  });

  it("computes is_unassigned like the generated column when a deal is created, claimed or released", async () => {
    const dataProvider = createDataProvider({
      db: {
        companies: [],
        contacts: [],
        deals: [],
        sales: [],
        tags: [],
        tasks: [],
        contact_notes: [],
        deal_notes: [],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    const created = await dataProvider.create("deals", {
      data: { name: "Pool deal", stage: "contact", status: "potential" },
    });
    expect(created.data.is_unassigned).toBe(true);

    const { data: claimed } = await dataProvider.update("deals", {
      id: created.data.id,
      data: { sales_id: 0 },
      previousData: created.data,
    });
    expect(claimed.is_unassigned).toBe(false);

    // A status update that does not touch sales_id keeps the owner
    const { data: moved } = await dataProvider.update("deals", {
      id: created.data.id,
      data: { status: "active" },
      previousData: claimed,
    });
    expect(moved.is_unassigned).toBe(false);

    const { data: released } = await dataProvider.update("deals", {
      id: created.data.id,
      data: { sales_id: null },
      previousData: moved,
    });
    expect(released.is_unassigned).toBe(true);

    const { total } = await dataProvider.getList("deals", {
      filter: { is_unassigned: true },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);
  });

  it("defaults a new company to the hotel directory, like the database", async () => {
    const dataProvider = createDataProvider({
      db: {
        companies: [],
        contacts: [],
        deals: [],
        sales: [],
        tags: [],
        tasks: [],
        contact_notes: [],
        deal_notes: [],
      } as unknown as Db,
      latency: 0,
      silent: true,
    });

    const { data: company } = await dataProvider.create("companies", {
      data: { name: "Acme Hotel" },
    });

    expect(company.company_kind).toBe("hotel");
  });
});
