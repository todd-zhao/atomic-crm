import { useMemo } from "react";
import { LinkBase, useGetList, useTranslate } from "ra-core";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { Contact } from "../types";
import { getContactName } from "../misc/displayName";
import { buildReferralForest, getReferralAncestors } from "./referralTree";

/**
 * Referral tree: contacts can introduce other contacts (referrer_contact_id).
 * Picking a contact shows the chain of people who introduced them (up) and the
 * whole tree of people they introduced, recursively (down). With no selection
 * the full forest of roots is shown.
 */
export const ReferralTreePage = () => {
  const translate = useTranslate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: contacts = [], isPending } = useGetList<Contact>("contacts", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "name", order: "ASC" },
  });

  const { byId, roots, childrenOf } = useMemo(
    () => buildReferralForest(contacts),
    [contacts],
  );

  const selectedId = Number(searchParams.get("contact")) || null;
  const selected = selectedId != null ? byId.get(selectedId) : undefined;
  const ancestors = useMemo(
    () => (selected ? getReferralAncestors(selected, byId) : []),
    [byId, selected],
  );

  const select = (contact: Contact | null) => {
    if (!contact) {
      setSearchParams({});
    } else {
      setSearchParams({ contact: String(contact.id) });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">
          {translate("crm.referrals.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate("crm.referrals.description")}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:gap-4">
          <label
            htmlFor="referral-contact"
            className="text-sm font-medium whitespace-nowrap"
          >
            {translate("crm.referrals.select_contact")}
          </label>
          <select
            id="referral-contact"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm md:max-w-md"
            value={selectedId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) select(null);
              else {
                const contact = byId.get(Number(value));
                if (contact) select(contact);
              }
            }}
          >
            <option value="">{translate("crm.referrals.all_contacts")}</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {getContactName(contact)}
                {contact.title ? ` · ${contact.title}` : ""}
              </option>
            ))}
          </select>
          {selected && (
            <LinkBase
              to={`/contacts/${selected.id}/show`}
              className="text-sm text-primary underline"
            >
              {translate("crm.referrals.open_contact")}
            </LinkBase>
          )}
        </CardContent>
      </Card>

      {isPending ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {translate("crm.referrals.loading")}
          </CardContent>
        </Card>
      ) : selected ? (
        <Card>
          <CardContent className="flex flex-col gap-6 py-5">
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {translate("crm.referrals.up")}
              </h2>
              {ancestors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {translate("crm.referrals.no_up")}
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {[...ancestors, selected].map((contact, index) => (
                    <div key={contact.id} className="flex flex-col gap-1">
                      <ContactNode
                        contact={contact}
                        selected={contact.id === selected.id}
                        onSelect={select}
                      />
                      {index < ancestors.length && (
                        <span className="pl-4 text-xs text-muted-foreground">
                          ↓ {translate("crm.referrals.referred")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {translate("crm.referrals.down")}
              </h2>
              {childrenOf.get(Number(selected.id))?.length ? (
                <div className="flex flex-col gap-1">
                  {childrenOf.get(Number(selected.id))!.map((child) => (
                    <ContactBranch
                      key={child.id}
                      contact={child}
                      childrenOf={childrenOf}
                      selectedId={Number(selected.id)}
                      onSelect={select}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {translate("crm.referrals.no_down")}
                </p>
              )}
            </section>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3 py-5">
            <p className="text-sm text-muted-foreground">
              {translate("crm.referrals.all_help")}
            </p>
            {roots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {translate("crm.referrals.empty")}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {roots.map((root) => (
                  <ContactBranch
                    key={root.id}
                    contact={root}
                    childrenOf={childrenOf}
                    selectedId={null}
                    onSelect={select}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const ContactNode = ({
  contact,
  selected,
  onSelect,
}: {
  contact: Contact;
  selected?: boolean;
  onSelect: (contact: Contact) => void;
}) => (
  <button
    type="button"
    onClick={() => onSelect(contact)}
    className={cn(
      "flex max-w-xl flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted",
      selected && "border-primary bg-primary/5",
    )}
  >
    <span className="text-sm font-medium">{getContactName(contact)}</span>
    <span className="text-xs text-muted-foreground">
      {[contact.title, contact.company_name].filter(Boolean).join(" · ") || "-"}
    </span>
  </button>
);

const ContactBranch = ({
  contact,
  childrenOf,
  selectedId,
  onSelect,
}: {
  contact: Contact;
  childrenOf: Map<number, Contact[]>;
  selectedId: number | null;
  onSelect: (contact: Contact) => void;
}) => {
  const children = childrenOf.get(Number(contact.id)) ?? [];
  return (
    <div className="flex flex-col gap-1">
      <ContactNode
        contact={contact}
        selected={selectedId != null && contact.id === selectedId}
        onSelect={onSelect}
      />
      {children.length > 0 && (
        <div className="ml-4 flex flex-col gap-1 border-l pl-4">
          {children.map((child) => (
            <ContactBranch
              key={child.id}
              contact={child}
              childrenOf={childrenOf}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ReferralTreePage;
