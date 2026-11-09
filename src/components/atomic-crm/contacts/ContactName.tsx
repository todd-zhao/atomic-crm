import type { ReactNode } from "react";
import { useRecordContext } from "ra-core";

import { getContactName } from "../misc/displayName";
import type { Contact } from "../types";

/**
 * Renders a contact's display name: the Chinese `name` when set, otherwise
 * "First Last". Use it wherever a contact is identified by name, e.g. inside a
 * `<ReferenceField>`.
 */
export const ContactName = ({
  record,
  fallback = null,
}: {
  record?: Contact;
  fallback?: ReactNode;
}) => {
  const contextRecord = useRecordContext<Contact>();
  const name = getContactName(record ?? contextRecord);
  return <>{name || fallback}</>;
};
