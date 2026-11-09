import { useCallback } from "react";
import { useDataProvider, type DataProvider, type Identifier } from "ra-core";

import { getDisplayName } from "../misc/displayName";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Competitor, Sale } from "../types";
import { useCompanyResolver } from "./useCompanyResolver";
import { createEachRow } from "./createEachRow";
import { toConfiguredValue, toInteger, toIsoDate, toText } from "./parseCell";
import type { ImportRow, ProcessImportBatch } from "./types";

/** One CSV row, with the values needed before its deal can be created. */
type DealRow = {
  row: ImportRow;
  companyName: string | undefined;
  competitorName: string | undefined;
  channelKey: string | undefined;
  salesKey: string | undefined;
  stage: string | undefined;
  status: string | undefined;
  sourceType: string | undefined;
};

/**
 * Creates a deal per CSV row. Unknown columns are ignored, missing ones are
 * left empty — except `name` and `stage`, which the database requires.
 *
 * - `company` holds a hotel name: matching companies are reused, unknown ones
 *   are created (as hotels, the database default).
 * - `channel` holds a channel company name or id, matched against the existing
 *   `company_kind = 'channel'` companies. No channel is ever created.
 * - `sales` holds a sales owner name or email; when empty (or unknown) the deal
 *   is imported without an owner, i.e. into the lead pool.
 * - `competitor` is matched by name only: no competitor is created.
 */
export function useDealImport(): ProcessImportBatch {
  const { dealSources, dealStages, dealStatuses, dealTypes } =
    useConfigurationContext();
  const dataProvider = useDataProvider();
  const getCompanies = useCompanyResolver();

  return useCallback(
    async (batch) => {
      // Parse the company / competitor / channel / sales references and the
      // configured values once per row: they are needed to resolve references
      // and board indexes up front, then again per deal.
      const rows: DealRow[] = batch.map((row) => ({
        row,
        companyName: toText(row.company),
        competitorName: toText(row.competitor),
        channelKey: toText(row.channel),
        salesKey: toText(row.sales),
        // stage is required, so fall back to the first configured one
        stage: toConfiguredValue(row.stage, dealStages) ?? dealStages[0]?.value,
        // status drives the board columns, default to the first one
        status:
          toConfiguredValue(row.status, dealStatuses) ?? dealStatuses[0]?.value,
        // direct (直客) is the default source
        sourceType:
          toConfiguredValue(row.source_type, dealSources) ??
          dealSources[0]?.value,
      }));

      const [companies, competitors, channels, sales, indexes] =
        await Promise.all([
          getCompanies(
            rows
              .map(({ companyName }) => companyName)
              .filter((name): name is string => name !== undefined),
          ),
          fetchCompetitorsByName(dataProvider),
          fetchChannelsByKey(dataProvider),
          fetchSalesByKey(dataProvider),
          appendedIndexes(rows, dataProvider),
        ]);

      const now = new Date().toISOString();
      return createEachRow(
        rows.map(
          ({
            row,
            companyName,
            competitorName,
            channelKey,
            salesKey,
            stage,
            status,
            sourceType,
          }) =>
            dataProvider.create("deals", {
              data: {
                name: toText(row.name),
                company_id: companyName
                  ? companies.get(companyName)?.id
                  : undefined,
                stage,
                status,
                source_type: sourceType,
                channel_id: channelKey
                  ? channels.get(channelKey.toLowerCase())
                  : undefined,
                sales_id: salesKey
                  ? sales.get(salesKey.toLowerCase())
                  : undefined,
                deal_type: toConfiguredValue(row.deal_type, dealTypes),
                budget: toInteger(row.budget),
                final_amount: toInteger(row.final_amount),
                decision_process: toText(row.decision_process),
                competitor_id: competitorName
                  ? competitors.get(competitorName.toLowerCase())
                  : undefined,
                description: toText(row.description),
                expected_closing_date: toIsoDate(row.expected_closing_date),
                // No owner means the deal lands in the lead pool.
                index: indexes.get(row) ?? 0,
                created_at: now,
                updated_at: now,
              },
            }),
        ),
      );
    },
    [
      dataProvider,
      dealSources,
      dealStages,
      dealStatuses,
      dealTypes,
      getCompanies,
    ],
  );
}

