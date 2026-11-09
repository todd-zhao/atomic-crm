import { useEffect } from "react";
import { required, useTranslate } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Separator } from "@/components/ui/separator";

import { AutocompleteCompanyInput } from "../companies/AutocompleteCompanyInput.tsx";
import { getSaleName } from "../misc/displayName";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Sale } from "../types";
import { CompetitorInput } from "./CompetitorInput";

export const DealInputs = () => (
  <div className="flex flex-col gap-6 p-1">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <TextInput
        source="name"
        label="resources.deals.fields.name"
        validate={required()}
        helperText={false}
      />
      <ReferenceInput
        source="company_id"
        reference="companies"
        // The deal's customer is always a hotel; channel companies are picked
        // through the "source channel" field instead.
        filter={{ "company_kind@eq": "hotel" }}
      >
        <AutocompleteCompanyInput
          label="resources.deals.fields.company_id"
          validate={required()}
          modal
        />
      </ReferenceInput>
      <DealOwnerInput />
      <DealTypeInput />
      <DealStatusInput />
      <DealStageInput />
      <DealSourceInput />
      <ChannelInput />
      <DateInput
        source="expected_closing_date"
        label="resources.deals.fields.expected_closing_date"
        helperText={false}
      />
      <NumberInput
        source="budget"
        label="resources.deals.fields.budget"
        helperText={false}
      />
      <NumberInput
        source="final_amount"
        label="resources.deals.fields.final_amount"
        helperText={false}
      />
    </div>

    <CompetitorInput />

    <Separator />

    <TextInput
      source="decision_process"
      label="resources.deals.fields.decision_process"
      multiline
      rows={3}
      helperText={false}
    />
    <TextInput
      source="description"
      label="resources.deals.fields.description"
      multiline
      rows={3}
      helperText={false}
    />
  </div>
);

/**
 * Sales owner of the deal. Optional and clearable: leaving it empty sends the
 * deal to the lead pool, where anyone can claim it.
 */
const DealOwnerInput = () => {
  const translate = useTranslate();
  return (
    <ReferenceInput
      source="sales_id"
      reference="sales"
      filter={{ "disabled@neq": true }}
      sort={{ field: "last_name", order: "ASC" }}
    >
      <AutocompleteInput
        label="resources.deals.fields.sales_id"
        optionText={(sale: Sale) => getSaleName(sale)}
        helperText={translate("crm.pool.owner_hint")}
        clearable
        modal
      />
    </ReferenceInput>
  );
};

const DealSourceInput = () => {
  const { dealSources } = useConfigurationContext();
  const { setValue } = useFormContext();
  const sourceType = useWatch({ name: "source_type" }) ?? "direct";

  // Going back to a direct deal must not leave a stale channel reference.
  useEffect(() => {
    if (sourceType !== "channel") {
      setValue("channel_id", null, { shouldDirty: false });
    }
  }, [sourceType, setValue]);

  return (
    <SelectInput
      source="source_type"
      label="resources.deals.fields.source_type"
      choices={dealSources}
      optionText="label"
      optionValue="value"
      defaultValue={dealSources[0]?.value}
      validate={required()}
      helperText={false}
    />
  );
};

/** Channel company the opportunity came from, shown only for channel deals. */
const ChannelInput = () => {
  const sourceType = useWatch({ name: "source_type" }) ?? "direct";
  if (sourceType !== "channel") return null;
  return (
    <ReferenceInput
      source="channel_id"
      reference="companies"
      filter={{ "company_kind@eq": "channel" }}
      sort={{ field: "name", order: "ASC" }}
    >
      <AutocompleteInput
        label="resources.deals.fields.channel_id"
        optionText="name"
        helperText={false}
        clearable
      />
    </ReferenceInput>
  );
};

const DealTypeInput = () => {
  const { dealTypes } = useConfigurationContext();
  return (
    <SelectInput
      source="deal_type"
      label="resources.deals.fields.deal_type"
      choices={dealTypes}
      optionText="label"
      optionValue="value"
      helperText={false}
    />
  );
};

const DealStatusInput = () => {
  const { dealStatuses } = useConfigurationContext();
  return (
    <SelectInput
      source="status"
      label="resources.deals.fields.status"
      choices={dealStatuses}
      optionText="label"
      optionValue="value"
      defaultValue={dealStatuses[0]?.value}
      validate={required()}
      helperText={false}
    />
  );
};

const DealStageInput = () => {
  const { dealStages } = useConfigurationContext();
  return (
    <SelectInput
      source="stage"
      label="resources.deals.fields.stage"
      choices={dealStages}
      optionText="label"
      optionValue="value"
      defaultValue={dealStages[0]?.value}
      validate={required()}
      helperText={false}
    />
  );
};
