import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { DealStage, DealStatus } from "../types";

/** Small colored circle used before status / stage labels. */
export const ColorDot = ({
  color,
  className,
}: {
  color?: string;
  className?: string;
}) =>
  color ? (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  ) : null;

/** Board status badge (potential / active / won / exited), with its color. */
export const DealStatusBadge = ({
  status,
  className,
}: {
  status?: DealStatus;
  className?: string;
}) => {
  if (!status) return null;
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-normal", className)}>
      <ColorDot color={status.color} />
      {status.label}
    </Badge>
  );
};

/**
 * Sandler methodology stage badge. Only rendered on *active* deals, where the
 * stage is the current phase of the sales cycle.
 */
export const DealStageBadge = ({
  stage,
  className,
}: {
  stage?: DealStage;
  className?: string;
}) => {
  if (!stage) return null;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-normal", className)}
      style={
        stage.color
          ? { borderColor: stage.color, backgroundColor: `${stage.color}1f` }
          : undefined
      }
    >
      <ColorDot color={stage.color} />
      {stage.label}
    </Badge>
  );
};
