/* eslint-disable react-refresh/only-export-components */
import { RotateCcw, Save } from "lucide-react";
import type { RaRecord } from "ra-core";
import {
  EditBase,
  Form,
  useGetList,
  useInput,
  useNotify,
  useTranslate,
} from "ra-core";
import { useCallback, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toSlug } from "@/lib/toSlug";
import { ArrayInput } from "@/components/admin/array-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";

import ImageEditorField from "../misc/ImageEditorField";
import {
  useConfigurationContext,
  useConfigurationUpdater,
  type ConfigurationContextValue,
} from "../root/ConfigurationContext";
import { defaultConfiguration } from "../root/defaultConfiguration";
import { AssistantSettings } from "./AssistantSettings";
import { SettingsTags } from "./SettingsTags";

const SECTIONS = [
  {
    id: "branding",
    label: "crm.settings.sections.branding",
    fallback: "Branding",
  },
  {
    id: "companies",
    label: "resources.companies.name",
    fallback: "Companies",
  },
  { id: "contacts", label: "resources.contacts.name", fallback: "Contacts" },
  { id: "deals", label: "resources.deals.name", fallback: "Deals" },
  { id: "notes", label: "resources.notes.name", fallback: "Notes" },
  { id: "tasks", label: "resources.tasks.name", fallback: "Tasks" },
  { id: "tags", label: "resources.tags.name", fallback: "Tags" },
  {
    id: "ai-assistant",
    label: "crm.assistant.settings.title",
    fallback: "AI Assistant",
  },
];

/** Ensure every item in a { value, label } array has a value (slug from label). */
const ensureValues = (items: { value?: string; label: string }[] | undefined) =>
  items?.map((item) => ({ ...item, value: item.value || toSlug(item.label) }));

type ValidateItemsInUseMessages = {
  duplicate?: (displayName: string, duplicates: string[]) => string;
  inUse?: (displayName: string, inUse: string[]) => string;
  validating?: string;
};

/**
 * Validate that no items were removed if they are still referenced by existing deals.
 * Also rejects duplicate slug values.
 * Returns undefined if valid, or an error message string.
 */
export const validateItemsInUse = (
  items: { value: string; label: string }[] | undefined,
  deals: RaRecord[] | undefined,
  fieldName: string,
  displayName: string,
  messages?: ValidateItemsInUseMessages,
) => {
  if (!items) return undefined;
  // Check for duplicate slugs
  const slugs = items.map((i) => i.value || toSlug(i.label));
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) duplicates.add(slug);
    seen.add(slug);
  }
  if (duplicates.size > 0) {
    const duplicatesList = [...duplicates];
    return (
      messages?.duplicate?.(displayName, duplicatesList) ??
      `Duplicate ${displayName}: ${duplicatesList.join(", ")}`
    );
  }
  // Check that no in-use value was removed (skip if deals haven't loaded)
  if (!deals) return messages?.validating ?? "Validating…";
  const values = new Set(slugs);
  const inUse = [
    ...new Set(
      deals
        .flatMap((deal) => [deal[fieldName]].flat() as string[])
        .filter((value) => value && !values.has(value)),
    ),
  ];
  if (inUse.length > 0) {
    return (
      messages?.inUse?.(displayName, inUse) ??
      `Cannot remove ${displayName} that are still used by deals: ${inUse.join(", ")}`
    );
  }
  return undefined;
};

const getCurrencyChoices = () => {
  const displayNames = new Intl.DisplayNames(
    typeof navigator !== "undefined"
      ? (navigator.languages as string[])
      : ["en"],
    { type: "currency" },
  );
  return Intl.supportedValuesOf("currency").map((code) => ({
    id: code,
    name: `${code} – ${displayNames.of(code)}`,
  }));
};

const transformFormValues = (data: Record<string, any>) => ({
  config: {
    title: data.title,
    lightModeLogo: data.lightModeLogo,
    darkModeLogo: data.darkModeLogo,
    currency: data.currency,
    companyKinds: ensureValues(data.companyKinds),
    channelTypes: ensureValues(data.channelTypes),
    companySectors: ensureValues(data.companySectors),
    companyCustomerCategories: ensureValues(data.companyCustomerCategories),
    contactTypes: ensureValues(data.contactTypes),
    contactAttitudes: ensureValues(data.contactAttitudes),
    communicationStyles: ensureValues(data.communicationStyles),
    dealStages: ensureValues(data.dealStages),
    dealStatuses: ensureValues(data.dealStatuses),
    dealTypes: ensureValues(data.dealTypes),
    dealSources: ensureValues(data.dealSources),
    educationDegrees: ensureValues(data.educationDegrees),
    hotelServices: ensureValues(data.hotelServices),
    hotelTypes: ensureValues(data.hotelTypes),
    noteStatuses: ensureValues(data.noteStatuses),
    socialOrganizations: ensureValues(data.socialOrganizations),
    taskTypes: ensureValues(data.taskTypes),
  } as ConfigurationContextValue,
});

