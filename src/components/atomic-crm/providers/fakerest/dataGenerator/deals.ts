import { add } from "date-fns";
import { datatype, lorem, random } from "faker/locale/en_US";

import {
  defaultDealSources,
  defaultDealStages,
  defaultDealStatuses,
  defaultDealTypes,
} from "../../../root/defaultConfiguration";
import type { Deal } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

export const generateDeals = (db: Db): Deal[] => {
  // Two company directories: deals attach to hotels, and channel-sourced deals
  // additionally reference the channel company they came from.
  const hotels = db.companies.filter(
    (company) => company.company_kind !== "channel",
  );
  const channels = db.companies.filter(
    (company) => company.company_kind === "channel",
  );
  const dealCompanies = hotels.length ? hotels : db.companies;

  const deals = Array.from(Array(50).keys()).map((id) => {
    const company = random.arrayElement(dealCompanies);
    company.nb_deals = (company.nb_deals ?? 0) + 1;
    const lowercaseName = lorem.words();
    const created_at = randomDate(new Date(company.created_at)).toISOString();

    const expected_closing_date = randomDate(
      new Date(created_at),
      add(new Date(created_at), { months: 6 }),
    )
      .toISOString()
      .split("T")[0];

    const status = random.arrayElement(defaultDealStatuses).value;
    const stage = random.arrayElement(defaultDealStages).value;
    const deal_type = random.arrayElement(defaultDealTypes).value;
    const budget = datatype.number({ min: 50, max: 2000 }) * 1000;
    // Half of the deals face a competitor (competitors are generated first).
    const competitor =
      db.competitors?.length && datatype.number(1) === 0
        ? random.arrayElement(db.competitors)
        : undefined;
    // A third of the deals come through a channel company, when some exist.
    const source_type: string =
      channels.length && datatype.number(2) === 0
        ? "channel"
        : random.arrayElement(defaultDealSources).value;
    const channel =
      source_type === "channel" ? random.arrayElement(channels) : undefined;
    // Some deals have no sales owner: they wait in the lead pool.
    const isUnassigned = datatype.number(4) === 0;

    return {
      id,
      name: lowercaseName[0].toUpperCase() + lowercaseName.slice(1),
      company_id: company.id,
      stage,
      status,
      deal_type,
      source_type,
      channel_id: channel?.id,
      description: lorem.paragraphs(datatype.number({ min: 1, max: 4 })),
      decision_process: lorem.sentences(2),
      budget,
      final_amount:
        status === "won"
          ? Math.round(budget * (0.8 + Math.random() * 0.4))
          : undefined,
      created_at,
      updated_at: randomDate(new Date(created_at)).toISOString(),
      expected_closing_date,
      sales_id: isUnassigned ? undefined : company.sales_id!,
      // Generated column in Postgres; FakeRest stores it explicitly.
      is_unassigned: isUnassigned,
      competitor_id: competitor?.id,
      attachments: [],
      index: 0,
    };
  });
  // compute index based on status (the board groups deals by status)
  defaultDealStatuses.forEach((status) => {
    deals
      .filter((deal) => deal.status === status.value)
      .forEach((deal, index) => {
        deals[deal.id].index = index;
      });
  });
  return deals;
};
