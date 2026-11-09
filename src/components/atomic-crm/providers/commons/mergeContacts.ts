import type { Identifier, DataProvider, RaRecord } from "ra-core";

import type {
  Contact,
  DealContact,
  DealMeeting,
  Task,
  ContactNote,
} from "../../types";

/**
 * Merge one contact (loser) into another contact (winner).
 *
 * This function copies properties from the loser to the winner contact,
 * transfers all associated data (tasks, notes, deals) from the loser to the winner,
 * and deletes the loser contact.
 */
export const mergeContacts = async (
  loserId: Identifier,
  winnerId: Identifier,
  dataProvider: DataProvider,
) => {
  // Fetch both contacts using dataProvider to get fresh data
  const { data: winnerContact } = await dataProvider.getOne<Contact>(
    "contacts",
    { id: winnerId },
  );
  const { data: loserContact } = await dataProvider.getOne<Contact>(
    "contacts",
    { id: loserId },
  );

  if (!winnerContact || !loserContact) {
    throw new Error("Could not fetch contacts");
  }

  // 1. Reassign all tasks from loser to winner
  const { data: loserTasks } = await dataProvider.getManyReference<Task>(
    "tasks",
    {
      target: "contact_id",
      id: loserId,
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    },
  );

  const taskUpdates =
    loserTasks?.map((task) =>
      dataProvider.update("tasks", {
        id: task.id,
        data: { contact_id: winnerId },
        previousData: task,
      }),
    ) || [];

  // 2. Reassign all notes from loser to winner
  const { data: loserNotes } = await dataProvider.getManyReference<ContactNote>(
    "contact_notes",
    {
      target: "contact_id",
      id: loserId,
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    },
  );

  const noteUpdates =
    loserNotes?.map((note) =>
      dataProvider.update<ContactNote>("contact_notes", {
        id: note.id,
        data: { contact_id: winnerId },
        previousData: note,
      }),
    ) || [];

  // 3. Reassign the loser's deal stakeholders to the winner. The new data
  // model stores them in the deal_contacts join table (the old
  // deals.contact_ids array is gone); the database merge_contacts function
  // does the same server-side. Older data providers may not have these
  // resources yet, so the transfer is best-effort.
  const dealContactUpdates = await reassignDealContacts(
    loserId,
    winnerId,
    dataProvider,
  );
  const dealMeetingUpdates = await reassignDealMeetings(
    loserId,
    winnerId,
    dataProvider,
  );

  // 4. Update winner contact with loser data
  const mergedEmails = mergeObjectArraysUnique(
    winnerContact.email_jsonb || [],
    loserContact.email_jsonb || [],
    (email) => email.email,
  );

  const mergedPhones = mergeObjectArraysUnique(
    winnerContact.phone_jsonb || [],
    loserContact.phone_jsonb || [],
    (phone) => phone.number,
  );

  const winnerUpdate = dataProvider.update<Contact>("contacts", {
    id: winnerId,
    data: {
      avatar:
        winnerContact.avatar && winnerContact.avatar.src
          ? winnerContact.avatar
          : loserContact.avatar,
      gender: winnerContact.gender ?? loserContact.gender,
      // The winner keeps its identity: its full name when it has one, the
      // loser's otherwise (so merging away a name-only contact from an English
      // one does not drop the only display name left).
      name: winnerContact.name || loserContact.name,
      first_name: winnerContact.first_name ?? loserContact.first_name,
      last_name: winnerContact.last_name ?? loserContact.last_name,
      title: winnerContact.title ?? loserContact.title,
      company_id: winnerContact.company_id ?? loserContact.company_id,
      email_jsonb: mergedEmails,
      phone_jsonb: mergedPhones,
      wechat_id: winnerContact.wechat_id || loserContact.wechat_id,
      contact_type: winnerContact.contact_type ?? loserContact.contact_type,
      birthday: winnerContact.birthday ?? loserContact.birthday,
      communication_style:
        winnerContact.communication_style ?? loserContact.communication_style,
      attitude: winnerContact.attitude ?? loserContact.attitude,
      tenure_years: winnerContact.tenure_years ?? loserContact.tenure_years,
      social_organization:
        winnerContact.social_organization ?? loserContact.social_organization,
      // Lists of positions and schools are unioned, deduplicated on the exact
      // stored entry (as jsonb_agg(DISTINCT ...) does server-side).
      work_experience: mergeHistory(
        winnerContact.work_experience,
        loserContact.work_experience,
      ),
      education: mergeHistory(winnerContact.education, loserContact.education),
      background: winnerContact.background ?? loserContact.background,
      has_newsletter:
        winnerContact.has_newsletter ?? loserContact.has_newsletter,
      first_seen: winnerContact.first_seen ?? loserContact.first_seen,
      last_seen:
        winnerContact.last_seen > loserContact.last_seen
          ? winnerContact.last_seen
          : loserContact.last_seen,
      sales_id: winnerContact.sales_id ?? loserContact.sales_id,
      tags: mergeArraysUnique(
        winnerContact.tags || [],
        loserContact.tags || [],
      ),
    },
    previousData: winnerContact,
  });

  // Execute all updates
  await Promise.all([
    ...taskUpdates,
    ...noteUpdates,
    ...dealContactUpdates,
    ...dealMeetingUpdates,
    winnerUpdate,
  ]);

  // 5. Delete the loser contact
  await dataProvider.delete<Contact>("contacts", {
    id: loserId,
    previousData: loserContact,
  });
};

