import { Mars, NonBinary, Venus } from "lucide-react";

import type {
  Company,
  Contact,
  ContactGender,
  Education,
  LabeledValue,
  WorkExperience,
} from "../types";
import { getContactName } from "../misc/displayName";

export const defaultEmailJsonb = [{ email: null, type: null }];
export const defaultPhoneJsonb = [{ number: null, type: null }];

const toNullableNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toNullableYear = (value: unknown): number | null => {
  const year = toNullableNumber(value);
  return year == null ? null : Math.round(year);
};

const cleanWorkExperience = (
  entries?: WorkExperience[] | null,
): WorkExperience[] =>
  (entries ?? [])
    .map(({ start_year, end_year, company, title }) => ({
      start_year: toNullableYear(start_year),
      end_year: toNullableYear(end_year),
      company: company?.trim() || undefined,
      title: title?.trim() || undefined,
    }))
    .filter((entry) =>
      Object.values(entry).some((value) => value != null && value !== ""),
    );

const cleanEducation = (entries?: Education[] | null): Education[] =>
  (entries ?? [])
    .map(({ start_year, end_year, school, major, degree }) => ({
      start_year: toNullableYear(start_year),
      end_year: toNullableYear(end_year),
      school: school?.trim() || undefined,
      major: major?.trim() || undefined,
      degree: degree?.trim() || undefined,
    }))
    .filter((entry) =>
      Object.values(entry).some((value) => value != null && value !== ""),
    );

const cleanContactArrayFields = (data: Contact) => {
  const cleanedEmailJsonb =
    data.email_jsonb?.filter((e) => e.email != null) || [];
  const cleanedPhoneJsonb =
    data.phone_jsonb?.filter((p) => p.number != null) || [];
  return {
    ...data,
    phone_jsonb: cleanedPhoneJsonb.length > 0 ? cleanedPhoneJsonb : null,
    email_jsonb: cleanedEmailJsonb.length > 0 ? cleanedEmailJsonb : null,
    // Empty form values must not reach a date or numeric column as ""
    contact_type: data.contact_type || null,
    birthday: data.birthday || null,
    communication_style: data.communication_style || null,
    attitude: data.attitude || null,
    tenure_years: toNullableNumber(data.tenure_years),
    social_organization: data.social_organization || null,
    work_experience: cleanWorkExperience(data.work_experience),
    education: cleanEducation(data.education),
  };
};

export const cleanupContactForCreate = (data: Contact) => {
  return cleanContactArrayFields({
    ...data,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString(),
    tags: [],
  });
};

export const cleanupContactForEdit = cleanContactArrayFields;

type TranslateFn = (key: string, options?: { [key: string]: any }) => string;

export const contactGenderDefaultLabels: Record<string, string> = {
  male: "He/Him",
  female: "She/Her",
  nonbinary: "They/Them",
};

const personalInfoTypeMap: Record<string, string> = {
  Work: "work",
  Home: "home",
  Other: "other",
};

export const contactGender: ContactGender[] = [
  {
    value: "male",
    label: "resources.contacts.inputs.genders.male",
    icon: Mars,
  },
  {
    value: "female",
    label: "resources.contacts.inputs.genders.female",
    icon: Venus,
  },
  {
    value: "nonbinary",
    label: "resources.contacts.inputs.genders.nonbinary",
    icon: NonBinary,
  },
];

export const translateContactGenderLabel = (
  gender: { value: string; label: string },
  translate: TranslateFn,
) =>
  translate(gender.label, {
    _: contactGenderDefaultLabels[gender.value] ?? gender.label,
  });

export const translatePersonalInfoTypeLabel = (
  type: string,
  translate: TranslateFn,
) =>
  translate(
    `resources.contacts.inputs.personal_info_types.${personalInfoTypeMap[type] ?? type.toLowerCase()}`,
    {
      _: type,
    },
  );

/** Label of a configured option, e.g. the contact type or attitude labels. */
export const findOptionLabel = (
  options: LabeledValue[],
  value?: string | null,
) => options.find((option) => option.value === value)?.label;

/** "2018 – 2021", "2018 –", "– 2021" or "" depending on the known years. */
export const formatYearRange = (
  startYear?: number | null,
  endYear?: number | null,
) => {
  if (startYear == null && endYear == null) return "";
  if (startYear == null) return `– ${endYear}`;
  if (endYear == null) return `${startYear} –`;
  return `${startYear} – ${endYear}`;
};

/**
 * Formats a birthday stored as a plain `YYYY-MM-DD` date without letting the
 * browser timezone shift it to the previous day.
 */
export const formatContactBirthday = (birthday: string, locale = "en") => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday);
  if (!match) return birthday;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return birthday;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
};

/** Escapes a value for a text field of a vCard (3.0). */
const escapeVCardText = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

/**
 * Folds a long line according to vCard specification (max 75 chars per line)
 * Continuation lines start with a space
 */
