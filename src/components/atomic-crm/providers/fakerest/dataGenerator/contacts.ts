import {
  address,
  company as fakerCompany,
  internet,
  lorem,
  name,
  phone,
  random,
} from "faker/locale/en_US";

import {
  defaultCommunicationStyles,
  defaultContactAttitudes,
  defaultContactTypes,
  defaultEducationDegrees,
  defaultNoteStatuses,
  defaultSocialOrganizations,
} from "../../../root/defaultConfiguration";
import { contactGender } from "../../../contacts/contactModel";
import type {
  Company,
  Contact,
  Education,
  WorkExperience,
} from "../../../types";
import type { Db } from "./types";
import {
  chineseFullName,
  randomDate,
  randomFloat,
  weightedBoolean,
} from "./utils";

const maxContacts = {
  1: 1,
  10: 4,
  50: 12,
  250: 25,
  500: 50,
};

const getRandomContactDetailsType = () =>
  random.arrayElement(["Work", "Home", "Other"]) as "Work" | "Home" | "Other";

const randomBirthday = () => {
  const date = new Date(
    1965 + random.number({ min: 0, max: 35 }),
    random.number({ min: 0, max: 11 }),
    random.number({ min: 1, max: 28 }),
  );
  return date.toISOString().slice(0, 10);
};

const randomWorkExperience = (): WorkExperience[] => {
  const count = random.arrayElement([0, 0, 1, 1, 2]);
  const entries: WorkExperience[] = [];
  let year = 1995 + random.number({ min: 0, max: 15 });
  for (let index = 0; index < count; index++) {
    const endYear = year + random.number({ min: 1, max: 5 });
    entries.push({
      start_year: year,
      end_year: endYear > 2025 ? null : endYear,
      company: fakerCompany.companyName(),
      title: name.jobTitle(),
    });
    year = endYear + random.number({ min: 0, max: 3 });
  }
  return entries;
};

const randomEducation = (): Education[] => {
  const count = random.arrayElement([0, 1, 1, 2]);
  const entries: Education[] = [];
  for (let index = 0; index < count; index++) {
    const startYear = 1990 + random.number({ min: 0, max: 20 });
    const endYear = startYear + random.number({ min: 2, max: 4 });
    entries.push({
      start_year: startYear,
      end_year: endYear,
      school: `${address.city()} University`,
      major: name.jobTitle(),
      degree: random.arrayElement(defaultEducationDegrees).value,
    });
  }
  return entries;
};

export const generateContacts = (db: Db, size = 500): Required<Contact>[] => {
  const nbAvailblePictures = 223;
  let numberOfContacts = 0;

  return Array.from(Array(size).keys()).map((id) => {
    const has_avatar =
      weightedBoolean(25) && numberOfContacts < nbAvailblePictures;
    const gender = random.arrayElement(contactGender).value;
    const first_name = name.firstName(gender as any);
    const last_name = name.lastName();
    const email_jsonb = [
      {
        email: internet.email(first_name, last_name),
        type: getRandomContactDetailsType(),
      },
    ];
    const phone_jsonb = [
      {
        number: phone.phoneNumber(),
        type: getRandomContactDetailsType(),
      },
      {
        number: phone.phoneNumber(),
        type: getRandomContactDetailsType(),
      },
    ];
    const avatar = {
      src: has_avatar
        ? "https://marmelab.com/posters/avatar-" +
          (223 - numberOfContacts) +
          ".jpeg"
        : undefined,
    };
    const title = fakerCompany.bsAdjective();

    if (has_avatar) {
      numberOfContacts++;
    }

    // choose company with people left to know
    let company: Company;
    do {
      company = random.arrayElement(db.companies);
    } while ((company.nb_contacts ?? 0) >= maxContacts[company.size]);
    company.nb_contacts = (company.nb_contacts ?? 0) + 1;

    const first_seen = randomDate(new Date(company.created_at)).toISOString();
    const last_seen = first_seen;

    return {
      id,
      name: chineseFullName(),
      first_name,
      last_name,
      gender,
      title: title.charAt(0).toUpperCase() + title.substr(1),
      company_id: company.id,
      company_name: company.name,
      referrer_contact_id: null,
      email_jsonb,
      phone_jsonb,
      background: lorem.sentence(),
      acquisition: random.arrayElement(["inbound", "outbound"]),
      avatar,
      first_seen: first_seen,
      last_seen: last_seen,
      has_newsletter: weightedBoolean(30),
      status: random.arrayElement(defaultNoteStatuses).value,
      tags: random
        .arrayElements(db.tags, random.arrayElement([0, 0, 0, 1, 1, 2]))
        .map((tag) => tag.id), // finalize
      sales_id: company.sales_id!,
      nb_tasks: 0,
      wechat_id: null,
      contact_type: random.arrayElement(defaultContactTypes).value,
      birthday: randomBirthday(),
      communication_style: random.arrayElement(defaultCommunicationStyles)
        .value,
      attitude: random.arrayElement(defaultContactAttitudes).value,
      tenure_years: parseFloat(randomFloat(0, 20).toFixed(1)),
      social_organization: random.arrayElement(defaultSocialOrganizations)
        .value,
      work_experience: randomWorkExperience(),
      education: randomEducation(),
    };
  });
};
