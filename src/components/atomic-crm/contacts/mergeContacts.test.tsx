import { describe, expect, it } from "vitest";

import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import { buildContact, createCrmDb } from "@/test/StoryWrapper";

describe("mergeContacts", () => {
  it("merges the new profile fields, winner first, and unions the history arrays", async () => {
    const winner = buildContact({
      id: 1,
      name: "张伟",
      first_name: "Wei",
      last_name: "Zhang",
      contact_type: "customer",
      birthday: "1985-03-12",
      communication_style: "D",
      attitude: "friendly",
      tenure_years: 3.5,
      social_organization: null,
      work_experience: [
        {
          start_year: 2015,
          end_year: 2020,
          company: "Acme Hotels",
          title: "Director",
        },
      ],
      education: null,
    });
    const loser = buildContact({
      id: 2,
      name: "李娜",
      first_name: "Na",
      last_name: "Li",
      contact_type: "channel",
      birthday: "1990-07-22",
      communication_style: "I",
      attitude: "support",
      tenure_years: 1.5,
      social_organization: "alumni",
      work_experience: [
        // Also on the winner: must not be duplicated
        {
          start_year: 2015,
          end_year: 2020,
          company: "Acme Hotels",
          title: "Director",
        },
        {
          start_year: 2021,
          end_year: null,
          company: "Acme",
          title: "Designer",
        },
      ],
      education: [
        {
          start_year: 2008,
          end_year: 2012,
          school: "Tsinghua University",
          major: "Design",
          degree: "bachelor",
        },
      ],
    });
    const dataProvider = createDataProvider({
      db: createCrmDb({ contacts: [winner, loser] }),
      latency: 0,
      silent: true,
    });

    await dataProvider.mergeContacts(loser.id, winner.id);

    const { data: merged } = await dataProvider.getOne("contacts", {
      id: winner.id,
    });

    // Scalar fields: the winner keeps its value, the loser fills the gaps
    expect(merged.contact_type).toBe("customer");
    expect(merged.birthday).toBe("1985-03-12");
    expect(merged.communication_style).toBe("D");
    expect(merged.attitude).toBe("friendly");
    expect(merged.tenure_years).toBe(3.5);
    expect(merged.social_organization).toBe("alumni");
    expect(merged.name).toBe("张伟");

    // History arrays are merged without duplicates
    expect(merged.work_experience).toEqual([
      {
        start_year: 2015,
        end_year: 2020,
        company: "Acme Hotels",
        title: "Director",
      },
      {
        start_year: 2021,
        end_year: null,
        company: "Acme",
        title: "Designer",
      },
    ]);
    expect(merged.education).toEqual([
      {
        start_year: 2008,
        end_year: 2012,
        school: "Tsinghua University",
        major: "Design",
        degree: "bachelor",
      },
    ]);

    // The loser is deleted
    await expect(
      dataProvider.getOne("contacts", { id: loser.id }),
    ).rejects.toBeTruthy();
  });
});
