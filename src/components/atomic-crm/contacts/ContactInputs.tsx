import { email, required, useRecordContext, useTranslate } from "ra-core";
import type { FocusEvent, ClipboardEventHandler } from "react";
import { useFormContext } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { BooleanInput } from "@/components/admin/boolean-input";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
import { SelectInput } from "@/components/admin/select-input";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";

import { getSaleName } from "../misc/displayName";

import type { Sale, Contact } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { Avatar } from "./Avatar";
import { AutocompleteCompanyInput } from "../companies/AutocompleteCompanyInput.tsx";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { contactOptionText } from "../misc/ContactOption";
import {
  contactGender,
  translateContactGenderLabel,
  translatePersonalInfoTypeLabel,
} from "./contactModel.ts";

export const ContactInputs = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-2 p-1 relative md:static">
      <div className="absolute top-0 right-1 md:static">
        <Avatar />
      </div>
      <div className="flex gap-10 md:gap-6 flex-col md:flex-row">
        <div className="flex flex-col gap-10 flex-1">
          <ContactIdentityInputs />
          <ContactPositionInputs />
          <ContactWorkExperienceInputs />
          <ContactEducationInputs />
        </div>
        {isMobile ? null : (
          <Separator orientation="vertical" className="flex-shrink-0" />
        )}
        <div className="flex flex-col gap-10 flex-1">
          <ContactPersonalInformationInputs />
          <ContactMiscInputs />
        </div>
      </div>
    </div>
  );
};

/**
 * A contact needs either a full display name (Chinese convention) or the legacy
 * English first and last names. The error is attached to the `name` field so it
 * sits in the identity section.
 */
const validateContactName = (_value: unknown, values: Contact | undefined) => {
  const name = values?.name?.trim();
  const firstName = values?.first_name?.trim();
  const lastName = values?.last_name?.trim();
  if (name || (firstName && lastName)) return;
  return {
    message: "crm.validation.contact_name_required",
    args: { _: "Add a full name, or a first and last name." },
  };
};

const ContactIdentityInputs = () => {
  const translate = useTranslate();
  const {
    contactTypes,
    communicationStyles,
    contactAttitudes,
    socialOrganizations,
  } = useConfigurationContext();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.contacts.field_categories.identity")}
      </h6>
      <RadioButtonGroupInput
        label={false}
        row
        source="gender"
        choices={contactGender}
        helperText={false}
        optionText={(choice) => translateContactGenderLabel(choice, translate)}
        translateChoice={false}
        optionValue="value"
        defaultValue={contactGender[0].value}
      />
      <TextInput
        source="name"
        validate={validateContactName}
        helperText="resources.contacts.fields.name_hint"
      />
      <TextInput source="first_name" helperText={false} />
      <TextInput source="last_name" helperText={false} />
      <RadioButtonGroupInput
        label="resources.contacts.fields.contact_type"
        row
        source="contact_type"
        choices={contactTypes}
        helperText={false}
        optionText="label"
        optionValue="value"
        translateChoice={false}
      />
      <DateInput source="birthday" helperText={false} />
      <RadioButtonGroupInput
        label="resources.contacts.fields.communication_style"
        row
        source="communication_style"
        choices={communicationStyles}
        helperText={false}
        optionText="label"
        optionValue="value"
        translateChoice={false}
      />
      <RadioButtonGroupInput
        label="resources.contacts.fields.attitude"
        row
        source="attitude"
        choices={contactAttitudes}
        helperText={false}
        optionText="label"
        optionValue="value"
        translateChoice={false}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumberInput
          source="tenure_years"
          step={0.5}
          min={0}
          helperText={false}
        />
        <SelectInput
          source="social_organization"
          choices={socialOrganizations}
          helperText={false}
          optionText="label"
          optionValue="value"
          translateChoice={false}
        />
      </div>
    </div>
  );
};

const ContactWorkExperienceInputs = () => (
  <ArrayInput
    source="work_experience"
    label="resources.contacts.fields.work_experience"
    helperText={false}
  >
    <SimpleFormIterator inline>
      <NumberInput
        source="start_year"
        label="resources.contacts.inputs.work_experience.start_year"
        helperText={false}
        className="w-28"
      />
      <NumberInput
        source="end_year"
        label="resources.contacts.inputs.work_experience.end_year"
        helperText={false}
        className="w-28"
      />
      <TextInput
        source="company"
        label="resources.contacts.inputs.work_experience.company"
        helperText={false}
        className="flex-1"
      />
      <TextInput
        source="title"
        label="resources.contacts.inputs.work_experience.title"
        helperText={false}
        className="flex-1"
      />
    </SimpleFormIterator>
  </ArrayInput>
);

