import { datatype, lorem, random } from "faker/locale/en_US";

import type { DealMeeting } from "../../../types";
import type { Db } from "./types";
import { randomDate } from "./utils";

/** Zero to two meetings per generated deal, with attendees from both sides. */
export const generateDealMeetings = (
  db: Db,
  dealContacts: Db["deal_contacts"],
): DealMeeting[] => {
  const meetings: DealMeeting[] = [];
  db.deals.forEach((deal) => {
    const attendees = dealContacts
      .filter((dealContact) => dealContact.deal_id === deal.id)
      .map((dealContact) => dealContact.contact_id);
    Array.from(Array(datatype.number({ min: 0, max: 2 })).keys()).forEach(
      () => {
        meetings.push({
          id: meetings.length,
          deal_id: deal.id,
          meeting_date: randomDate(new Date(deal.created_at))
            .toISOString()
            .split("T")[0],
          customer_attendee_ids:
            attendees.length > 0
              ? random.arrayElements(
                  attendees,
                  datatype.number({ min: 1, max: attendees.length }),
                )
              : [],
          our_attendee_ids: db.sales.length
            ? [random.arrayElement(db.sales).id]
            : [],
          content: lorem.paragraph(),
          next_steps: lorem.sentence(),
          created_at: new Date().toISOString(),
          sales_id: deal.sales_id,
        });
      },
    );
  });
  return meetings;
};
