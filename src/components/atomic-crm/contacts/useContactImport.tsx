import { useDataProvider, useGetIdentity } from "ra-core";
import { useCallback, useMemo } from "react";

import type { Education, Tag, WorkExperience } from "../types";
import { createEachRow } from "../dataImport/createEachRow";
import { fetchRecordsWithCache } from "../dataImport/fetchRecordsWithCache";
import {
  toConfiguredValue,
  toIsoDate,
  toNumber,
  toText,
} from "../dataImport/parseCell";
import type { ImportCell } from "../dataImport/types";
import { useCompanyResolver } from "../dataImport/useCompanyResolver";
import { useConfigurationContext } from "../root/ConfigurationContext";

export type ContactImportSchema = {
  name: string;
  first_name: string;
  last_name: string;
  gender: string;
  title: string;
  company: string;
  email_work: string;
  email_home: string;
  email_other: string;
  phone_work: string;
  phone_home: string;
  phone_other: string;
  background: string;
  avatar: string;
  first_seen: string;
  last_seen: string;
  has_newsletter: string;
  status: string;
  tags: string;
  wechat_id: string;
  contact_type: string;
  birthday: string;
  communication_style: string;
  attitude: string;
  tenure_years: string;
  social_organization: string;
  /** JSON array, one entry per past position (start_year/end_year/company/title). */
  work_experience: string;
  /** JSON array, one entry per school (start_year/end_year/school/major/degree). */
  education: string;
};

export function useContactImport() {
  const today = new Date().toISOString();
  const user = useGetIdentity();
  const dataProvider = useDataProvider();
  const {
    contactTypes,
    contactAttitudes,
    communicationStyles,
    socialOrganizations,
    educationDegrees,
  } = useConfigurationContext();

  const getCompanies = useCompanyResolver();

  // Tags cache to avoid creating the same tag multiple times and costly roundtrips
  // Cache is dependent of dataProvider, so it's safe to use it as a dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tagsCache = useMemo(() => new Map<string, Tag>(), [dataProvider]);
  const getTags = useCallback(
    async (names: string[]) =>
      fetchRecordsWithCache<Tag>(
        "tags",
        tagsCache,
        names,
        (name) => ({
          name,
          color: "#f9f9f9",
        }),
        dataProvider,
      ),
    [tagsCache, dataProvider],
  );

  const processBatch = useCallback(
    async (batch: ContactImportSchema[]) => {
      const [companies, tags] = await Promise.all([
        getCompanies(
          batch
            .map((contact) => contact.company?.trim())
            .filter((name) => name),
        ),
        getTags(batch.flatMap((batch) => parseTags(batch.tags))),
      ]);

      return createEachRow(
        batch.map(
          ({
            name,
            first_name,
            last_name,
            gender,
            title,
            email_work,
            email_home,
            email_other,
            phone_work,
            phone_home,
            phone_other,
            background,
            first_seen,
            last_seen,
            has_newsletter,
            status,
            company: companyName,
            tags: tagNames,
            wechat_id,
            contact_type,
            birthday,
            communication_style,
            attitude,
            tenure_years,
            social_organization,
            work_experience,
            education,
          }) => {
            const email_jsonb = [
              { email: email_work, type: "Work" },
              { email: email_home, type: "Home" },
              { email: email_other, type: "Other" },
            ].filter(({ email }) => email);
            const phone_jsonb = [
              { number: phone_work, type: "Work" },
              { number: phone_home, type: "Home" },
              { number: phone_other, type: "Other" },
            ].filter(({ number }) => number);
            const company = companyName?.trim()
              ? companies.get(companyName.trim())
              : undefined;
            const tagList = parseTags(tagNames)
              .map((name) => tags.get(name))
              .filter((tag): tag is Tag => !!tag);

            return dataProvider.create("contacts", {
              data: {
                // The optional Chinese full name, preferred over first/last name
                // for display; rows without it keep the legacy behavior.
                name: name?.trim() || undefined,
                first_name,
                last_name,
                gender,
                title,
                email_jsonb,
                phone_jsonb,
                background,
                first_seen: first_seen
                  ? new Date(first_seen).toISOString()
                  : today,
                last_seen: last_seen
                  ? new Date(last_seen).toISOString()
                  : today,
                has_newsletter,
                status,
                company_id: company?.id,
                tags: tagList.map((tag) => tag.id),
                sales_id: user?.identity?.id,
                wechat_id,
                // New CRM data model fields. Unknown or missing cells are
                // ignored, so a legacy CSV without these columns still imports.
                contact_type: toConfiguredValue(contact_type, contactTypes),
                birthday: toImportDate(birthday),
                communication_style: toConfiguredValue(
                  communication_style,
                  communicationStyles,
                ),
                attitude: toConfiguredValue(attitude, contactAttitudes),
                tenure_years: toNumber(tenure_years),
                social_organization: toConfiguredValue(
                  social_organization,
                  socialOrganizations,
                ),
                work_experience: parseWorkExperience(work_experience),
                education: parseEducation(education, educationDegrees),
              },
            });
          },
        ),
      );
    },
    [
      dataProvider,
      getCompanies,
      getTags,
      user?.identity?.id,
      today,
      contactTypes,
      contactAttitudes,
      communicationStyles,
      socialOrganizations,
      educationDegrees,
    ],
  );

  return processBatch;
}