export const SettingsPage = () => {
  const updateConfiguration = useConfigurationUpdater();
  const notify = useNotify();

  return (
    <EditBase
      resource="configuration"
      id={1}
      mutationMode="pessimistic"
      redirect={false}
      transform={transformFormValues}
      mutationOptions={{
        onSuccess: (data: any) => {
          updateConfiguration(data.config);
          notify("crm.settings.saved");
        },
        onError: () => {
          notify("crm.settings.save_error", {
            type: "error",
          });
        },
      }}
    >
      <SettingsForm />
    </EditBase>
  );
};

SettingsPage.path = "/settings";

const SettingsForm = () => {
  const config = useConfigurationContext();

  const defaultValues = useMemo(
    () => ({
      title: config.title,
      lightModeLogo: { src: config.lightModeLogo },
      darkModeLogo: { src: config.darkModeLogo },
      currency: config.currency,
      companyKinds: config.companyKinds,
      channelTypes: config.channelTypes,
      companySectors: config.companySectors,
      companyCustomerCategories: config.companyCustomerCategories,
      contactTypes: config.contactTypes,
      contactAttitudes: config.contactAttitudes,
      communicationStyles: config.communicationStyles,
      dealStages: config.dealStages,
      dealStatuses: config.dealStatuses,
      dealTypes: config.dealTypes,
      dealSources: config.dealSources,
      educationDegrees: config.educationDegrees,
      hotelServices: config.hotelServices,
      hotelTypes: config.hotelTypes,
      noteStatuses: config.noteStatuses,
      socialOrganizations: config.socialOrganizations,
      taskTypes: config.taskTypes,
    }),
    [config],
  );

  return (
    <Form defaultValues={defaultValues}>
      <SettingsFormFields />
    </Form>
  );
};

/** Edits the labels of a configured enumeration. */
const LabelsEditor = ({
  source,
  heading,
  validate,
}: {
  source: string;
  heading: string;
  validate?: (items: { value: string; label: string }[] | undefined) => any;
}) => (
  <>
    <h3 className="text-lg font-medium text-muted-foreground">{heading}</h3>
    <ArrayInput
      source={source}
      label={false}
      helperText={false}
      validate={validate}
    >
      <SimpleFormIterator disableReordering disableClear>
        <TextInput source="label" label={false} />
      </SimpleFormIterator>
    </ArrayInput>
  </>
);

/** Edits the labels and colors of a configured enumeration (statuses, attitudes). */
const ColoredLabelsEditor = ({
  source,
  heading,
  validate,
}: {
  source: string;
  heading: string;
  validate?: (items: { value: string; label: string }[] | undefined) => any;
}) => (
  <>
    <h3 className="text-lg font-medium text-muted-foreground">{heading}</h3>
    <ArrayInput
      source={source}
      label={false}
      helperText={false}
      validate={validate}
    >
      <SimpleFormIterator inline disableReordering disableClear>
        <TextInput source="label" label={false} className="flex-1" />
        <ColorInput source="color" />
      </SimpleFormIterator>
    </ArrayInput>
  </>
);

