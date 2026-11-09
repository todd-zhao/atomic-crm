import { Badge } from "@/components/ui/badge";

import { useConfigurationContext } from "../root/ConfigurationContext";

/**
 * Small, config-driven labels for company enumerations. Both directories share
 * the `companies` resource, so the same field may be shown as a badge (show /
 * table headers) or as plain text (table cells).
 */
export const CompanyKindBadge = ({ kind }: { kind?: string | null }) => {
  const { companyKinds } = useConfigurationContext();
  const choice = companyKinds.find((option) => option.value === kind);
  if (!choice) return null;
  return <Badge variant="outline">{choice.label}</Badge>;
};

export const ChannelTypeBadge = ({
  channelType,
}: {
  channelType?: string | null;
}) => {
  const { channelTypes } = useConfigurationContext();
  const choice = channelTypes.find((option) => option.value === channelType);
  if (!choice) return null;
  return <Badge variant="secondary">{choice.label}</Badge>;
};

export const CompanyKindLabel = ({ kind }: { kind?: string | null }) => {
  const { companyKinds } = useConfigurationContext();
  return (
    <>
      {companyKinds.find((option) => option.value === kind)?.label ??
        kind ??
        ""}
    </>
  );
};

export const ChannelTypeLabel = ({
  channelType,
}: {
  channelType?: string | null;
}) => {
  const { channelTypes } = useConfigurationContext();
  return (
    <>
      {channelTypes.find((option) => option.value === channelType)?.label ??
        channelType ??
        ""}
    </>
  );
};

export const CompanySectorLabel = ({ sector }: { sector?: string | null }) => {
  const { companySectors } = useConfigurationContext();
  return (
    <>
      {companySectors.find((option) => option.value === sector)?.label ??
        sector ??
        ""}
    </>
  );
};
