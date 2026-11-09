import type { Company } from "../../../types";
import type { Db } from "./types";

/**
 * Demo-world guardrails for the two company directories and the lead pool.
 *
 * The company and deal generators own most of the data, but `index.ts` wires
 * the world together: it must always contain channel companies (deals refer to
 * them) and some unassigned deals (the lead pool demo would be empty
 * otherwise). These helpers only fill gaps, they never override generated data.
 */

/** Add a demo channel when the companies generator produced hotels only. */
export const ensureChannelCompanies = (db: Db): void => {
  const companies = db.companies;
  // Like the database default: an unspecified company is a hotel.
  companies.forEach((company) => {
    company.company_kind = company.company_kind ?? "hotel";
  });
  if (companies.some((company) => company.company_kind === "channel")) {
    return;
  }
  const fallbackChannel: Company = {
    address: "1 Harbour Road",
    city: "Hong Kong",
    company_kind: "channel",
    channel_type: "travel_agency",
    context_links: [],
    country: "China",
    created_at: new Date().toISOString(),
    description:
      "Travel agency referring hotel opportunities (demo channel company).",
    hotel_services: null,
    hotel_type: null,
    average_room_rate: null,
    opening_year: null,
    rooms: null,
    id: companies.length,
    linkedin_url: "",
    logo: { src: "", title: "" } as Company["logo"],
    name: "Global Travel Partners",
    nb_contacts: 0,
    nb_deals: 0,
    parent_company_id: null,
    phone_number: "",
    revenue: "",
    sales_id: db.sales[0]?.id,
    sector: "travel",
    size: 10,
    state_abbr: "",
    tax_identifier: "",
    website: "",
    zipcode: "",
  };
  companies.push(fallbackChannel);
};

/**
 * Mirror the `is_unassigned` generated column of the database and make sure
 * the demo shows both the public pool and channel-sourced deals.
 */
export const ensureDealAssignment = (db: Db): void => {
  const channels = db.companies.filter(
    (company) => company.company_kind === "channel",
  );
  db.deals.forEach((deal) => {
    deal.source_type = deal.source_type ?? "direct";
    if (
      deal.source_type === "channel" &&
      deal.channel_id == null &&
      channels.length > 0
    ) {
      deal.channel_id = channels[Number(deal.id) % channels.length].id;
    }
    deal.is_unassigned = deal.sales_id == null;
  });

  if (channels.length === 0) return;

  // Give the lead pool a few deals to claim.
  if (!db.deals.some((deal) => deal.is_unassigned)) {
    db.deals
      .filter((_, index) => index % 5 === 0)
      .forEach((deal) => {
        deal.sales_id = undefined;
        deal.is_unassigned = true;
      });
  }

  // And a few channel-sourced deals, so the source column is not always direct.
  if (!db.deals.some((deal) => deal.source_type === "channel")) {
    db.deals
      .filter((_, index) => index % 4 === 1)
      .forEach((deal, index) => {
        deal.source_type = "channel";
        deal.channel_id = channels[index % channels.length].id;
      });
  }
};
