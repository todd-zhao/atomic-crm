import { useState } from "react";
import {
  type Identifier,
  useDataProvider,
  useEvent,
  useGetIdentity,
  useRefresh,
} from "ra-core";
import { JSONParser, type JsonTypes } from "@streamparser/json-whatwg";
import mime from "mime/lite";
import type { CrmDataProvider } from "../providers/types";
import type { Education, RAFile, Sale, Tag, WorkExperience } from "../types";
import { colors } from "../tags/colors";
import { mapSizeToCategory } from "../companies/sizes";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  defaultDealStages,
  defaultDealStatuses,
} from "../root/defaultConfiguration";
import { contactGender } from "../contacts/contactModel";
import { getSaleName } from "./displayName";

export type ImportFromJsonStats = {
  sales: number;
  companies: number;
  contacts: number;
  deals: number;
  notes: number;
  tasks: number;
};

export type ImportFromJsonFailures = {
  sales: Array<JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined>;
  companies: Array<JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined>;
  contacts: Array<JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined>;
  deals: Array<JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined>;
  notes: Array<JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined>;
  tasks: Array<JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined>;
};

export type ImportFromJsonIdleState = {
  status: "idle";
  error: null;
  stats: ImportFromJsonStats;
  failedImports: ImportFromJsonFailures;
};

export type ImportFromJsonImportingState = {
  status: "importing";
  stats: ImportFromJsonStats;
  error: null;
  failedImports: ImportFromJsonFailures;
};

export type ImportFromJsonErrorState = {
  status: "error";
  error: Error;
  stats: ImportFromJsonStats;
  failedImports: ImportFromJsonFailures;
  duration: number;
};

export type ImportFromJsonSuccessState = {
  status: "success";
  stats: ImportFromJsonStats;
  error: null;
  failedImports: ImportFromJsonFailures;
  duration: number;
};

export type ImportFromJsonState =
  | ImportFromJsonErrorState
  | ImportFromJsonIdleState
  | ImportFromJsonImportingState
  | ImportFromJsonSuccessState;

export type ImportFromJsonFunction = (file: File) => Promise<void>;
type ResetFunction = () => void;

const defaultFailedImports = {
  sales: [],
  companies: [],
  contacts: [],
  deals: [],
  notes: [],
  tasks: [],
};

const defaultStats = {
  sales: 0,
  companies: 0,
  contacts: 0,
  deals: 0,
  notes: 0,
  tasks: 0,
};

/**
 * A hook that returns a function to import data from a JSON file.
 * We do the import on the client because edge functions are limited in both execution time and memory.
 */
