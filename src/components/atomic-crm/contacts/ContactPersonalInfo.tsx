import { useState } from "react";
import {
  useLocaleState,
  useRecordContext,
  useTranslate,
  WithRecord,
} from "ra-core";
import { ArrayField } from "@/components/admin/array-field";
import { SingleFieldList } from "@/components/admin/single-field-list";
import { TextField } from "@/components/admin/text-field";
import { EmailField } from "@/components/admin/email-field";
import { Mail, Phone, MessageCircle, Check } from "lucide-react";
import type { ReactNode } from "react";
import {
  formatContactBirthday,
  findOptionLabel,
  contactGender,
  translateContactGenderLabel,
  translatePersonalInfoTypeLabel,
} from "./contactModel";
import { ContactAttitude } from "./ContactBadges";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact } from "../types";

export const ContactPersonalInfo = () => {
  const record = useRecordContext<Contact>();
  const translate = useTranslate();

  if (!record) return null;

  return (
    <div>
      <ArrayField source="email_jsonb">
        <SingleFieldList className="flex-col gap-y-0">
          <EmailRow />
        </SingleFieldList>
      </ArrayField>

      {record.has_newsletter && (
        <p className="pl-6 py-1 text-sm text-muted-foreground">
          {translate("resources.contacts.fields.has_newsletter")}
        </p>
      )}

      {record.wechat_id && (
        <PersonalInfoRow
          icon={<MessageCircle className="w-4 h-4 text-muted-foreground" />}
          primary={
            <span className="text-sm text-muted-foreground">
              {record.wechat_id}
            </span>
          }
        />
      )}
      <ArrayField source="phone_jsonb">
        <SingleFieldList className="flex-col gap-y-0">
          <PersonalInfoRow
            icon={<Phone className="w-4 h-4 text-muted-foreground" />}
            primary={<TextField source="number" />}
            showType
          />
        </SingleFieldList>
      </ArrayField>
      {contactGender
        .map((genderOption) => {
          if (record.gender === genderOption.value) {
            return (
              <PersonalInfoRow
                key={genderOption.value}
                icon={
                  <genderOption.icon className="w-4 h-4 text-muted-foreground" />
                }
                primary={
                  <div>
                    {translateContactGenderLabel(genderOption, translate)}
                  </div>
                }
              />
            );
          }
          return null;
        })
        .filter(Boolean)}
      <ContactProfileInfo />
    </div>
  );
};

/**
 * The contact fields of the CRM data model that describe the person (as
 * opposed to their contact details): type, birthday, DISC style, attitude,
 * tenure and social organization.
 */
const ContactProfileInfo = () => {
  const record = useRecordContext<Contact>();
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { contactTypes, communicationStyles, socialOrganizations } =
    useConfigurationContext();

  if (!record) return null;

  const contactType = findOptionLabel(contactTypes, record.contact_type);
  const communicationStyle = findOptionLabel(
    communicationStyles,
    record.communication_style,
  );
  const socialOrganization = findOptionLabel(
    socialOrganizations,
    record.social_organization,
  );

  return (
    <div className="flex flex-col pt-1">
      {contactType ? (
        <ProfileRow
          label={translate("resources.contacts.fields.contact_type")}
          value={contactType}
        />
      ) : null}
      {record.birthday ? (
        <ProfileRow
          label={translate("resources.contacts.fields.birthday")}
          value={formatContactBirthday(record.birthday, locale)}
        />
      ) : null}
      {communicationStyle ? (
        <ProfileRow
          label={translate("resources.contacts.fields.communication_style")}
          value={communicationStyle}
        />
      ) : null}
      {record.attitude ? (
        <ProfileRow
          label={translate("resources.contacts.fields.attitude")}
          value={<ContactAttitude attitude={record.attitude} showLabel />}
        />
      ) : null}
      {record.tenure_years != null ? (
        <ProfileRow
          label={translate("resources.contacts.fields.tenure_years")}
          value={String(record.tenure_years)}
        />
      ) : null}
      {socialOrganization ? (
        <ProfileRow
          label={translate("resources.contacts.fields.social_organization")}
          value={socialOrganization}
        />
      ) : null}
    </div>
  );
};

const ProfileRow = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex flex-row items-center gap-2 py-1 min-h-6">
    <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
    <span className="flex-1 min-w-0 text-sm">{value}</span>
  </div>
);

const EmailRow = () => {
  const record = useRecordContext<{ email: string }>();
  const translate = useTranslate();
  const [copied, setCopied] = useState(false);

  if (!record) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(record.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <PersonalInfoRow
      icon={
        <button
          type="button"
          onClick={handleCopy}
          title={translate("crm.common.copy")}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
        </button>
      }
      primary={<EmailField source="email" />}
    />
  );
};

const PersonalInfoRow = ({
  icon,
  primary,
  showType,
}: {
  icon: ReactNode;
  primary: ReactNode;
  showType?: boolean;
}) => {
  const translate = useTranslate();

  return (
    <div className="flex flex-row items-center gap-x-2 py-1 min-h-6">
      {icon}
      <div className="flex flex-wrap gap-x-2 gap-y-0 text-sm">
        {primary}
        {showType ? (
          <WithRecord
            render={(row) =>
              row.type !== "Other" && (
                <span className="text-muted-foreground">
                  {translatePersonalInfoTypeLabel(row.type, translate)}
                </span>
              )
            }
          />
        ) : null}
      </div>
    </div>
  );
};