/**
 * Competitors are matched by name only: importing a deal never creates a
 * competitor, as their brand influence / advantages are real CRM data.
 */
const fetchCompetitorsByName = async (
  dataProvider: DataProvider,
): Promise<Map<string, Identifier>> => {
  try {
    const { data } = await dataProvider.getList<Competitor>("competitors", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "name", order: "ASC" },
    });
    return new Map(
      data.map((competitor) => [
        competitor.name.trim().toLowerCase(),
        competitor.id,
      ]),
    );
  } catch {
    // The competitors resource may not exist yet (older databases): the column
    // is optional, so just ignore it instead of failing the whole import.
    return new Map();
  }
};

/**
 * Channel companies are matched by name or id, from the existing channel
 * directory (`company_kind = 'channel'`). An unknown channel is ignored rather
 * than created: channels are curated CRM data.
 */
const fetchChannelsByKey = async (
  dataProvider: DataProvider,
): Promise<Map<string, Identifier>> => {
  try {
    const { data } = await dataProvider.getList("companies", {
      filter: { "company_kind@eq": "channel" },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "name", order: "ASC" },
    });
    const channels = new Map<string, Identifier>();
    for (const channel of data) {
      const name = String(channel.name ?? "")
        .trim()
        .toLowerCase();
      if (name) channels.set(name, channel.id);
      channels.set(String(channel.id), channel.id);
    }
    return channels;
  } catch {
    return new Map();
  }
};

/**
 * Sales owners are matched by email, full display name, "first last" or id.
 * An empty / unknown value leaves the deal in the lead pool.
 */
const fetchSalesByKey = async (
  dataProvider: DataProvider,
): Promise<Map<string, Identifier>> => {
  try {
    const { data } = await dataProvider.getList<Sale>("sales", {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "last_name", order: "ASC" },
    });
    const sales = new Map<string, Identifier>();
    for (const sale of data) {
      const keys = [
        sale.email,
        getDisplayName(sale),
        [sale.first_name, sale.last_name].filter(Boolean).join(" "),
        String(sale.id),
      ];
      for (const key of keys) {
        const normalized = String(key ?? "")
          .trim()
          .toLowerCase();
        if (normalized) sales.set(normalized, sale.id);
      }
    }
    return sales;
  } catch {
    return new Map();
  }
};

/**
 * One distinct index per imported deal, appended below the deals already in its
 * status column and keeping the CSV row order.
 *
 * The board sorts each column on `index`, and its drag handler shifts the
 * indexes of the cards around the drop target. A column whose deals all share
 * `index: 0` therefore cannot be reordered — the drop writes `index: 0` again
 * and the card snaps back — and its order is whatever the backend returns.
 */
const appendedIndexes = async (
  rows: DealRow[],
  dataProvider: DataProvider,
): Promise<Map<ImportRow, number>> => {
  const statuses = [
    ...new Set(
      rows
        .map(({ status }) => status)
        .filter((status): status is string => status !== undefined),
    ),
  ];
  const lastIndexes = new Map(
    await Promise.all(
      statuses.map(
        async (status) =>
          [status, await lastIndexOf(status, dataProvider)] as const,
      ),
    ),
  );

  return new Map(
    statuses.flatMap((status) => {
      const firstIndex = (lastIndexes.get(status) ?? -1) + 1;
      return rows
        .filter((candidate) => candidate.status === status)
        .map(({ row }, position) => [row, firstIndex + position] as const);
    }),
  );
};

/** Highest index currently used in a status column, or -1 when it is empty. */
const lastIndexOf = async (status: string, dataProvider: DataProvider) => {
  const { data } = await dataProvider.getList("deals", {
    filter: { status },
    pagination: { page: 1, perPage: 1 },
    sort: { field: "index", order: "DESC" },
  });
  return data[0]?.index ?? -1;
};