export const useImportFromJson = (): [
  ImportFromJsonState,
  ImportFromJsonFunction,
  ResetFunction,
] => {
  const { data: currentSale } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const refresh = useRefresh();
  const { companySectors, companyKinds, dealSources } =
    useConfigurationContext();
  const [state, setState] = useState<ImportFromJsonState>({
    status: "idle",
    error: null,
    stats: defaultStats,
    failedImports: defaultFailedImports,
  });

  const reset = useEvent(() => {
    setState({
      status: "idle",
      error: null,
      stats: defaultStats,
      failedImports: defaultFailedImports,
    });
  });

  const importFile = useEvent(async (file: File) => {
    if (currentSale == null) {
      throw new Error("Importing data requires to be authenticated");
    }
    const startedAt = new Date();

    setState({
      status: "importing",
      stats: defaultStats,
      failedImports: defaultFailedImports,
      error: null,
    });

    const idsMaps: {
      sales: Record<number, Identifier>;
      companies: Record<number, Identifier>;
      contacts: Record<number, Identifier>;
      competitors: Record<string, Identifier>;
      /** Channel company names resolved to company ids (never created). */
      channels: Record<string, Identifier>;
      tags: Record<string, Identifier>;
    } = {
      sales: {},
      companies: {},
      contacts: {},
      competitors: {},
      channels: {},
      tags: {},
    };

    const importSale = async (
      dataToImport: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined,
    ) => {
      try {
        if (!isSale(dataToImport)) {
          throw new Error(`Error while importing sale: Invalid data`);
        }
        const existingRecordResponse = await dataProvider.getList("sales", {
          filter: { email: dataToImport.email.trim() },
          pagination: { page: 1, perPage: 1 },
          sort: { field: "id", order: "ASC" },
        });
        if (existingRecordResponse.total === 1) {
          idsMaps.sales[dataToImport.id] = existingRecordResponse.data[0].id;
          return existingRecordResponse.data[0].id;
        }

        const data = await dataProvider.salesCreate({
          email: dataToImport.email.trim(),
          name: dataToImport.name?.trim() || undefined,
          first_name: dataToImport.first_name.trim(),
          last_name: dataToImport.last_name.trim(),
          administrator: false,
          disabled: false,
        });

        idsMaps.sales[dataToImport.id] = data.id;
        setState((old) => {
          if (old.status === "error") {
            return {
              ...old,
              stats: {
                ...(old.stats ?? defaultStats),
                sales: (old.stats ?? defaultStats).sales + 1,
              },
            };
          }
          return {
            ...old,
            status: "importing",
            stats: {
              ...(old.stats ?? defaultStats),
              sales: (old.stats ?? defaultStats).sales + 1,
            },
            error: null,
          };
        });
        return data;
      } catch (err) {
        const duration = new Date().valueOf() - startedAt.valueOf();
        setState((old) => ({
          ...old,
          status: "error",
          error: new Error(
            `Error while importing sale: ${(err as Error).message}`,
          ),
          failedImports: {
            ...old.failedImports,
            sales: [
              ...old.failedImports.sales,
              { ...(dataToImport as any), error: (err as Error).message },
            ],
          },
          duration,
        }));
      }
    };

    const importCompany = async (
      dataToImport: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined,
    ) => {
      if (!isCompany(dataToImport)) {
        setState((old) => ({
          ...old,
          status: "importing",
          error: null,
          failedImports: {
            ...old.failedImports,
            companies: [
              ...old.failedImports.companies,
              { ...(dataToImport as any), error: "Invalid format" },
            ],
          },
        }));
        return;
      }
      try {
        // Validate sector against configuration
        const sector = dataToImport.sector?.trim();
        if (sector && !companySectors.some((s) => s.value === sector)) {
          setState((old) => ({
            ...old,
            status: "importing",
            error: null,
            failedImports: {
              ...old.failedImports,
              companies: [
                ...old.failedImports.companies,
                {
                  ...(dataToImport as any),
                  error: `Invalid sector "${sector}". Must be one of: ${companySectors.map((s) => s.value).join(", ")}`,
                },
              ],
            },
          }));
          return;
        }

        // Validate the company directory against configuration when given:
        // the default (hotel) is created even in a filtered configuration.
        const companyKind = dataToImport.company_kind?.trim();
        if (
          companyKind &&
          !companyKinds.some((kind) => kind.value === companyKind)
        ) {
          setState((old) => ({
            ...old,
            status: "importing",
            error: null,
            failedImports: {
              ...old.failedImports,
              companies: [
                ...old.failedImports.companies,
                {
                  ...(dataToImport as any),
                  error: `Invalid company_kind "${companyKind}". Must be one of: ${companyKinds.map((kind) => kind.value).join(", ")}`,
                },
              ],
            },
          }));
          return;
        }

        const { data } = await dataProvider.create("companies", {
          data: {
            name: dataToImport.name.trim(),
            // Two company directories share the companies table: hotels (the
            // default) and channel partners.
            company_kind: companyKind || "hotel",
            channel_type:
              companyKind === "channel"
                ? dataToImport.channel_type?.trim() || undefined
                : undefined,
            description: dataToImport.description?.trim(),
            city: dataToImport.city?.trim(),
            country: dataToImport.country?.trim(),
            address: dataToImport.address?.trim(),
            zipcode: dataToImport.zipcode?.trim(),
            state_abbr: dataToImport.state_abbr?.trim(),
            sector: sector || undefined,
            customer_category:
              dataToImport.customer_category?.trim() || undefined,
            parent_company_id:
              dataToImport.parent_company_id != null
                ? idsMaps.companies[dataToImport.parent_company_id]
                : undefined,
            hotel_type: dataToImport.hotel_type?.trim() || undefined,
            rooms: dataToImport.rooms ?? undefined,
            opening_year: dataToImport.opening_year ?? undefined,
            hotel_services: parseStringArray(dataToImport.hotel_services),
            average_room_rate: dataToImport.average_room_rate ?? undefined,
            size: dataToImport.size
              ? mapSizeToCategory(dataToImport.size)
              : undefined,
            linkedin_url: dataToImport.linkedin_url?.trim(),
            website: dataToImport.website?.trim(),
            phone_number: dataToImport.phone_number?.trim(),
            revenue: dataToImport.revenue?.trim(),
            tax_identifier: dataToImport.tax_identifier?.trim(),
            context_links: Array.isArray(dataToImport.context_links)
              ? dataToImport.context_links
              : undefined,
            sales_id: dataToImport.sales_id
              ? idsMaps.sales[dataToImport.sales_id]
              : currentSale.id,
            created_at: dataToImport.created_at,
          },
        });

        idsMaps.companies[dataToImport.id] = data.id;
        setState((old) => ({
          ...old,
          status: "importing",
          stats: {
            ...old.stats,
            companies: old.stats.companies + 1,
          },
          error: null,
        }));
        return data;
      } catch (err) {
        console.error(err);
        setState((old) => ({
          ...old,
          status: "importing",
          error: null,
          failedImports: {
            ...old.failedImports,
            companies: [
              ...old.failedImports.companies,
              { ...(dataToImport as any), error: (err as Error).message },
            ],
          },
        }));
      }
    };

    const importContact = async (
      dataToImport: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined,
    ) => {
      if (!isContact(dataToImport)) {
        setState((old) => ({
          ...old,
          status: "importing",
          error: null,
          failedImports: {
            ...old.failedImports,
            contacts: [
              ...old.failedImports.contacts,
              { ...(dataToImport as any), error: "Invalid format" },
            ],
          },
        }));
        return;
      }

      try {
        // Validate gender against valid values
        const gender = dataToImport.gender?.trim();
        if (gender && !contactGender.some((g) => g.value === gender)) {
          setState((old) => ({
            ...old,
            status: "importing",
            error: null,
            failedImports: {
              ...old.failedImports,
              contacts: [
                ...old.failedImports.contacts,
                {
                  ...(dataToImport as any),
                  error: `Invalid gender "${gender}". Must be one of: ${contactGender.map((g) => g.value).join(", ")}`,
                },
              ],
            },
          }));
          return;
        }

        let tagsIds: Array<Identifier> = [];
        if (dataToImport.tags && Array.isArray(dataToImport.tags)) {
          tagsIds = await Promise.all(
            dataToImport.tags.map(async (tag) => {
              if (idsMaps.tags[tag]) {
                return idsMaps.tags[tag];
              }
              const { data } = await dataProvider.create<Tag>("tags", {
                data: {
                  name: tag,
                  color: colors[Math.floor(Math.random() * colors.length)],
                },
              });
              idsMaps.tags[tag] = data.id;
              return data.id;
            }),
          );
        }

        const { data } = await dataProvider.create("contacts", {
          data: {
            // A JSON export can carry contacts identified by their full name
            // only: the legacy first/last name fields are optional then.
            name: dataToImport.name?.trim() || undefined,
            last_name: dataToImport.last_name?.trim(),
            first_name: dataToImport.first_name?.trim(),
            title: dataToImport.title?.trim(),
            background: dataToImport.background?.trim(),
            wechat_id: dataToImport.wechat_id?.trim(),
            contact_type: dataToImport.contact_type?.trim() || undefined,
            birthday: dataToImport.birthday || undefined,
            communication_style:
              dataToImport.communication_style?.trim() || undefined,
            attitude: dataToImport.attitude?.trim() || undefined,
            tenure_years: dataToImport.tenure_years ?? undefined,
            social_organization:
              dataToImport.social_organization?.trim() || undefined,
            work_experience: Array.isArray(dataToImport.work_experience)
              ? dataToImport.work_experience
              : undefined,
            education: Array.isArray(dataToImport.education)
              ? dataToImport.education
              : undefined,
            gender: gender || undefined,
            has_newsletter: !!dataToImport.has_newsletter,
            company_id: dataToImport.company_id
              ? idsMaps.companies[dataToImport.company_id]
              : undefined,
            email_jsonb: Array.isArray(dataToImport.emails)
              ? dataToImport.emails
              : undefined,
            phone_jsonb: Array.isArray(dataToImport.phones)
              ? dataToImport.phones
              : undefined,
            sales_id: dataToImport.sales_id
              ? idsMaps.sales[dataToImport.sales_id]
              : currentSale.id,
            tags: tagsIds,
            first_seen: dataToImport.created_at,
            last_seen: dataToImport.updated_at,
          },
        });
        idsMaps.contacts[dataToImport.id] = data.id;
        setState((old) => ({
          ...old,
          status: "importing",
          stats: {
            ...old.stats,
            contacts: old.stats.contacts + 1,
          },
          error: null,
        }));
        return data;
      } catch (err) {
        console.error(err);
        setState((old) => ({
          ...old,
          status: "importing",
          error: null,
          failedImports: {
            ...old.failedImports,
            contacts: [
              ...old.failedImports.contacts,
              { ...(dataToImport as any), error: (err as Error).message },
            ],
          },
        }));
      }
    };

    /**
     * Resolve a competitor named in the file to its id, creating it when the
     * target CRM has no competitor with that name yet.
     */
    const getCompetitorId = async (name: string) => {
      if (idsMaps.competitors[name] != null) {
        return idsMaps.competitors[name];
      }
      const { data: existing } = await dataProvider.getList("competitors", {
        filter: { name },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      });
      if (existing.length > 0) {
        idsMaps.competitors[name] = existing[0].id;
        return existing[0].id;
      }
      const { data: created } = await dataProvider.create("competitors", {
        data: { name },
      });
      idsMaps.competitors[name] = created.id;
      return created.id;
    };

    /**
     * Resolve a channel company named in the file to its id. Channels are not
     * created from a deal: an unknown name just leaves the deal without one.
     */
    const getChannelId = async (name: string) => {
      const key = name.toLowerCase();
      if (idsMaps.channels[key] != null) {
        return idsMaps.channels[key];
      }
      const { data: channels } = await dataProvider.getList("companies", {
        filter: { name, company_kind: "channel" },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "id", order: "ASC" },
      });
      if (channels.length === 0) return null;
      idsMaps.channels[key] = channels[0].id;
      return channels[0].id;
    };

    // The sales owners are matched by email or display name; the list is
    // loaded once and cached for the whole import.
    let salesList: Sale[] | null = null;
    const getSaleId = async (
      identifier: string,
    ): Promise<Identifier | null> => {
      const value = identifier.trim().toLowerCase();
      if (!value) return null;
      if (salesList == null) {
        const { data } = await dataProvider.getList("sales", {
          filter: {},
          pagination: { page: 1, perPage: 1000 },
          sort: { field: "id", order: "ASC" },
        });
        salesList = data;
      }
      const match = salesList.find(
        (sale) =>
          sale.email?.toLowerCase() === value ||
          getSaleName(sale).toLowerCase() === value ||
          `${sale.first_name ?? ""} ${sale.last_name ?? ""}`
            .trim()
            .toLowerCase() === value,
      );
      return match?.id ?? null;
    };

    const importDeal = async (
      dataToImport: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined,
    ) => {
      if (!isDeal(dataToImport)) {
        setState((old) => ({
          ...old,
          status: "importing",
          error: null,
          failedImports: {
            ...old.failedImports,
            deals: [
              ...old.failedImports.deals,
              { ...(dataToImport as any), error: "Invalid format" },
            ],
          },
        }));
        return;
      }

      try {
        const competitorName = dataToImport.competitor?.trim();
        // A deal without an owner waits in the public pool, so an unmatched
        // `sales` name (or no `sales` at all) results in a null owner.
        const salesId =
          dataToImport.sales_id != null
            ? (idsMaps.sales[dataToImport.sales_id] ?? null)
            : await getSaleId(dataToImport.sales ?? "");
        const channelName = dataToImport.channel?.trim();
        const sourceType =
          dataToImport.source_type?.trim() ||
          (channelName ? "channel" : "direct");
        // Validate the source against configuration when given: the default
        // (direct) is created even in a filtered configuration.
        if (
          dataToImport.source_type?.trim() &&
          !dealSources.some((source) => source.value === sourceType)
        ) {
          setState((old) => ({
            ...old,
            status: "importing",
            error: null,
            failedImports: {
              ...old.failedImports,
              deals: [
                ...old.failedImports.deals,
                {
                  ...(dataToImport as any),
                  error: `Invalid source_type "${sourceType}". Must be one of: ${dealSources.map((source) => source.value).join(", ")}`,
                },
              ],
            },
          }));
          return;
        }
        const channelId =
          sourceType === "channel" && channelName
            ? await getChannelId(channelName)
            : null;
        const { data } = await dataProvider.create("deals", {
          data: {
            name: dataToImport.name.trim(),
            company_id:
              dataToImport.company_id != null
                ? idsMaps.companies[dataToImport.company_id]
                : undefined,
            // Both enums are required by the database: fall back to the first
            // configured value when the file does not carry them.
            stage: dataToImport.stage?.trim() || defaultDealStages[0].value,
            status: dataToImport.status?.trim() || defaultDealStatuses[0].value,
            deal_type: dataToImport.deal_type?.trim() || undefined,
            source_type: sourceType,
            channel_id: channelId,
            description: dataToImport.description?.trim(),
            decision_process: dataToImport.decision_process?.trim(),
            budget: dataToImport.budget ?? undefined,
            final_amount: dataToImport.final_amount ?? undefined,
            expected_closing_date: dataToImport.expected_closing_date,
            competitor_id: competitorName
              ? await getCompetitorId(competitorName)
              : undefined,
            sales_id: salesId,
            created_at: dataToImport.created_at,
            updated_at: dataToImport.updated_at,
            index: dataToImport.index ?? 0,
          },
        });
        setState((old) => ({
          ...old,
          status: "importing",
          stats: {
            ...old.stats,
            deals: old.stats.deals + 1,
          },
          error: null,
        }));
        return data;
      } catch (err) {
        console.error(err);
        setState((old) => ({
          ...old,
          status: "importing",
          error: null,
          failedImports: {
            ...old.failedImports,
            deals: [
              ...old.failedImports.deals,
              { ...(dataToImport as any), error: (err as Error).message },
            ],
          },
        }));
      }
    };

    const importNote = async (
      dataToImport: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined,
    ) => {
      if (!isNote(dataToImport)) {
        setState((old) => ({
          ...old,
          status: "importing",
          failedImports: {
            ...old.failedImports,
            notes: [
              ...old.failedImports.notes,
              { ...(dataToImport as any), error: "Invalid format" },
            ],
          },
          error: null,
        }));
        return;
      }
      try {
        if (idsMaps.sales[dataToImport.sales_id] == null) {
          console.error(
            `note ${dataToImport.text} has an invalid sales ID: ${dataToImport.sales_id}. Fallback to default sale`,
          );
        }
        if (idsMaps.contacts[dataToImport.contact_id] == null) {
          setState((old) => ({
            ...old,
            status: "importing",
            failedImports: {
              ...old.failedImports,
              notes: [
                ...old.failedImports.notes,
                {
                  ...(dataToImport as any),
                  error: `Invalid contact_id ${dataToImport.contact_id}`,
                },
              ],
            },
            error: null,
          }));
          return;
        }

        const attachments: Array<
          Omit<RAFile, "rawFile"> & {
            rawFile: { name: string; type: string | null };
          }
        > = [];
        if (Array.isArray(dataToImport.attachments)) {
          for (const file of dataToImport.attachments) {
            attachments.push({
              src: file.url,
              title: file.name,
              rawFile: {
                name: file.name,
                type: mime.getType(file.name.split(".").pop()!),
              },
            });
          }
        }

        await dataProvider.create("contact_notes", {
          data: {
            contact_id: idsMaps.contacts[dataToImport.contact_id],
            sales_id: idsMaps.sales[dataToImport.sales_id] ?? currentSale.id,
            text: dataToImport.text,
            date: dataToImport.date,
            attachments,
          },
        });
        setState((old) => ({
          ...old,
          status: "importing",
          stats: {
            ...old.stats,
            notes: old.stats.notes + 1,
          },
          error: null,
        }));
      } catch (err) {
        console.error(err);
        setState((old) => ({
          ...old,
          status: "importing",
          failedImports: {
            ...old.failedImports,
            notes: [
              ...old.failedImports.notes,
              { ...(dataToImport as any), error: (err as Error).message },
            ],
          },
          error: null,
        }));
      }
    };

    const importTask = async (
      dataToImport: JsonTypes.JsonPrimitive | JsonTypes.JsonStruct | undefined,
    ) => {
      if (!isTask(dataToImport)) {
        setState((old) => ({
          ...old,
          status: "importing",
          failedImports: {
            ...old.failedImports,
            tasks: [
              ...old.failedImports.tasks,
              { ...(dataToImport as any), error: "Invalid format" },
            ],
          },
          error: null,
        }));
        return;
      }
      try {
        if (idsMaps.sales[dataToImport.sales_id] == null) {
          console.error(
            `task ${dataToImport.text} has an invalid sales ID: ${dataToImport.sales_id}. Fallback to default sale`,
          );
        }
        if (idsMaps.contacts[dataToImport.contact_id] == null) {
          setState((old) => ({
            ...old,
            status: "importing",
            failedImports: {
              ...old.failedImports,
              tasks: [
                ...old.failedImports.tasks,
                {
                  ...(dataToImport as any),
                  error: `Invalid contact_id ${dataToImport.contact_id}`,
                },
              ],
            },
            error: null,
          }));
          return;
        }

        await dataProvider.create("tasks", {
          data: {
            contact_id: idsMaps.contacts[dataToImport.contact_id],
            sales_id: idsMaps.sales[dataToImport.sales_id] ?? currentSale.id,
            text: dataToImport.text,
            due_date: dataToImport.due_date || undefined,
            done_date: dataToImport.done_date || undefined,
          },
        });
        setState((old) => ({
          ...old,
          status: "importing",
          stats: {
            ...old.stats,
            tasks: old.stats.tasks + 1,
          },
          error: null,
        }));
      } catch (err) {
        console.error(err);
        setState((old) => ({
          ...old,
          status: "importing",
          failedImports: {
            ...old.failedImports,
            tasks: [
              ...old.failedImports.tasks,
              { ...(dataToImport as any), error: (err as Error).message },
            ],
          },
          error: null,
        }));
      }
    };

    let currentTask: Promise<any> | null = null;
    let currentBatch: Array<Promise<void>> = [];
    const BATCH_SIZE = 50;

    const parser = new JSONParser({
      paths: [
        "$.sales.*",
        "$.companies.*",
        "$.contacts.*",
        "$.deals.*",
        "$.notes.*",
        "$.tasks.*",
      ],
      keepStack: false,
    });
    const stream = file.stream();
    const reader = stream.pipeThrough(parser).getReader();

    const proccesBatchIfPossible = async (
      shouldProcessIncompleteBatch: boolean = false,
    ) => {
      if (currentBatch.length === BATCH_SIZE || shouldProcessIncompleteBatch) {
        currentTask = Promise.all(currentBatch);
        await currentTask;
        currentBatch = [];
        currentTask = null;
      }
    };
    let currentType: Types = "sales";
    while (true) {
      const { done, value: parsedElementInfo } = await reader.read();
      if (done) {
        await proccesBatchIfPossible(true);
        break;
      }
      const { value, stack, partial } = parsedElementInfo;
      if (partial) continue;
      const type =
        stack.length > 1 ? getType(stack[1].key?.toString()) : undefined;

      if (type == null) {
        continue;
      }

      if (type !== currentType) {
        // When moving to another type, make sure we wait for the previous batch to be imported
        await proccesBatchIfPossible(true);
        currentType = type;
      }
      switch (type) {
        case "sales": {
          currentBatch.push(importSale(value));
          break;
        }
        case "companies": {
          currentBatch.push(importCompany(value));
          break;
        }
        case "contacts": {
          currentBatch.push(importContact(value));
          break;
        }
        case "deals": {
          currentBatch.push(importDeal(value));
          break;
        }
        case "notes": {
          currentBatch.push(importNote(value));
          break;
        }
        case "tasks": {
          currentBatch.push(importTask(value));
          break;
        }
      }
      try {
        await proccesBatchIfPossible();
      } catch {
        // the state should have been set by the function that throw the error
        // stop the import
        await reader.cancel();
      }
    }

    setState((old) => {
      if (old.status === "error") {
        return old;
      }
      const duration = new Date().valueOf() - startedAt.valueOf();
      return {
        ...old,
        status: "success",
        duration,
      };
    });
    refresh();
  });

  return [state, importFile, reset];
};

