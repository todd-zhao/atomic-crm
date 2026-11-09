import { format } from "date-fns";

import type { ConfigurationContextValue } from "../root/ConfigurationContext";
import type { Deal, DealStage, DealStatus, LabeledValue } from "../types";

/** Route of the lead pool page (deals without a sales owner). */
export const DEALS_POOL_PATH = "/deals/pool";

/**
 * The configuration slices needed to label and color a deal. Passing the whole
 * configuration lets callers resolve a stage, a status and a type through the
 * same helpers.
 */
export type DealLabelConfig = Pick<
  ConfigurationContextValue,
  "dealStages" | "dealStatuses" | "dealTypes"
>;

/** Finds a configured option by its stored value. */
export const findChoice = <T extends LabeledValue>(
  choices: T[] | undefined,
  value: string | null | undefined,
): T | undefined => {
  if (!value) return undefined;
  return choices?.find((choice) => choice.value === value);
};

/**
 * Returns the label of a deal stage.
 *
 * Kept backward compatible with the previous `findDealLabel(dealStages, value)`
 * signature used by the dashboard, and extended so it also accepts the whole
 * deal configuration: `findDealLabel(config, value)` resolves a *stage* label.
 */
export function findDealLabel(
  choices: LabeledValue[],
  value?: string | null,
): string | undefined;
export function findDealLabel(
  config: DealLabelConfig,
  value?: string | null,
): string | undefined;
export function findDealLabel(
  source: DealLabelConfig | LabeledValue[],
  value?: string | null,
): string | undefined {
  const choices = Array.isArray(source) ? source : source.dealStages;
  return findChoice(choices, value)?.label;
}

export const findDealStage = (
  dealStages: DealStage[] | undefined,
  value: string | null | undefined,
) => findChoice(dealStages, value);

export const findDealStatus = (
  dealStatuses: DealStatus[] | undefined,
  value: string | null | undefined,
) => findChoice(dealStatuses, value);

export const findDealType = (
  dealTypes: LabeledValue[] | undefined,
  value: string | null | undefined,
) => findChoice(dealTypes, value);

/** Resolves the opportunity source: `direct` (直客) or `channel` (渠道). */
export const findDealSource = (
  dealSources: LabeledValue[] | undefined,
  value: string | null | undefined,
) => findChoice(dealSources, value);

/**
 * Normalizes a deal form payload before it is sent to the data provider:
 *
 * - an empty sales owner must be sent as `null` (not omitted), otherwise
 *   clearing the owner on an edit would leave the previous owner in place and
 *   the deal would never reach the public pool;
 * - `source_type` defaults to `direct`, as in the database;
 * - `channel_id` is kept only for channel-sourced deals, so switching back to a
 *   direct deal does not leave a stale channel reference.
 */
export const normalizeDealPayload = (
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const sourceType =
    typeof data.source_type === "string" && data.source_type
      ? data.source_type
      : "direct";
  // Cleared reference inputs may hand over "", undefined or null: the API needs
  // an explicit null to unassign the deal / drop the channel.
  const nullableId = (value: unknown) =>
    value == null || value === "" ? null : value;
  return {
    ...data,
    source_type: sourceType,
    sales_id: nullableId(data.sales_id),
    channel_id: sourceType === "channel" ? nullableId(data.channel_id) : null,
  };
};

/** Label helpers replacing the former `formatDealCategories`. */
export const formatDealStage = (
  config: DealLabelConfig,
  stage?: string | null,
) => findDealStage(config.dealStages, stage)?.label ?? stage ?? "";

export const formatDealStatus = (
  config: DealLabelConfig,
  status?: string | null,
) => findDealStatus(config.dealStatuses, status)?.label ?? status ?? "";

export const formatDealType = (config: DealLabelConfig, type?: string | null) =>
  findDealType(config.dealTypes, type)?.label ?? type ?? "";

/** Compact currency formatting used on the board, the cards and the show page. */
export const formatDealAmount = (
  amount: number | null | undefined,
  currency: string,
): string => {
  if (amount == null) return "";
  return amount.toLocaleString("en-US", {
    notation: "compact",
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumSignificantDigits: 3,
  });
};

const isoDateStringRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Index to use when appending a record (deal, stakeholder, pain, milestone…)
 * below the records of a list sorted by `index`.
 */
export const getNextIndex = (
  records: Array<{ index?: number | null }> | undefined,
): number =>
  (records ?? []).reduce(
    (max, record) => Math.max(max, record.index ?? -1),
    -1,
  ) + 1;

/** Short "MM/DD" closing date shown on the board cards, empty when unset. */
export const getDealReferenceDate = (deal: Deal): string => {
  const raw = deal.expected_closing_date;
  if (!raw) return "";
  const day = raw.slice(0, 10);
  if (!isoDateStringRegex.test(day)) return "";
  const [, month, date] = day.split("-").map(Number);
  return `${month}/${date}`;
};

export function formatISODateString(dateString: string) {
  if (!isoDateStringRegex.test(dateString)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD.");
  }
  // Some browsers will consider a date in the format YYYY-MM-DD as UTC, which can cause off-by-one-day issues depending on the user's timezone.
  // To avoid this, we can parse the date components manually and create a date object in the local timezone.
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return format(date, "PP");
}

/**
 * Formats a date coming from a `date` column (or a timestamp) without throwing
 * on empty / invalid values, unlike `formatISODateString`.
 */
export const formatDealDate = (value?: string | null): string => {
  if (!value) return "";
  const day = value.slice(0, 10);
  if (isoDateStringRegex.test(day)) {
    return formatISODateString(day);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "PP");
};

export function getRelativeTimeString(
  dateString: string,
  locale = "en",
): string {
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = date.getTime() - today.getTime();
  const unitDiff = Math.round(diff / (1000 * 60 * 60 * 24));

  // Check if the date is more than one week old
  if (Math.abs(unitDiff) > 7) {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
    }).format(date);
  }

  // Intl.RelativeTimeFormat for dates within the last week
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return ucFirst(rtf.format(unitDiff, "day"));
}

function ucFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
