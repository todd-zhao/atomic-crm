import type { Contact, Sale } from "../types";

/**
 * Name helpers for the Chinese-first name model.
 *
 * Contacts and sales team members keep the legacy `first_name` / `last_name`
 * columns (for English names and for backward compatibility) and gain an
 * optional `name` column holding the full display name used by Chinese users,
 * e.g. "张伟". `name` wins when present; otherwise we fall back to
 * "first_name last_name".
 */
type NameFields = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

const clean = (value?: string | null): string =>
  typeof value === "string" ? value.trim() : "";

/** Full display name: Chinese `name` when set, otherwise "First Last". */
export const getDisplayName = (record?: NameFields | null): string => {
  if (!record) return "";
  const name = clean(record.name);
  if (name) return name;
  return [clean(record.first_name), clean(record.last_name)]
    .filter(Boolean)
    .join(" ");
};

/** One or two initials for avatars: "张伟" -> "张", "Ada Lovelace" -> "AL". */
export const getDisplayInitials = (record?: NameFields | null): string => {
  if (!record) return "";
  const name = clean(record.name);
  if (name) {
    // CJK names are usually shown by their first character only.
    return /[\u3400-\u9fff]/.test(name) ? name.charAt(0) : name.slice(0, 2);
  }
  const first = clean(record.first_name).charAt(0);
  const last = clean(record.last_name).charAt(0);
  return `${first}${last}`.toUpperCase();
};

export const getContactName = (contact?: Contact | NameFields | null) =>
  getDisplayName(contact);

export const getSaleName = (sale?: Sale | NameFields | null) =>
  getDisplayName(sale);

export const getContactInitials = (contact?: Contact | NameFields | null) =>
  getDisplayInitials(contact);

export const getSaleInitials = (sale?: Sale | NameFields | null) =>
  getDisplayInitials(sale);
