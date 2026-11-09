import { useMemo } from "react";
import { useStore } from "ra-core";

import type { DealStage, DealStatus, LabeledValue, NoteStatus } from "../types";
import { defaultConfiguration } from "./defaultConfiguration";

export const CONFIGURATION_STORE_KEY = "app.configuration";

export interface ConfigurationContextValue {
  companySectors: LabeledValue[];
  /** 'hotel' (direct customer) vs 'channel' (other companies) directories. */
  companyKinds: LabeledValue[];
  /** Channel sub-types: OTA, travel agency, meeting agency, corporate agreement, other. */
  channelTypes: LabeledValue[];
  /** KARE classification for companies. */
  companyCustomerCategories: LabeledValue[];
  contactTypes: LabeledValue[];
  contactAttitudes: NoteStatus[];
  communicationStyles: LabeledValue[];
  currency: string;
  /** Board columns (potential / active / won / exited). */
  dealStatuses: DealStatus[];
  /** Sandler methodology phases shown as colored badges on active deals. */
  dealStages: DealStage[];
  dealTypes: LabeledValue[];
  /** direct (直客) or channel (渠道) opportunity source. */
  dealSources: LabeledValue[];
  educationDegrees: LabeledValue[];
  hotelServices: LabeledValue[];
  hotelTypes: LabeledValue[];
  noteStatuses: NoteStatus[];
  socialOrganizations: LabeledValue[];
  taskTypes: LabeledValue[];
  title: string;
  darkModeLogo: string;
  lightModeLogo: string;
}

export const useConfigurationContext = () => {
  const [config] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
    defaultConfiguration,
  );
  // Merge with defaults so that missing fields in stored config
  // fall back to default values (e.g. when new settings are added)
  return useMemo(() => ({ ...defaultConfiguration, ...config }), [config]);
};

export const useConfigurationUpdater = () => {
  const [, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  return setConfig;
};
