import { datatype, lorem, random } from "faker/locale/en_US";

import { defaultContactAttitudes } from "../../../root/defaultConfiguration";
import type { DealContact } from "../../../types";
import type { Db } from "./types";

const roles = ["decision_maker", "influencer", "user", "gatekeeper"];
const influences = ["high", "medium", "low"];

/** The generated deals' stakeholders: one to three contacts per deal. */
export const generateDealContacts = (db: Db): DealContact[] => {
  const dealContacts: DealContact[] = [];
  db.deals.forEach((deal) => {
    if (deal.company_id == null) return;
    const companyContacts = db.contacts.filter(
      (contact) => contact.company_id === deal.company_id,
    );
    if (companyContacts.length === 0) return;
    random
      .arrayElements(
        companyContacts,
        datatype.number({ min: 1, max: Math.min(3, companyContacts.length) }),
      )
      .forEach((contact, index) => {
        dealContacts.push({
          id: dealContacts.length,
          deal_id: deal.id,
          contact_id: contact.id,
          role: random.arrayElement(roles),
          attitude: random.arrayElement(defaultContactAttitudes).value,
          influence: random.arrayElement(influences),
          pain: lorem.sentence(),
          index,
        });
      });
  });
  return dealContacts;
};
