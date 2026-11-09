import { ResponsiveBar } from "@nivo/bar";
import { startOfMonth } from "date-fns";
import { TrendingUp } from "lucide-react";
import { useGetList, useLocaleState, useTranslate } from "ra-core";
import { memo, useMemo } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

const threeMonthsAgo = new Date(
  new Date().setMonth(new Date().getMonth() - 6),
).toISOString();

const DEFAULT_LOCALE = "en-US";

/** The revenue a deal already brings in, or is expected to bring in. */
const dealRevenue = (deal: Deal) => deal.final_amount ?? deal.budget ?? 0;

export const DealsChart = memo(() => {
  const translate = useTranslate();
  const [locale] = useLocaleState();
  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : locale, {
        month: "short",
      }),
    [locale],
  );
  const compactNumberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === "zh" ? "zh-CN" : locale, {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [locale],
  );
  // Won and exited are board statuses, not methodology stages.
  const { dealStatuses, currency } = useConfigurationContext();
  const acceptedLanguages = navigator
    ? navigator.languages || [navigator.language]
    : [DEFAULT_LOCALE];
  const wonLabel =
    dealStatuses.find((status) => status.value === "won")?.label ?? "Won";
  const exitedLabel =
    dealStatuses.find((status) => status.value === "exited")?.label ?? "Exited";

  const { data, isPending } = useGetList<Deal>("deals", {
    pagination: { perPage: 100, page: 1 },
    sort: {
      field: "created_at",
      order: "ASC",
    },
    filter: {
      "created_at@gte": threeMonthsAgo,
    },
  });
  const months = useMemo(() => {
    if (!data) return [];
    const dealsByMonth = data.reduce((acc, deal) => {
      const month = startOfMonth(deal.created_at ?? new Date()).toISOString();
      if (!acc[month]) {
        acc[month] = [];
      }
      acc[month].push(deal);
      return acc;
    }, {} as any);

    const amountByMonth = Object.keys(dealsByMonth).map((month) => {
      return {
        date: monthFormatter.format(new Date(month)),
        won: dealsByMonth[month]
          .filter((deal: Deal) => deal.status === "won")
          .reduce((acc: number, deal: Deal) => acc + dealRevenue(deal), 0),
        pending: dealsByMonth[month]
          .filter((deal: Deal) => !["won", "exited"].includes(deal.status))
          .reduce((acc: number, deal: Deal) => acc + (deal.budget ?? 0), 0),
        // Exited deals are drawn below the axis: the revenue did not happen.
        exited: dealsByMonth[month]
          .filter((deal: Deal) => deal.status === "exited")
          .reduce((acc: number, deal: Deal) => acc - dealRevenue(deal), 0),
      };
    });

    return amountByMonth;
  }, [data, monthFormatter]);

  if (isPending) return null; // FIXME return skeleton instead
  const range = months.reduce(
    (acc, month) => {
      acc.min = Math.min(acc.min, month.exited);
      acc.max = Math.max(acc.max, month.won + month.pending);
      return acc;
    },
    { min: 0, max: 0 },
  );
  return (
    <div className="flex flex-col">
      <div className="flex items-center mb-4">
        <div className="mr-3 flex">
          <TrendingUp className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground">
          {translate("crm.dashboard.deals_chart")}
        </h2>
      </div>
      <div className="h-[400px]">
        <ResponsiveBar
          data={months}
          indexBy="date"
          keys={["won", "pending", "exited"]}
          colors={["#61cdbb", "#97e3d5", "#e25c3b"]}
          margin={{ top: 30, right: 50, bottom: 30, left: 0 }}
          padding={0.3}
          valueScale={{
            type: "linear",
            min: range.min * 1.2,
            max: range.max * 1.2,
          }}
          indexScale={{ type: "band", round: true }}
          enableGridX={true}
          enableGridY={false}
          enableLabel={false}
          tooltip={({ value, indexValue }) => (
            <div className="p-2 bg-secondary rounded shadow inline-flex items-center gap-1 text-secondary-foreground">
              <strong>{indexValue}: </strong>&nbsp;{value > 0 ? "+" : ""}
              {value.toLocaleString(acceptedLanguages.at(0) ?? DEFAULT_LOCALE, {
                style: "currency",
                currency,
              })}
            </div>
          )}
          axisTop={{
            tickSize: 0,
            tickPadding: 12,
            style: {
              ticks: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
              legend: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
            },
          }}
          axisBottom={{
            legendPosition: "middle",
            legendOffset: 50,
            tickSize: 0,
            tickPadding: 12,
            style: {
              ticks: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
              legend: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
            },
          }}
          axisLeft={null}
          axisRight={{
            format: (v: any) => compactNumberFormatter.format(Math.abs(v)),
            tickValues: 8,
            style: {
              ticks: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
              legend: {
                text: {
                  fill: "var(--color-muted-foreground)",
                },
              },
            },
          }}
          markers={
            [
              {
                axis: "y",
                value: 0,
                lineStyle: { strokeOpacity: 0 },
                textStyle: { fill: "#2ebca6" },
                legend: wonLabel,
                legendPosition: "top-left",
                legendOrientation: "vertical",
              },
              {
                axis: "y",
                value: 0,
                lineStyle: {
                  stroke: "#f47560",
                  strokeWidth: 1,
                },
                textStyle: { fill: "#e25c3b" },
                legend: exitedLabel,
                legendPosition: "bottom-left",
                legendOrientation: "vertical",
              },
            ] as any
          }
        />
      </div>
    </div>
  );
});
