import { useState } from "react";
import { render } from "vitest-browser-react";

import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import type { DataProvider } from "ra-core";
import { createCrmDb, StoryWrapper } from "@/test/StoryWrapper";
import type { ContactImportSchema } from "./useContactImport";
import { useContactImport } from "./useContactImport";

const listContacts = (dataProvider: DataProvider) =>
  dataProvider.getList("contacts", {
    filter: {},
    pagination: { page: 1, perPage: 25 },
    sort: { field: "id", order: "ASC" },
  });

/** A parsed CSV row: every column is a string, empty ones are blank. */
const contactRow = (
  overrides: Partial<ContactImportSchema> = {},
): ContactImportSchema => ({
  name: "",
  first_name: "",
  last_name: "",
  gender: "",
  title: "",
  company: "",
  email_work: "",
  email_home: "",
  email_other: "",
  phone_work: "",
  phone_home: "",
  phone_other: "",
  background: "",
  avatar: "",
  first_seen: "",
  last_seen: "",
  has_newsletter: "",
  status: "",
  tags: "",
  wechat_id: "",
  contact_type: "",
  birthday: "",
  communication_style: "",
  attitude: "",
  tenure_years: "",
  social_organization: "",
  work_experience: "",
  education: "",
  ...overrides,
});

/** Imports one batch on click, so a test controls when the import starts. */
const ImportHarness = ({ rows }: { rows: ContactImportSchema[] }) => {
  const processBatch = useContactImport();
  const [status, setStatus] = useState("ready");
  return (
    <>
      <button
        onClick={() => {
          setStatus("running");
          processBatch(rows).then(
            (count) => setStatus(`imported ${count}`),
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

const renderImport = async (rows: ContactImportSchema[]) => {
  const dataProvider = createDataProvider({
    db: createCrmDb(),
    latency: 0,
    silent: true,
  });
  const screen = await render(
    <StoryWrapper dataProvider={dataProvider}>
      <ImportHarness rows={rows} />
    </StoryWrapper>,
  );
  return { dataProvider, screen };
};

describe("useContactImport", () => {
  it("imports the optional full name along with the legacy first and last name", async () => {
    const { dataProvider, screen } = await renderImport([
      contactRow({
        name: "张伟",
        first_name: "Wei",
        last_name: "Zhang",
      }),
    ]);

    await screen.getByRole("button", { name: "run import" }).click();
    await expect.element(screen.getByText("imported 1")).toBeVisible();

    const { data: contacts } = await listContacts(dataProvider);
    expect(contacts[0]).toMatchObject({
      first_name: "Wei",
      last_name: "Zhang",
      name: "张伟",
    });
  });

  it("imports a contact identified only by its full name", async () => {
    const { dataProvider, screen } = await renderImport([
      contactRow({ name: "李娜" }),
    ]);

    await screen.getByRole("button", { name: "run import" }).click();
    await expect.element(screen.getByText("imported 1")).toBeVisible();

    const { data: contacts } = await listContacts(dataProvider);
    expect(contacts[0].name).toBe("李娜");
  });

  it("leaves the name unset for a row without one, as before", async () => {
    const { dataProvider, screen } = await renderImport([
      contactRow({ first_name: "Ada", last_name: "Lovelace" }),
    ]);

    await screen.getByRole("button", { name: "run import" }).click();
    await expect.element(screen.getByText("imported 1")).toBeVisible();

    const { data: contacts } = await listContacts(dataProvider);
    expect(contacts[0]).toMatchObject({
      first_name: "Ada",
      last_name: "Lovelace",
    });
    expect(contacts[0].name).toBeUndefined();
  });

  it("imports the CRM profile columns and the JSON history columns", async () => {
    const { dataProvider, screen } = await renderImport([
      contactRow({
        first_name: "Ada",
        last_name: "Lovelace",
        contact_type: "channel",
        birthday: "1985-03-12",
        communication_style: "D",
        attitude: "friendly",
        tenure_years: "3.5",
        social_organization: "alumni",
        work_experience: JSON.stringify([
          {
            start_year: 2015,
            end_year: 2020,
            company: "Acme Hotels",
            title: "Director",
          },
        ]),
        education: JSON.stringify([
          {
            start_year: 2003,
            end_year: 2007,
            school: "Cornell University",
            major: "Hospitality",
            degree: "bachelor",
          },
        ]),
      }),
    ]);

    await screen.getByRole("button", { name: "run import" }).click();
    await expect.element(screen.getByText("imported 1")).toBeVisible();

    const { data: contacts } = await listContacts(dataProvider);
    expect(contacts[0]).toMatchObject({
      contact_type: "channel",
      birthday: "1985-03-12",
      communication_style: "D",
      attitude: "friendly",
      tenure_years: 3.5,
      social_organization: "alumni",
      work_experience: [
        {
          start_year: 2015,
          end_year: 2020,
          company: "Acme Hotels",
          title: "Director",
        },
      ],
      education: [
        {
          start_year: 2003,
          end_year: 2007,
          school: "Cornell University",
          major: "Hospitality",
          degree: "bachelor",
        },
      ],
    });
  });

  it("accepts enum labels in the profile columns and ignores malformed history JSON", async () => {
    const { dataProvider, screen } = await renderImport([
      contactRow({
        first_name: "Grace",
        last_name: "Hopper",
        // The configured labels, as a user would type them in a spreadsheet
        contact_type: "Channel",
        communication_style: "D - Dominance",
        attitude: "Friendly",
        social_organization: "Alumni association",
        work_experience: "not json",
      }),
    ]);

    await screen.getByRole("button", { name: "run import" }).click();
    await expect.element(screen.getByText("imported 1")).toBeVisible();

    const { data: contacts } = await listContacts(dataProvider);
    expect(contacts[0]).toMatchObject({
      contact_type: "channel",
      communication_style: "D",
      attitude: "friendly",
      social_organization: "alumni",
    });
    // A broken cell is ignored rather than failing the row
    expect(contacts[0].work_experience).toBeUndefined();
  });

  it("imports a legacy CSV that has none of the new columns", async () => {
    const legacyRow = contactRow({
      first_name: "Ada",
      last_name: "Lovelace",
    }) as Record<string, string>;
    [
      "contact_type",
      "birthday",
      "communication_style",
      "attitude",
      "tenure_years",
      "social_organization",
      "work_experience",
      "education",
    ].forEach((column) => delete legacyRow[column]);

    const { dataProvider, screen } = await renderImport([
      legacyRow as unknown as ContactImportSchema,
    ]);

    await screen.getByRole("button", { name: "run import" }).click();
    await expect.element(screen.getByText("imported 1")).toBeVisible();

    const { data: contacts } = await listContacts(dataProvider);
    expect(contacts[0]).toMatchObject({
      first_name: "Ada",
      last_name: "Lovelace",
    });
    expect(contacts[0].attitude).toBeUndefined();
    expect(contacts[0].work_experience).toBeUndefined();
  });
});