const SettingsFormFields = () => {
  const translate = useTranslate();
  const currencyChoices = useMemo(() => getCurrencyChoices(), []);
  const {
    reset,
    formState: { isSubmitting },
  } = useFormContext();

  const stageDisplayName = translate("crm.settings.validation.entities.stages");
  const statusDisplayName = translate("resources.deals.fields.status");

  const { data: deals } = useGetList("deals", {
    pagination: { page: 1, perPage: 1000 },
  });

  const validationMessages = {
    duplicate: (displayName: string, duplicates: string[]) =>
      translate("crm.settings.validation.duplicate", {
        display_name: displayName,
        items: duplicates.join(", "),
      }),
    inUse: (displayName: string, inUse: string[]) =>
      translate("crm.settings.validation.in_use", {
        display_name: displayName,
        items: inUse.join(", "),
      }),
    validating: translate("crm.settings.validation.validating"),
  };

  const validateDealStages = useCallback(
    (stages: { value: string; label: string }[] | undefined) =>
      validateItemsInUse(
        stages,
        deals,
        "stage",
        stageDisplayName,
        validationMessages,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deals, stageDisplayName, translate],
  );

  const validateDealStatuses = useCallback(
    (statuses: { value: string; label: string }[] | undefined) =>
      validateItemsInUse(
        statuses,
        deals,
        "status",
        statusDisplayName,
        validationMessages,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deals, statusDisplayName, translate],
  );

  const validateDealSources = useCallback(
    (sources: { value: string; label: string }[] | undefined) =>
      validateItemsInUse(
        sources,
        deals,
        "source_type",
        translate("resources.deals.fields.source_type"),
        validationMessages,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deals, translate],
  );

  return (
    <div className="flex gap-8 mt-4 pb-20">
      {/* Left navigation */}
      <nav className="hidden md:block w-48 shrink-0">
        <div className="sticky top-4 space-y-1">
          <h1 className="text-2xl font-semibold px-3 mb-2">
            {translate("crm.settings.title")}
          </h1>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="block w-full text-left px-3 py-1 text-sm rounded-md hover:text-foreground hover:bg-muted transition-colors"
            >
              {translate(section.label, {
                _: section.fallback,
                smart_count: 2,
              })}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-2xl space-y-6">
        {/* Branding */}
        <Card id="branding">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              {translate("crm.settings.sections.branding", { _: "Branding" })}
            </h2>
            <TextInput source="title" label="crm.settings.app_title" />
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">
                  {translate("crm.settings.light_mode_logo")}
                </p>
                <ImageEditorField
                  source="lightModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#f5f5f5"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">
                  {translate("crm.settings.dark_mode_logo")}
                </p>
                <ImageEditorField
                  source="darkModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#1a1a1a"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Companies */}
        <Card id="companies">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              {translate("resources.companies.name", { smart_count: 2 })}
            </h2>
            <LabelsEditor
              source="companyKinds"
              heading={translate("resources.companies.fields.company_kind")}
            />
            <Separator />
            <LabelsEditor
              source="companySectors"
              heading={translate("crm.settings.companies.sectors")}
            />
            <Separator />
            <LabelsEditor
              source="companyCustomerCategories"
              heading={translate(
                "resources.companies.fields.customer_category",
              )}
            />
            <Separator />
            <LabelsEditor
              source="hotelTypes"
              heading={translate("resources.companies.fields.hotel_type")}
            />
            <Separator />
            <LabelsEditor
              source="hotelServices"
              heading={translate("resources.companies.fields.hotel_services")}
            />
            <Separator />
            <LabelsEditor
              source="channelTypes"
              heading={translate("resources.companies.fields.channel_type")}
            />
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card id="contacts">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              {translate("resources.contacts.name", { smart_count: 2 })}
            </h2>
            <LabelsEditor
              source="contactTypes"
              heading={translate("resources.contacts.fields.contact_type")}
            />
            <Separator />
            <ColoredLabelsEditor
              source="contactAttitudes"
              heading={translate("resources.contacts.fields.attitude")}
            />
            <Separator />
            <LabelsEditor
              source="communicationStyles"
              heading={translate(
                "resources.contacts.fields.communication_style",
              )}
            />
            <Separator />
            <LabelsEditor
              source="socialOrganizations"
              heading={translate(
                "resources.contacts.fields.social_organization",
              )}
            />
            <Separator />
            <LabelsEditor
              source="educationDegrees"
              heading={translate("resources.contacts.fields.education")}
            />
          </CardContent>
        </Card>

        {/* Deals */}
        <Card id="deals">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              {translate("resources.deals.name", { smart_count: 2 })}
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">
              {translate("crm.settings.deals.currency")}
            </h3>
            <AutocompleteInput
              source="currency"
              label={false}
              choices={currencyChoices}
              inputText={(choice) => choice?.id}
              modal
            />

            <Separator />

            <ColoredLabelsEditor
              source="dealStages"
              heading={translate("crm.settings.deals.stages")}
              validate={validateDealStages}
            />

            <Separator />

            <ColoredLabelsEditor
              source="dealStatuses"
              heading={translate("resources.deals.fields.status")}
              validate={validateDealStatuses}
            />

            <Separator />

            <LabelsEditor
              source="dealTypes"
              heading={translate("resources.deals.fields.deal_type")}
            />

            <Separator />

            <LabelsEditor
              source="dealSources"
              heading={translate("resources.deals.fields.source_type")}
              validate={validateDealSources}
            />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card id="notes">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              {translate("resources.notes.name", { smart_count: 2 })}
            </h2>
            <ColoredLabelsEditor
              source="noteStatuses"
              heading={translate("crm.settings.notes.statuses")}
            />
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card id="tasks">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              {translate("resources.tasks.name", { smart_count: 2 })}
            </h2>
            <LabelsEditor
              source="taskTypes"
              heading={translate("crm.settings.tasks.types")}
            />
          </CardContent>
        </Card>

        {/* Tags */}
        <SettingsTags />

        {/* AI Assistant (BYOK) */}
        <AssistantSettings />
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
        <div className="max-w-screen-xl mx-auto flex gap-8 px-4">
          <div className="hidden md:block w-48 shrink-0" />
          <div className="flex-1 min-w-0 max-w-2xl flex justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                reset({
                  ...defaultConfiguration,
                  lightModeLogo: {
                    src: defaultConfiguration.lightModeLogo,
                  },
                  darkModeLogo: { src: defaultConfiguration.darkModeLogo },
                })
              }
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {translate("crm.settings.reset_defaults")}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                {translate("ra.action.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-1" />
                {isSubmitting
                  ? translate("crm.settings.saving")
                  : translate("ra.action.save")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** A minimal color picker input compatible with ra-core's useInput. */
const ColorInput = ({ source }: { source: string }) => {
  const { field } = useInput({ source });
  return (
    <input
      type="color"
      {...field}
      value={field.value || "#000000"}
      className="w-9 h-9 shrink-0 cursor-pointer appearance-none rounded border bg-transparent p-0.5 [&::-webkit-color-swatch-wrapper]:cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:cursor-pointer [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:cursor-pointer [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-none"
    />
  );
};