const TYPES = [
  "sales",
  "companies",
  "contacts",
  "deals",
  "notes",
  "tasks",
] as const;
type Types = (typeof TYPES)[number];

const getType = (value: string | undefined): Types | undefined => {
  const type = value as Types;
  if (TYPES.includes(type)) return type;
  return undefined;
};

/** Accepts an array (JSON) or a comma-separated string (older exports). */
const parseStringArray = (
  value: string[] | string | null | undefined,
): string[] | undefined => {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return undefined;
};

type SaleImport = {
  id: number;
  email: string;
  name?: string;
  first_name: string;
  last_name: string;
};

const isSale = (data: any): data is SaleImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.id != null &&
  data.email != null &&
  data.first_name !== null &&
  data.last_name != null;

type CompanyImport = {
  id: number;
  name: string;
  sales_id?: number;
  /** hotel (default) or channel. */
  company_kind?: string;
  channel_type?: string;
  description?: string;
  city?: string;
  country?: string;
  address?: string;
  zipcode?: string;
  state_abbr?: string;
  sector?: string;
  size?: number;
  linkedin_url?: string;
  website?: string;
  phone_number?: string;
  revenue?: string;
  tax_identifier?: string;
  context_links?: string[];
  customer_category?: string;
  parent_company_id?: number;
  hotel_type?: string;
  rooms?: number;
  opening_year?: number;
  hotel_services?: string[] | string;
  average_room_rate?: number;
  created_at?: string;
  updated_at?: string;
};

