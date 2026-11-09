import { required, useRecordContext, useTranslate } from "ra-core";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { getSaleName } from "../misc/displayName";

import ImageEditorField from "../misc/ImageEditorField";
import { isLinkedinUrl } from "../misc/isLinkedInUrl";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Sale } from "../types";
import { AutocompleteCompanyInput } from "./AutocompleteCompanyInput";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { isUrl } from "./isUrl";
import { sizes } from "./sizes";

export const CompanyInputs = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-4 p-1">
      <CompanyDisplayInputs />
      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <div className="flex flex-col gap-10 flex-1">
          <CompanyContactInputs />
          <CompanyContextInputs />
        </div>
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <div className="flex flex-col gap-8 flex-1">
          <CompanyAddressInputs />
          <CompanyAdditionalInformationInputs />
        </div>
      </div>
    </div>
  );
};

const CompanyDisplayInputs = () => {
  const translate = useTranslate();
  const record = useRecordContext<Company>();
  return (
    <div className="flex gap-4 flex-1 flex-row">
      <ImageEditorField
        source="logo"
        type="avatar"
        width={60}
        height={60}
        emptyText={record?.name.charAt(0)}
        linkPosition="bottom"
      />
      <TextInput
        source="name"
        className="w-full h-fit"
        validate={required()}
        helperText={false}
        placeholder={translate("resources.companies.fields.name", {
          _: "Company name",
        })}
      />
    </div>
  );
};

const CompanyContactInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.contact", {
          _: "Company info",
        })}
      </h6>
      <TextInput source="website" helperText={false} validate={isUrl} />
      <TextInput
        source="linkedin_url"
        helperText={false}
        validate={isLinkedinUrl}
      />
      <TextInput source="phone_number" helperText={false} />
    </div>
  );
};

const CompanyContextInputs = () => {
  const translate = useTranslate();
  const record = useRecordContext<Company>();
  const { companyCustomerCategories } = useConfigurationContext();
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.context", {
          _: "Context",
        })}
      </h6>
      {/* KARE customer classification: keep / acquire / recover / expand */}
      <SelectInput
        source="customer_category"
        choices={companyCustomerCategories}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      {/* Group HQ this hotel belongs to; optional, hence clearable */}
      <ReferenceInput
        source="parent_company_id"
        reference="companies"
        filter={record?.id != null ? { "id@neq": record.id } : undefined}
      >
        <AutocompleteCompanyInput
          label="resources.companies.fields.parent_company_id"
          clearable
        />
      </ReferenceInput>
      <SelectInput source="size" choices={translatedSizes} helperText={false} />
      <TextInput source="revenue" helperText={false} />
      <TextInput source="tax_identifier" helperText={false} />
    </div>
  );
};

const CompanyAddressInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.address", {
          _: "Address",
        })}
      </h6>
      <TextInput source="address" helperText={false} />
      <TextInput source="city" helperText={false} />
      <TextInput source="zipcode" helperText={false} />
      <TextInput source="state_abbr" helperText={false} />
      <TextInput source="country" helperText={false} />
    </div>
  );
};

const CompanyAdditionalInformationInputs = () => {
  const translate = useTranslate();
  const { hotelTypes, hotelServices } = useConfigurationContext();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.hotel", {
          _: "Hotel details",
        })}
      </h6>
      {/* Hotel-specific custom fields from the CRM data model */}
      <SelectInput
        source="hotel_type"
        choices={hotelTypes}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <AutocompleteArrayInput
        source="hotel_services"
        choices={hotelServices}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <NumberInput source="rooms" min={0} helperText={false} />
      <NumberInput
        source="opening_year"
        min={1950}
        max={2100}
        helperText={false}
      />
      <NumberInput
        source="average_room_rate"
        min={0}
        step={0.01}
        helperText={false}
      />
      <TextInput source="description" multiline helperText={false} />
      <ArrayInput source="context_links" helperText={false}>
        <SimpleFormIterator disableReordering fullWidth getItemLabel={false}>
          <TextInput
            source=""
            label={false}
            helperText={false}
            validate={isUrl}
          />
        </SimpleFormIterator>
      </ArrayInput>
      <ReferenceInput
        source="sales_id"
        reference="sales"
        filter={{
          "disabled@neq": true,
        }}
      >
        <SelectInput helperText={false} optionText={saleOptionRenderer} />
      </ReferenceInput>
    </div>
  );
};

const saleOptionRenderer = (choice: Sale) => getSaleName(choice);
