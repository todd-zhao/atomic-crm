import { useCallback, useMemo } from "react";
import { useDataProvider, useGetIdentity, type DataProvider } from "ra-core";

import { mapSizeToCategory } from "../companies/sizes";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company } from "../types";
import {
  toConfiguredValue,
  toConfiguredValues,
  toInteger,
  toNumber,
  toText,
} from "./parseCell";
import type { ImportCell, ProcessImportBatch } from "./types";

/**
 * Creates a company per CSV row. Unknown columns are ignored, missing ones are
 * left empty — except `name`, which the database requires.
 *
 * `company_kind` selects the directory (`hotel` by default, `channel` for the
 * channel directory) and `channel_type` is only stored for channels. Hotel
 * custom fields are ignored on channel rows, and vice versa.
 *
 * `parent_company_id` accepts either the id of an existing company or its name
 * (e.g. the group HQ of a hotel). Names are resolved once the whole batch exists,
 * so a CSV may reference a group listed by another row of the same file. A name
 * that matches no company is left empty rather than creating a bare duplicate:
 * list the group in the CSV or create it first.
 */
export function useCompanyImport(): ProcessImportBatch {
  const {
    channelTypes,
    companyKinds,
    companySectors,
    companyCustomerCategories,
    hotelTypes,
    hotelServices,
  } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();

  // Companies created by this import, by name, so a parent created by an earlier
  // batch resolves without querying the backend again.
  const importedCompanies = useMemo(
    () => new Map<string, Company["id"]>(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataProvider],
  );

  return useCallback(
    async (batch) => {
      // Create every row first, without its parent: a hotel's parent may be
      // another row of this very batch, which does not exist yet.
      const results = await Promise.allSettled(
        batch.map((row) => {
          const companyKind =
            toConfiguredValue(row.company_kind, companyKinds) ?? "hotel";
          const isHotel = companyKind === "hotel";
          return dataProvider.create<Company>("companies", {
            data: {
              name: toText(row.name),
              company_kind: companyKind,
              // A channel has no hotel fields, and a hotel has no channel type
              channel_type: isHotel
                ? undefined
                : toConfiguredValue(row.channel_type, channelTypes),
              sector: toConfiguredValue(row.sector, companySectors),
              size: sizeOf(row.size),
              linkedin_url: toText(row.linkedin_url),
              website: toText(row.website),
              phone_number: toText(row.phone_number),
              address: toText(row.address),
              zipcode: toText(row.zipcode),
              city: toText(row.city),
              state_abbr: toText(row.state_abbr),
              country: toText(row.country),
              description: toText(row.description),
              revenue: toText(row.revenue),
              tax_identifier: toText(row.tax_identifier),
              customer_category: isHotel
                ? toConfiguredValue(
                    row.customer_category,
                    companyCustomerCategories,
                  )
                : undefined,
              hotel_type: isHotel
                ? toConfiguredValue(row.hotel_type, hotelTypes)
                : undefined,
              hotel_services: isHotel
                ? toConfiguredValues(row.hotel_services, hotelServices)
                : undefined,
              rooms: isHotel ? toInteger(row.rooms) : undefined,
              opening_year: isHotel
                ? openingYearOf(row.opening_year)
                : undefined,
              average_room_rate: isHotel
                ? toNumber(row.average_room_rate)
                : undefined,
              sales_id: identity?.id,
              created_at: new Date().toISOString(),
            },
          });
        }),
      );

      const created = results.flatMap((result, index) =>
        result.status === "fulfilled"
          ? [{ row: batch[index], record: result.value.data }]
          : [],
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      for (const { reason } of rejected) {
        console.error("Failed to import a company", reason);
      }
      for (const { row, record } of created) {
        const name = toText(row.name);
        if (name) importedCompanies.set(name, record.id);
      }

      // Second pass: link each created company to its parent, now that the whole
      // batch exists and can be looked up by name.
      await Promise.all(
        created.map(async ({ row, record }) => {
          const parentId = await resolveParentId(
            row.parent_company_id,
            record.id,
            importedCompanies,
            dataProvider,
          );
          if (parentId == null) return;
          try {
            await dataProvider.update<Company>("companies", {
              id: record.id,
              // logo is sent back untouched: the fakerest lifecycle rebuilds it
              // from the update payload, which would drop the existing one
              data: { parent_company_id: parentId, logo: record.logo },
              previousData: record,
            });
          } catch (error) {
            console.error("Failed to link a company to its parent", error);
          }
        }),
      );

      return created.length;
    },
    [
      channelTypes,
      companyKinds,
      companySectors,
      companyCustomerCategories,
      hotelTypes,
      hotelServices,
      dataProvider,
      identity?.id,
      importedCompanies,
    ],
  );
}

/**
 * `size` is a bucket id, not a headcount, so an arbitrary CSV number is coerced
 * into the nearest bucket the company screens can render.
 */
const sizeOf = (cell: ImportCell) => {
  const size = toNumber(cell);
  return size === undefined ? undefined : mapSizeToCategory(size);
};

/** Opening year is a smallint between 1950 and 2100, per the data model. */
const openingYearOf = (cell: ImportCell) => {
  const year = toInteger(cell);
  return year === undefined ? undefined : Math.min(Math.max(year, 1950), 2100);
};

/**
 * Resolves a `parent_company_id` cell: a number is the id of an existing
 * company, a text is its name.
 */
const resolveParentId = async (
  cell: ImportCell,
  ownId: Company["id"],
  importedCompanies: Map<string, Company["id"]>,
  dataProvider: DataProvider,
): Promise<Company["id"] | undefined> => {
  if (typeof cell === "number") {
    return cell === ownId ? undefined : cell;
  }
  const name = toText(cell);
  if (!name) return undefined;

  const importedId = importedCompanies.get(name);
  if (importedId != null) {
    return importedId === ownId ? undefined : importedId;
  }

  // Search rather than filter on name equality: names often contain commas,
  // which PostgREST reads as filter separators. The first exact match wins.
  const { data } = await dataProvider.getList<Company>("companies", {
    filter: { q: name },
    pagination: { page: 1, perPage: 25 },
    sort: { field: "id", order: "ASC" },
  });
  const parent = data.find(
    (company) => company.name?.trim().toLowerCase() === name.toLowerCase(),
  );
  return parent?.id === ownId ? undefined : parent?.id;
};