const isCompany = (data: any): data is CompanyImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.id != null &&
  data.name != null;

type ContactImport = {
  id: number;
  sales_id: number;
  company_id?: number;
  /** Optional full display name (Chinese convention), preferred over first/last. */
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  background?: string;
  wechat_id?: string;
  contact_type?: string;
  birthday?: string;
  communication_style?: string;
  attitude?: string;
  tenure_years?: number;
  social_organization?: string;
  work_experience?: WorkExperience[];
  education?: Education[];
  avatar?: string;
  gender?: string;
  has_newsletter?: boolean;
  emails: Array<{ email: string; type: string }>;
  phones: Array<{ number: string; type: string }>;
  tags: Array<string>;
  created_at?: string;
  updated_at?: string;
};

const isContact = (data: any): data is ContactImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.id != null;

type DealImport = {
  id: number;
  name: string;
  company_id?: number;
  sales_id?: number;
  /** Sales owner email or display name; unmatched means the public pool. */
  sales?: string;
  stage?: string;
  status?: string;
  deal_type?: string;
  /** direct (default) or channel. */
  source_type?: string;
  /** Name of the channel company the deal came from. */
  channel?: string;
  description?: string;
  decision_process?: string;
  budget?: number;
  final_amount?: number;
  expected_closing_date?: string;
  /** Name of a competitor, resolved (or created) on import. */
  competitor?: string;
  index?: number;
  created_at?: string;
  updated_at?: string;
};

const isDeal = (data: any): data is DealImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.id != null &&
  data.name != null;

type NoteImport = {
  contact_id: number;
  sales_id: number;
  text: string;
  date: string;
  attachments: Array<{ url: string; name: string }>;
  created_at?: string;
  updated_at?: string;
};

const isNote = (data: any): data is NoteImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.sales_id != null &&
  data.contact_id != null &&
  data.text != null &&
  data.date != null;

type TaskImport = {
  contact_id: number;
  sales_id: number;
  text: string;
  due_date?: string;
  done_date?: string;
  created_at?: string;
  updated_at?: string;
};

const isTask = (data: any): data is TaskImport =>
  data != null &&
  typeof data === "object" &&
  !Array.isArray(data) &&
  data.sales_id != null &&
  data.contact_id != null &&
  data.text != null;
