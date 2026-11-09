import { describe, expect, it } from "vitest";
import { buildContact } from "@/test/StoryWrapper";

import { buildReferralForest, getReferralAncestors } from "./referralTree";

const makeContact = (id: number, name: string, referrer?: number) =>
  buildContact({ id, name, referrer_contact_id: referrer ?? null });

describe("referralTree", () => {
  const contacts = [
    makeContact(1, "张伟"),
    makeContact(2, "李娜", 1),
    makeContact(3, "王强", 1),
    makeContact(4, "刘洋", 2),
    makeContact(5, "陈静", 4),
    makeContact(6, "孙丽"),
  ];

  it("builds roots and children from referrer ids", () => {
    const forest = buildReferralForest(contacts);
    expect(forest.roots.map((contact) => contact.id)).toEqual([6, 1]);
    expect(
      forest.childrenOf.get(1)?.map((contact) => contact.name) ?? [],
    ).toEqual(["李娜", "王强"]);
    expect(forest.childrenOf.get(2)?.map((contact) => contact.id)).toEqual([4]);
    expect(forest.childrenOf.get(4)?.map((contact) => contact.id)).toEqual([5]);
  });

  it("returns the chain of referrers from the root to the direct referrer", () => {
    const forest = buildReferralForest(contacts);
    expect(
      getReferralAncestors(forest.byId.get(5)!, forest.byId).map(
        (contact) => contact.name,
      ),
    ).toEqual(["张伟", "李娜", "刘洋"]);
    expect(getReferralAncestors(forest.byId.get(1)!, forest.byId)).toEqual([]);
  });

  it("treats a missing referrer as a root and stops on cycles", () => {
    const cyclic = [
      makeContact(1, "甲", 2),
      makeContact(2, "乙", 1),
      makeContact(3, "丙", 99),
    ];
    const forest = buildReferralForest(cyclic);
    expect(forest.roots.map((contact) => contact.id)).toEqual([3]);
    expect(
      getReferralAncestors(forest.byId.get(1)!, forest.byId).map(
        (contact) => contact.id,
      ),
    ).toEqual([2]);
  });
});
