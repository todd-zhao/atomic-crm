import { generateCompanies } from "./companies";
import { generateCompetitors } from "./competitors";
import { generateContactNotes } from "./contactNotes";
import { generateContacts } from "./contacts";
import { generateDealContacts } from "./dealContacts";
import { generateDealMeetings } from "./dealMeetings";
import { generateDealMilestones } from "./dealMilestones";
import { generateDealNotes } from "./dealNotes";
import { generateDealPains } from "./dealPains";
import { generateDeals } from "./deals";
import {
  ensureChannelCompanies,
  ensureDealAssignment,
} from "./ensureSharedData";
import { finalize } from "./finalize";
import { generateSales } from "./sales";
import { generateTags } from "./tags";
import { generateTasks } from "./tasks";
import type { Db } from "./types";

export default (): Db => {
  const db = {} as Db;
  db.sales = generateSales(db);
  db.tags = generateTags(db);
  // Competitors come before deals, which may reference one.
  db.competitors = generateCompetitors(db);
  db.companies = generateCompanies(db);
  // The demo needs both directories, whatever the companies generator emits.
  ensureChannelCompanies(db);
  db.contacts = generateContacts(db);
  db.contact_notes = generateContactNotes(db);
  db.deals = generateDeals(db);
  // Mirror the database's generated is_unassigned column.
  ensureDealAssignment(db);
  db.deal_contacts = generateDealContacts(db);
  db.deal_pains = generateDealPains(db);
  db.deal_milestones = generateDealMilestones(db);
  db.deal_meetings = generateDealMeetings(db, db.deal_contacts);
  db.deal_notes = generateDealNotes(db);
  db.tasks = generateTasks(db);
  db.configuration = [
    {
      id: 1,
      config: {} as Db["configuration"][number]["config"],
    },
  ];
  finalize(db);

  return db;
};