type DealContactRow = Pick<DealContact, "id" | "deal_id" | "contact_id">;

const listRows = async <T extends RaRecord>(
  dataProvider: DataProvider,
  resource: string,
  filter: Record<string, unknown>,
): Promise<T[]> => {
  try {
    const { data } = await dataProvider.getList<T>(resource, {
      filter,
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
    });
    return data ?? [];
  } catch {
    // A data provider without the new join tables yet (e.g. an older FakeRest
    // database): nothing to transfer.
    return [];
  }
};

/**
 * Moves the loser's deal stakeholders to the winner. A deal that already has
 * the winner as a stakeholder drops the loser's duplicate row.
 */
const reassignDealContacts = async (
  loserId: Identifier,
  winnerId: Identifier,
  dataProvider: DataProvider,
): Promise<Promise<unknown>[]> => {
  const loserRows = await listRows<DealContactRow>(
    dataProvider,
    "deal_contacts",
    { contact_id: loserId },
  );
  if (loserRows.length === 0) return [];

  const winnerRows = await listRows<DealContactRow>(
    dataProvider,
    "deal_contacts",
    { contact_id: winnerId },
  );
  const winnerDealIds = new Set(winnerRows.map((row) => String(row.deal_id)));

  return loserRows.map((row) =>
    winnerDealIds.has(String(row.deal_id))
      ? dataProvider.delete("deal_contacts", {
          id: row.id,
          previousData: row,
        })
      : dataProvider.update("deal_contacts", {
          id: row.id,
          data: { contact_id: winnerId },
          previousData: row,
        }),
  );
};

/** Replaces the loser with the winner in the customer attendees of meetings. */
const reassignDealMeetings = async (
  loserId: Identifier,
  winnerId: Identifier,
  dataProvider: DataProvider,
): Promise<Promise<unknown>[]> => {
  const meetings = await listRows<DealMeeting>(dataProvider, "deal_meetings", {
    "customer_attendee_ids@cs": `{${loserId}}`,
  });
  return meetings.map((meeting) => {
    const attendees = Array.from(
      new Set(
        [...(meeting.customer_attendee_ids ?? []), winnerId]
          .filter((id) => String(id) !== String(loserId))
          .map(String),
      ),
    );
    return dataProvider.update("deal_meetings", {
      id: meeting.id,
      data: { customer_attendee_ids: attendees },
      previousData: meeting,
    });
  });
};

// Helper functions to merge arrays and remove duplicates

// For primitive arrays like tags
const mergeArraysUnique = <T>(arr1: T[], arr2: T[]): T[] => [
  ...new Set([...arr1, ...arr2]),
];

/** Union of two history arrays, deduplicated on the exact stored entry. */
const mergeHistory = <T>(arr1?: T[] | null, arr2?: T[] | null): T[] => {
  const seen = new Set<string>();
  return [...(arr1 ?? []), ...(arr2 ?? [])].filter((entry) => {
    const key = JSON.stringify(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// For object arrays like emails and phones
function mergeObjectArraysUnique<T>(
  arr1: T[],
  arr2: T[],
  getKey: (item: T) => string,
): T[] {
  const map = new Map<string, T>();

  arr1.forEach((item) => {
    const key = getKey(item);
    if (key) map.set(key, item);
  });

  arr2.forEach((item) => {
    const key = getKey(item);
    if (key && !map.has(key)) {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
}
