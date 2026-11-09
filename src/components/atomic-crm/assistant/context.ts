import { matchPath } from "react-router";

import type { AssistantContext } from "./types";

const numericId = (value: string | undefined): number | null => {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const detailId = (pattern: string, pathname: string): number | null => {
  const match = matchPath(pattern, pathname);
  return numericId(match?.params.id);
};

/**
 * Derives the page context sent with every assistant message from the current
 * location, mirroring how `layout/Header.tsx` decides which tab is active.
 *
 * The panel is mounted from the header, outside of the record context of show
 * pages, so the entity id is read from the route instead of
 * `useRecordContext()`.
 */
export const getAssistantContext = (pathname: string): AssistantContext => {
  const contactId =
    detailId("/contacts/:id/*", pathname) ??
    detailId("/contacts/:id", pathname);
  if (contactId !== null) {
    return { page: "contact", entityId: contactId };
  }
  const companyId =
    detailId("/companies/:id/*", pathname) ??
    detailId("/companies/:id", pathname);
  if (companyId !== null) {
    return { page: "company", entityId: companyId };
  }
  const dealId =
    detailId("/deals/:id/*", pathname) ?? detailId("/deals/:id", pathname);
  if (dealId !== null) {
    return { page: "deal", entityId: dealId };
  }
  if (matchPath("/", pathname)) {
    return { page: "dashboard", entityId: null };
  }
  if (matchPath("/contacts/*", pathname)) {
    return { page: "contacts", entityId: null };
  }
  if (matchPath("/companies/*", pathname)) {
    return { page: "companies", entityId: null };
  }
  if (matchPath("/deals/*", pathname)) {
    return { page: "deals", entityId: null };
  }
  if (matchPath("/tasks/*", pathname)) {
    return { page: "tasks", entityId: null };
  }
  if (matchPath("/settings/*", pathname) || pathname === "/settings") {
    return { page: "settings", entityId: null };
  }
  return { page: "other", entityId: null };
};
