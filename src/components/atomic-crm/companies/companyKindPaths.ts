import type { Company } from "../types";

/**
 * The two company directories live at different paths but share the `companies`
 * resource: hotels (direct customers) under `/companies`, channels under
 * `/channels`. These helpers keep links and redirects pointing at the directory
 * the record belongs to.
 */
export const companyKindBasePath = (kind?: string | null) =>
  kind === "channel" ? "/channels" : "/companies";

export const companyShowPath = (company: Company) =>
  `${companyKindBasePath(company.company_kind)}/${company.id}/show`;

export const companyEditPath = (company: Company) =>
  `${companyKindBasePath(company.company_kind)}/${company.id}`;
