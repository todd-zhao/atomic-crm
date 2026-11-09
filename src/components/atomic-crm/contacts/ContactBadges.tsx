import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";

/**
 * The Sandler attitude of a contact, shown as a colored dot (with its label
 * inline or as a tooltip) instead of the legacy "cold/warm/hot" temperature.
 */
export const ContactAttitude = ({
  attitude,
  showLabel = false,
  className,
}: {
  attitude?: string | null;
  showLabel?: boolean;
  className?: string;
}) => {
  const { contactAttitudes } = useConfigurationContext();
  const option = contactAttitudes.find((item) => item.value === attitude);
  if (!option) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={option.label}
    >
      <span
        className="inline-block w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: option.color }}
        aria-hidden
      />
      {showLabel ? <span className="text-sm">{option.label}</span> : null}
    </span>
  );
};

/** The contact nature (channel / customer), as a compact badge. */
export const ContactTypeBadge = ({
  contactType,
  className,
}: {
  contactType?: string | null;
  className?: string;
}) => {
  const { contactTypes } = useConfigurationContext();
  const option = contactTypes.find((item) => item.value === contactType);
  if (!option) return null;
  return (
    <Badge
      variant="secondary"
      className={cn("font-normal leading-none", className)}
    >
      {option.label}
    </Badge>
  );
};