const ContactEducationInputs = () => {
  const { educationDegrees } = useConfigurationContext();
  return (
    <ArrayInput
      source="education"
      label="resources.contacts.fields.education"
      helperText={false}
    >
      <SimpleFormIterator inline>
        <NumberInput
          source="start_year"
          label="resources.contacts.inputs.education.start_year"
          helperText={false}
          className="w-28"
        />
        <NumberInput
          source="end_year"
          label="resources.contacts.inputs.education.end_year"
          helperText={false}
          className="w-28"
        />
        <TextInput
          source="school"
          label="resources.contacts.inputs.education.school"
          helperText={false}
          className="flex-1"
        />
        <TextInput
          source="major"
          label="resources.contacts.inputs.education.major"
          helperText={false}
          className="flex-1"
        />
        <SelectInput
          source="degree"
          label="resources.contacts.inputs.education.degree"
          choices={educationDegrees}
          helperText={false}
          optionText="label"
          optionValue="value"
          translateChoice={false}
          className="w-32"
        />
      </SimpleFormIterator>
    </ArrayInput>
  );
};

const ContactPositionInputs = () => {
  const translate = useTranslate();
  const record = useRecordContext<Contact>();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.contacts.field_categories.position")}
      </h6>
      <TextInput source="title" helperText={false} />
      <ReferenceInput source="company_id" reference="companies" perPage={10}>
        <AutocompleteCompanyInput label="resources.contacts.fields.company_id" />
      </ReferenceInput>
      {/* A contact can be introduced by another contact (the referral tree). */}
      <ReferenceInput
        source="referrer_contact_id"
        reference="contacts"
        perPage={10}
        filter={record?.id != null ? { "id@neq": record.id } : undefined}
      >
        <AutocompleteInput
          label="resources.contacts.fields.referrer_contact_id"
          optionText={contactOptionText}
          helperText={false}
          clearable
        />
      </ReferenceInput>
    </div>
  );
};

const ContactPersonalInformationInputs = () => {
  const translate = useTranslate();
  const { getValues, setValue } = useFormContext();
  const personalInfoTypes = [
    {
      id: "Work",
      name: translatePersonalInfoTypeLabel("Work", translate),
    },
    {
      id: "Home",
      name: translatePersonalInfoTypeLabel("Home", translate),
    },
    {
      id: "Other",
      name: translatePersonalInfoTypeLabel("Other", translate),
    },
  ];

  // set first and last name based on email, unless a display name is set
  const handleEmailChange = (email: string) => {
    const { first_name, last_name, name } = getValues();
    if (name || first_name || last_name || !email) return;
    const [first, last] = email.split("@")[0].split(".");
    setValue("first_name", first.charAt(0).toUpperCase() + first.slice(1));
    setValue(
      "last_name",
      last ? last.charAt(0).toUpperCase() + last.slice(1) : "",
    );
  };

  const handleEmailPaste: ClipboardEventHandler<
    HTMLTextAreaElement | HTMLInputElement
  > = (e) => {
    const email = e.clipboardData?.getData("text/plain");
    handleEmailChange(email);
  };

  const handleEmailBlur = (
    e: FocusEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const email = e.target.value;
    handleEmailChange(email);
  };

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.contacts.field_categories.personal_info")}
      </h6>
      <ArrayInput source="email_jsonb" helperText={false}>
        <SimpleFormIterator
          inline
          disableReordering
          disableClear
          className="[&>ul>li]:border-b-0 [&>ul>li]:pb-0"
        >
          <TextInput
            source="email"
            className="w-full"
            helperText={false}
            label={false}
            placeholder={translate("resources.contacts.fields.email")}
            validate={email()}
            onPaste={handleEmailPaste}
            onBlur={handleEmailBlur}
          />
          <SelectInput
            source="type"
            helperText={false}
            label={false}
            optionText="name"
            choices={personalInfoTypes}
            defaultValue="Work"
            className="w-24 min-w-24"
          />
        </SimpleFormIterator>
      </ArrayInput>
      <ArrayInput source="phone_jsonb" helperText={false}>
        <SimpleFormIterator
          inline
          disableReordering
          disableClear
          className="[&>ul>li]:border-b-0 [&>ul>li]:pb-0"
        >
          <TextInput
            source="number"
            className="w-full"
            helperText={false}
            label={false}
            placeholder={translate("resources.contacts.fields.phone_number")}
          />
          <SelectInput
            source="type"
            helperText={false}
            label={false}
            optionText="name"
            choices={personalInfoTypes}
            defaultValue="Work"
            className="w-24 min-w-24"
          />
        </SimpleFormIterator>
      </ArrayInput>
      <TextInput source="wechat_id" helperText={false} />
    </div>
  );
};

const ContactMiscInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.contacts.field_categories.misc")}
      </h6>
      <TextInput source="background" multiline helperText={false} />
      <BooleanInput source="has_newsletter" helperText={false} />
      <ReferenceInput
        reference="sales"
        source="sales_id"
        sort={{ field: "last_name", order: "ASC" }}
        filter={{
          "disabled@neq": true,
        }}
      >
        <SelectInput
          helperText={false}
          optionText={saleOptionRenderer}
          validate={required()}
        />
      </ReferenceInput>
    </div>
  );
};

const saleOptionRenderer = (choice: Sale) => getSaleName(choice);