/** Birthday cells are plain `YYYY-MM-DD` dates for the `date` column. */
const toImportDate = (cell: ImportCell) => toIsoDate(cell)?.slice(0, 10);

const parseTags = (tags: string) =>
  tags
    ?.split(",")
    ?.map((tag: string) => tag.trim())
    ?.filter((tag: string) => tag) ?? [];

/**
 * JSON columns of the import file hold an array of objects. An invalid or
 * empty cell means "no entry", so a malformed cell cannot fail the whole row.
 */
const parseJsonArray = (cell: ImportCell): Record<string, unknown>[] => {
  const text = toText(cell);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is Record<string, unknown> =>
            entry != null && typeof entry === "object",
        )
      : [];
  } catch {
    return [];
  }
};

const cleanEntries = <T extends object>(entries: T[]): T[] =>
  entries.filter((entry) =>
    Object.values(entry).some((value) => value != null && value !== ""),
  );

const toYear = (value: unknown) =>
  value == null || value === ""
    ? undefined
    : (toNumber(value as ImportCell) ?? undefined);

const parseWorkExperience = (
  cell: ImportCell,
): WorkExperience[] | undefined => {
  const entries = cleanEntries(
    parseJsonArray(cell).map((entry) => ({
      start_year: toYear(entry.start_year),
      end_year: toYear(entry.end_year),
      company: toText(entry.company as ImportCell),
      title: toText(entry.title as ImportCell),
    })),
  ).filter(
    (entry) =>
      entry.start_year != null ||
      entry.end_year != null ||
      entry.company ||
      entry.title,
  );
  return entries.length > 0 ? entries : undefined;
};

const parseEducation = (
  cell: ImportCell,
  degrees: { value: string; label: string }[],
): Education[] | undefined => {
  const entries = cleanEntries(
    parseJsonArray(cell).map((entry) => ({
      start_year: toYear(entry.start_year),
      end_year: toYear(entry.end_year),
      school: toText(entry.school as ImportCell),
      major: toText(entry.major as ImportCell),
      degree:
        toConfiguredValue(entry.degree as ImportCell, degrees) ??
        toText(entry.degree as ImportCell),
    })),
  ).filter(
    (entry) =>
      entry.start_year != null ||
      entry.end_year != null ||
      entry.school ||
      entry.major ||
      entry.degree,
  );
  return entries.length > 0 ? entries : undefined;
};