function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) return line;

  const result: string[] = [];
  let currentLine = line.substring(0, maxLength);
  let remaining = line.substring(maxLength);

  result.push(currentLine);

  while (remaining.length > 0) {
    // Continuation lines start with a space and can have 74 more chars
    const chunkSize = maxLength - 1;
    currentLine = " " + remaining.substring(0, chunkSize);
    remaining = remaining.substring(chunkSize);
    result.push(currentLine);
  }

  return result.join("\r\n");
}

/**
 * Converts a contact and their company to vCard 3.0 format
 */
export function exportToVCard(
  contact: Contact,
  company?: Company,
  photoData?: { base64: string; mimeType: string },
): string {
  const lines: string[] = [];

  // vCard header
  lines.push("BEGIN:VCARD");
  lines.push("VERSION:3.0");

  // Name (N: Family Name;Given Name;Additional Names;Honorific Prefixes;Honorific Suffixes)
  // A Chinese full name has no first/last split, so it fills the family name
  // component; contacts without one keep the legacy first/last mapping.
  const fullName = getContactName(contact);
  lines.push(
    contact.name?.trim()
      ? `N:${contact.name.trim()};;;;`
      : `N:${contact.last_name ?? ""};${contact.first_name ?? ""};;;`,
  );

  // Formatted name
  lines.push(`FN:${fullName}`);

  // Title/Job position
  if (contact.title) {
    lines.push(`TITLE:${contact.title}`);
  }

  // Organization
  if (company?.name) {
    lines.push(`ORG:${company.name}`);
  }

  // Emails
  if (contact.email_jsonb && contact.email_jsonb.length > 0) {
    contact.email_jsonb.forEach((emailObj) => {
      const type = emailObj.type.toUpperCase();
      lines.push(`EMAIL;TYPE=${type}:${emailObj.email}`);
    });
  }

  // Phone numbers
  if (contact.phone_jsonb && contact.phone_jsonb.length > 0) {
    contact.phone_jsonb.forEach((phoneObj) => {
      const type = phoneObj.type.toUpperCase();
      lines.push(`TEL;TYPE=${type}:${phoneObj.number}`);
    });
  }

  // WeChat ID
  if (contact.wechat_id) {
    lines.push(`X-WECHAT:${contact.wechat_id}`);
  }

  // Birthday: vCard 3.0 expects a plain date
  if (contact.birthday) {
    const birthday = /^\d{4}-\d{2}-\d{2}/.exec(contact.birthday)?.[0];
    if (birthday) {
      lines.push(`BDAY:${birthday}`);
    }
  }

  // Profile fields of the CRM data model, kept in machine-readable X- fields
  // so the standard FN/N/TEL/EMAIL/BDAY lines stay untouched.
  if (contact.contact_type) {
    lines.push(`X-CONTACT-TYPE:${escapeVCardText(contact.contact_type)}`);
  }
  if (contact.communication_style) {
    lines.push(
      `X-COMMUNICATION-STYLE:${escapeVCardText(contact.communication_style)}`,
    );
  }
  if (contact.attitude) {
    lines.push(`X-ATTITUDE:${escapeVCardText(contact.attitude)}`);
  }
  if (contact.tenure_years != null) {
    lines.push(`X-TENURE-YEARS:${contact.tenure_years}`);
  }
  if (contact.social_organization) {
    lines.push(
      `X-SOCIAL-ORGANIZATION:${escapeVCardText(contact.social_organization)}`,
    );
  }
  (contact.work_experience ?? []).forEach((entry) => {
    const value = [
      formatYearRange(entry.start_year, entry.end_year),
      entry.company,
      entry.title,
    ]
      .filter((part) => part)
      .join("|");
    if (value) lines.push(`X-WORK-EXPERIENCE:${escapeVCardText(value)}`);
  });
  (contact.education ?? []).forEach((entry) => {
    const value = [
      formatYearRange(entry.start_year, entry.end_year),
      entry.school,
      entry.major,
      entry.degree,
    ]
      .filter((part) => part)
      .join("|");
    if (value) lines.push(`X-EDUCATION:${escapeVCardText(value)}`);
  });

  // Background/Note
  if (contact.background) {
    lines.push(`NOTE:${escapeVCardText(contact.background)}`);
  }

  // Photo/Avatar - vCard 3.0 format with base64 encoding
  if (photoData) {
    // Extract image type from MIME type (e.g., "image/png" -> "PNG")
    const imageType = photoData.mimeType.split("/")[1]?.toUpperCase() || "PNG";

    // vCard 3.0 format: PHOTO;ENCODING=b;TYPE=PNG:
    const photoLine = `PHOTO;ENCODING=b;TYPE=${imageType}:${photoData.base64}`;
    lines.push(foldLine(photoLine));
  }

  // vCard footer
  lines.push("END:VCARD");

  return lines.join("\r\n");
}
