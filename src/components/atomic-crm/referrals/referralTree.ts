import type { Contact } from "../types";
import { getContactName } from "../misc/displayName";

export type ReferralForest = {
  byId: Map<number, Contact>;
  roots: Contact[];
  childrenOf: Map<number, Contact[]>;
};

/**
 * Build the referral forest from a flat contact list. A contact whose referrer
 * is missing from the list is treated as a root; cycles cannot be rendered but
 * are also not possible to create from the UI (the tree page stops at loops).
 */
export const buildReferralForest = (contacts: Contact[]): ReferralForest => {
  const byId = new Map<number, Contact>();
  for (const contact of contacts) byId.set(Number(contact.id), contact);
  const childrenOf = new Map<number, Contact[]>();
  const roots: Contact[] = [];
  for (const contact of contacts) {
    const referrer = contact.referrer_contact_id;
    if (referrer != null && byId.has(Number(referrer))) {
      const list = childrenOf.get(Number(referrer)) ?? [];
      list.push(contact);
      childrenOf.set(Number(referrer), list);
    } else {
      roots.push(contact);
    }
  }
  const sortByName = (a: Contact, b: Contact) =>
    getContactName(a).localeCompare(getContactName(b), "zh-Hans-CN");
  for (const list of childrenOf.values()) list.sort(sortByName);
  roots.sort(sortByName);
  return { byId, roots, childrenOf };
};

/** Referrers from the root down to the contact's direct referrer. */
export const getReferralAncestors = (
  contact: Contact,
  byId: Map<number, Contact>,
): Contact[] => {
  const chain: Contact[] = [];
  const seen = new Set<number>([Number(contact.id)]);
  let current = contact;
  while (current.referrer_contact_id != null) {
    const parent = byId.get(Number(current.referrer_contact_id));
    if (!parent || seen.has(Number(parent.id))) break;
    seen.add(Number(parent.id));
    chain.unshift(parent);
    current = parent;
  }
  return chain;
};
