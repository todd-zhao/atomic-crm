import { describe, expect, it } from "vitest";

import { buildContact } from "@/test/StoryWrapper";
import {
  cleanupContactForCreate,
  exportToVCard,
  formatContactBirthday,
  formatYearRange,
} from "./contactModel";

describe("exportToVCard", () => {
  it("uses the optional full name as the formatted and structured name", () => {
    const vCard = exportToVCard(buildContact({ name: "张伟" }));

    // A Chinese full name has no first/last split, so it fills the family name
    expect(vCard).toContain("N:张伟;;;;");
    expect(vCard).toContain("FN:张伟");
  });

  it("falls back to the first and last name for a contact without one", () => {
    const vCard = exportToVCard(buildContact());

    expect(vCard).toContain("N:Lovelace;Ada;;;");
    expect(vCard).toContain("FN:Ada Lovelace");
  });

  it("exports the birthday and the repeatable history without breaking the standard fields", () => {
    const vCard = exportToVCard(
      buildContact({
        attitude: "friendly",
        birthday: "1985-03-12",
        communication_style: "D",
        contact_type: "channel",
        education: [
          {
            degree: "bachelor",
            end_year: 2007,
            major: "Hospitality",
            school: "Cornell University",
            start_year: 2003,
          },
        ],
        social_organization: "alumni",
        tenure_years: 3.5,
        work_experience: [
          {
            company: "Acme Hotels",
            end_year: 2020,
            start_year: 2015,
            title: "Director",
          },
        ],
      }),
    );

    expect(vCard).toContain("BDAY:1985-03-12");
    expect(vCard).toContain(
      "X-WORK-EXPERIENCE:2015 – 2020|Acme Hotels|Director",
    );
    expect(vCard).toContain(
      "X-EDUCATION:2003 – 2007|Cornell University|Hospitality|bachelor",
    );
    expect(vCard).toContain("X-CONTACT-TYPE:channel");
    expect(vCard).toContain("X-COMMUNICATION-STYLE:D");
    expect(vCard).toContain("X-ATTITUDE:friendly");
    expect(vCard).toContain("X-TENURE-YEARS:3.5");
    expect(vCard).toContain("X-SOCIAL-ORGANIZATION:alumni");

    // The standard lines still lead the card
    expect(vCard).toContain("FN:Ada Lovelace");
    expect(vCard).toContain("N:Lovelace;Ada;;;");
    expect(vCard).toContain("EMAIL;TYPE=WORK:ada@example.com");
  });

  it("omits the profile extension lines for a contact without those fields", () => {
    const vCard = exportToVCard(
      buildContact({
        attitude: null,
        birthday: null,
        communication_style: null,
        contact_type: null,
        education: [],
        social_organization: null,
        tenure_years: null,
        work_experience: [],
      }),
    );

    expect(vCard).not.toContain("BDAY:");
    expect(vCard).not.toContain("X-WORK-EXPERIENCE:");
    expect(vCard).not.toContain("X-EDUCATION:");
    expect(vCard).not.toContain("X-CONTACT-TYPE:");
    expect(vCard).not.toContain("X-ATTITUDE:");
  });
});

describe("cleanupContactForCreate", () => {
  it("normalizes empty profile values and drops empty history rows", () => {
    const data = cleanupContactForCreate(
      buildContact({
        attitude: "",
        birthday: "",
        communication_style: "",
        contact_type: "",
        education: [
          {
            degree: "bachelor",
            major: "",
            school: "Cornell University",
          },
          {},
        ],
        social_organization: "",
        tenure_years: null,
        work_experience: [
          {
            company: "Acme Hotels",
            end_year: 2020,
            start_year: 2015,
            title: "Director",
          },
          {},
        ],
      }),
    );

    expect(data.contact_type).toBeNull();
    expect(data.birthday).toBeNull();
    expect(data.communication_style).toBeNull();
    expect(data.attitude).toBeNull();
    expect(data.tenure_years).toBeNull();
    expect(data.social_organization).toBeNull();
    expect(data.work_experience).toEqual([
      {
        company: "Acme Hotels",
        end_year: 2020,
        start_year: 2015,
        title: "Director",
      },
    ]);
    expect(data.education).toEqual([
      {
        degree: "bachelor",
        end_year: null,
        major: undefined,
        school: "Cornell University",
        start_year: null,
      },
    ]);
  });

  it("keeps a decimal tenure and empty history as arrays", () => {
    const data = cleanupContactForCreate(
      buildContact({ tenure_years: 3.5, work_experience: null, education: [] }),
    );

    expect(data.tenure_years).toBe(3.5);
    expect(data.work_experience).toEqual([]);
    expect(data.education).toEqual([]);
  });
});

describe("contactModel helpers", () => {
  it("formats a birthday without a timezone shift", () => {
    expect(formatContactBirthday("1985-03-12", "en")).toBe("March 12, 1985");
  });

  it("formats the known years of a history entry", () => {
    expect(formatYearRange(2015, 2020)).toBe("2015 – 2020");
    expect(formatYearRange(2015, null)).toBe("2015 –");
    expect(formatYearRange(null, 2020)).toBe("– 2020");
    expect(formatYearRange()).toBe("");
  });
});
