import { required, useRecordContext, useTranslate } from "ra-core";
import { ReferenceInput } from "@/components/admin/reference-input";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";

import ImageEditorField from "../misc/ImageEditorField";
import { getSaleName } from "../misc/displayName";
import { isUrl } from "../companies/isUrl";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Sale } from "../types";

/**
 * Form of the channel directory. It creates `companies` records flagged as
 * channels (`company_kind = 'channel'`): a channel has a channel sub-type and
 * background info, but no KARE classification, hotel fields or parent group.
 */
export const ChannelInputs = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-4 p-1">
      <ChannelDisplayInputs />
      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <div className="flex flex-col gap-10 flex-1">
          <ChannelTypeInputs />
          <ChannelContactInputs />
        </div>
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <div className="flex flex-col gap-8 flex-1">
          <ChannelAddressInputs />
          <ChannelBackgroundInputs />
        </div>
      </div>
    </div>
  );
};

const ChannelDisplayInputs = () => {
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
          _: "Channel name",
        })}
      />
    </div>
  );
};

const ChannelTypeInputs = () => {
  const translate = useTranslate();
  const { channelTypes, companySectors } = useConfigurationContext();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.channel", {
          _: "Channel details",
        })}
      </h6>
      <SelectInput
        source="channel_type"
        choices={channelTypes}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
      <SelectInput
        source="sector"
        choices={companySectors}
        optionText="label"
        optionValue="value"
        helperText={false}
      />
    </div>
  );
};

const ChannelContactInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.contact", {
          _: "Contact",
        })}
      </h6>
      <TextInput source="website" helperText={false} validate={isUrl} />
      <TextInput source="phone_number" helperText={false} />
    </div>
  );
};

const ChannelAddressInputs = () => {
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

const ChannelBackgroundInputs = () => {
  const translate = useTranslate();
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.context", {
          _: "Background",
        })}
      </h6>
      <TextInput source="description" multiline helperText={false} />
      <ReferenceInput
        source="sales_id"
        reference="sales"
        filter={{ "disabled@neq": true }}
      >
        <SelectInput helperText={false} optionText={saleOptionRenderer} />
      </ReferenceInput>
    </div>
  );
};

const saleOptionRenderer = (choice: Sale) => getSaleName(choice);
