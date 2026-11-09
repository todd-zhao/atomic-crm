import { Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-durable";
import { queryAs } from "../db";
import { withApproval } from "./approval";
import {
  createRecord,
  currentSalesId,
  deleteRecord,
  getRecord,
  RECORD_RESOURCES,
  updateRecord,
} from "./records";
import {
  companyDisplayName,
  contactDisplayName,
  dealDisplayName,
  taskDisplayName,
  WRITE_SQL,
} from "./sql";

const txt = (text: string) => [{ type: "text" as const, text }];

const dateOrNull = (value: string | undefined): string | null =>
  value ? value : null;

type WriteResult = { id: number; [key: string]: unknown };

export const createContact = defineTool({
  name: "crm_create_contact",
  description:
    'Create a CRM contact. Prefer a single full display name via `name` (e.g. a Chinese name such as "张伟"); `firstName`/`lastName` are only needed for English-style names. Requires the user\'s approval before it is executed: call it once, then explain what you propose. Never call it again while it is pending approval.',
  parameters: Type.Object({
    name: Type.Optional(
      Type.String({
        description:
          "Full display name, preferred for Chinese contacts (e.g. 张伟).",
      }),
    ),
    firstName: Type.Optional(Type.String()),
    lastName: Type.Optional(Type.String()),
    companyId: Type.Optional(Type.Number()),
    title: Type.Optional(Type.String()),
    email: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    wechatId: Type.Optional(Type.String({ description: "WeChat ID (微信号)" })),
    contactType: Type.Optional(
      Type.Union([Type.Literal("channel"), Type.Literal("customer")]),
    ),
    attitude: Type.Optional(
      Type.Union([
        Type.Literal("reject"),
        Type.Literal("cold"),
        Type.Literal("neutral"),
        Type.Literal("friendly"),
        Type.Literal("support"),
      ]),
    ),
  }),
  execute: async (args, api, context) => {
    const displayName =
      args.name?.trim() ||
      [args.firstName, args.lastName].filter(Boolean).join(" ");
    if (!displayName) {
      throw new Error(
        "A full name (name) or both firstName and lastName are required.",
      );
    }
    const summary = async (userId: string) => {
      const company = args.companyId
        ? ` at ${await companyDisplayName(userId, args.companyId)}`
        : "";
      return `Create a contact: ${displayName}${company}${args.email ? ` <${args.email}>` : ""}`;
    };
    const outcome = await withApproval(
      api,
      context,
      "crm_create_contact",
      args,
      summary,
      async (userId) => {
        const emailDomain = args.email?.split("@")[1];
        const avatar = emailDomain
          ? { src: `https://favicon.show/${emailDomain}` }
          : null;
        const [row] = await queryAs<WriteResult>(
          userId,
          WRITE_SQL.createContact,
          [
            args.name?.trim() || null,
            args.firstName ?? null,
            args.lastName ?? null,
            args.title ?? null,
            args.companyId ?? null,
            args.email
              ? JSON.stringify([{ email: args.email, type: "Work" }])
              : null,
            args.phone
              ? JSON.stringify([{ number: args.phone, type: "Work" }])
              : null,
            args.attitude ?? "neutral",
            args.contactType ?? "customer",
            args.wechatId ?? null,
            avatar ? JSON.stringify(avatar) : null,
          ],
        );
        return {
          text: `Contact created: #${row.id} ${displayName}.`,
          details: { contactId: row.id },
        };
      },
    );
    return outcome.result as any;
  },
});

export const createTask = defineTool({
  name: "crm_create_task",
  description:
    "Create a follow-up task for a contact. Requires the user's approval before it is executed; call it once and then explain the proposal.",
  parameters: Type.Object({
    contactId: Type.Number(),
    text: Type.String(),
    type: Type.Optional(
      Type.Union([
        Type.Literal("none"),
        Type.Literal("email"),
        Type.Literal("demo"),
        Type.Literal("lunch"),
        Type.Literal("meeting"),
        Type.Literal("follow-up"),
        Type.Literal("thank-you"),
        Type.Literal("ship"),
        Type.Literal("call"),
      ]),
    ),
    dueDate: Type.Optional(
      Type.String({
        description: "ISO date/time, e.g. 2026-11-05 or 2026-11-05T09:00:00Z",
      }),
    ),
  }),
  execute: async (args, api, context) => {
    const summary = async (userId: string) => {
      const name = await contactDisplayName(userId, args.contactId);
      return `Create a ${args.type ?? "follow-up"} task for ${name}: "${args.text}"${
        args.dueDate ? ` (due ${args.dueDate})` : ""
      }`;
    };
    const outcome = await withApproval(
      api,
      context,
      "crm_create_task",
      args,
      summary,
      async (userId) => {
        const [row] = await queryAs<WriteResult>(userId, WRITE_SQL.createTask, [
          args.contactId,
          args.type ?? "follow-up",
          args.text,
          dateOrNull(args.dueDate),
        ]);
        return {
          text: `Task created: #${row.id} "${args.text}".`,
          details: { taskId: row.id },
        };
      },
    );
    return outcome.result as any;
  },
});

export const addContactNote = defineTool({
  name: "crm_add_contact_note",
  description:
    "Add a note to a contact (meeting summary, call outcome, ...). Requires the user's approval before it is executed.",
  parameters: Type.Object({
    contactId: Type.Number(),
    text: Type.String(),
    status: Type.Optional(
      Type.Union([
        Type.Literal("cold"),
        Type.Literal("warm"),
        Type.Literal("hot"),
        Type.Literal("in-contract"),
      ]),
    ),
  }),
  execute: async (args, api, context) => {
    const summary = async (userId: string) => {
      const name = await contactDisplayName(userId, args.contactId);
      return `Add a note to ${name}: "${args.text.slice(0, 160)}${args.text.length > 160 ? "…" : ""}"`;
    };
    const outcome = await withApproval(
      api,
      context,
      "crm_add_contact_note",
      args,
      summary,
      async (userId) => {
        const [row] = await queryAs<WriteResult>(
          userId,
          WRITE_SQL.addContactNote,
          [args.contactId, args.text, args.status ?? "cold"],
        );
        return {
          text: `Note added to contact #${args.contactId} (note #${row.id}).`,
          details: { noteId: row.id },
        };
      },
    );
    return outcome.result as any;
  },
});

export const createDeal = defineTool({
  name: "crm_create_deal",
  description:
    "Create a deal (商机) for a company. Status drives the board (potential/active/won/exited); the Sandler methodology stage is one of contact/pain/budget/decision/solution/after_sale. Requires the user's approval before it is executed.",
  parameters: Type.Object({
    name: Type.String({ description: "商机名称, e.g. XX酒店XX项目" }),
    companyId: Type.Number({
      description: "Hotel company id (company_kind=hotel)",
    }),
    channelId: Type.Optional(
      Type.Number({ description: "Channel company id (company_kind=channel)" }),
    ),
    sourceType: Type.Optional(
      Type.Union([Type.Literal("direct"), Type.Literal("channel")], {
        description: "直客 (default) or 渠道",
      }),
    ),
    salesOwnerId: Type.Optional(
      Type.Number({
        description:
          "Sales owner (sales id); omit/null to send the deal to the public pool",
      }),
    ),
    budget: Type.Optional(Type.Number()),
    stage: Type.Optional(
      Type.Union([
        Type.Literal("contact"),
        Type.Literal("pain"),
        Type.Literal("budget"),
        Type.Literal("decision"),
        Type.Literal("solution"),
        Type.Literal("after_sale"),
      ]),
    ),
    status: Type.Optional(
      Type.Union([
        Type.Literal("potential"),
        Type.Literal("active"),
        Type.Literal("won"),
        Type.Literal("exited"),
      ]),
    ),
    dealType: Type.Optional(
      Type.Union([
        Type.Literal("new"),
        Type.Literal("renewal"),
        Type.Literal("upsell"),
      ]),
    ),
    competitorId: Type.Optional(
      Type.Number({ description: "Competitor id from crm_list_competitors" }),
    ),
    expectedClosingDate: Type.Optional(
      Type.String({ description: "YYYY-MM-DD" }),
    ),
    description: Type.Optional(Type.String()),
  }),
  execute: async (args, api, context) => {
    const summary = async (userId: string) => {
      const company = await companyDisplayName(userId, args.companyId);
      return `Create deal "${args.name}" for ${company}${
        args.budget ? ` with budget ${args.budget}` : ""
      }${args.stage ? ` (stage ${args.stage})` : ""}${
        args.status ? ` [${args.status}]` : ""
      }`;
    };
    const outcome = await withApproval(
      api,
      context,
      "crm_create_deal",
      args,
      summary,
      async (userId) => {
        const [row] = await queryAs<WriteResult>(userId, WRITE_SQL.createDeal, [
          args.name,
          args.companyId,
          args.budget ?? null,
          args.stage ?? "contact",
          args.status ?? "potential",
          args.dealType ?? null,
          dateOrNull(args.expectedClosingDate),
          args.description ?? null,
          args.competitorId ?? null,
          args.sourceType ?? "direct",
          args.channelId ?? null,
          args.salesOwnerId ?? null,
        ]);
        return {
          text: `Deal created: #${row.id} "${args.name}".`,
          details: { dealId: row.id },
        };
      },
    );
    return outcome.result as any;
  },
});

export const updateDealStage = defineTool({
  name: "crm_update_deal_stage",
  description:
    "Move a deal to another Sandler methodology stage (contact/pain/budget/decision/solution/after_sale). Requires the user's approval before it is executed.",
  parameters: Type.Object({
    dealId: Type.Number(),
    stage: Type.Union([
      Type.Literal("contact"),
      Type.Literal("pain"),
      Type.Literal("budget"),
      Type.Literal("decision"),
      Type.Literal("solution"),
      Type.Literal("after_sale"),
    ]),
  }),
  execute: async (args, api, context) => {
    const summary = async (userId: string) => {
      const name = await dealDisplayName(userId, args.dealId);
      return `Move deal "${name}" to stage "${args.stage}"`;
    };
    const outcome = await withApproval(
      api,
      context,
      "crm_update_deal_stage",
      args,
      summary,
      async (userId) => {
        const [row] = await queryAs<WriteResult>(
          userId,
          WRITE_SQL.updateDealStage,
          [args.dealId, args.stage],
        );
        return {
          text: `Deal #${row.id} "${row.name}" is now in stage "${row.stage}".`,
          details: { dealId: row.id },
        };
      },
    );
    return outcome.result as any;
  },
});

export const markTaskDone = defineTool({
  name: "crm_mark_task_done",
  description:
    "Mark a task as done. Requires the user's approval before it is executed.",
  parameters: Type.Object({ taskId: Type.Number() }),
  execute: async (args, api, context) => {
    const summary = async (userId: string) =>
      `Mark task "${await taskDisplayName(userId, args.taskId)}" as done`;
    const outcome = await withApproval(
      api,
      context,
      "crm_mark_task_done",
      args,
      summary,
      async (userId) => {
        const [row] = await queryAs<WriteResult>(
          userId,
          WRITE_SQL.markTaskDone,
          [args.taskId],
        );
        return {
          text: `Task #${row.id} marked as done.`,
          details: { taskId: row.id },
        };
      },
    );
    return outcome.result as any;
  },
});

export const updateDealStatus = defineTool({
  name: "crm_update_deal_status",
  description:
    "Move a deal to another board status (potential/active/won/exited). Marking it won also fills final_amount with budget when empty. Requires the user's approval before it is executed.",
  parameters: Type.Object({
    dealId: Type.Number(),
    status: Type.Union([
      Type.Literal("potential"),
      Type.Literal("active"),
      Type.Literal("won"),
      Type.Literal("exited"),
    ]),
  }),
  execute: async (args, api, context) => {
    const summary = async (userId: string) => {
      const name = await dealDisplayName(userId, args.dealId);
      return `Move deal "${name}" to status "${args.status}"`;
    };
    const outcome = await withApproval(
      api,
      context,
      "crm_update_deal_status",
      args,
      summary,
      async (userId) => {
        const [row] = await queryAs<WriteResult>(
          userId,
          WRITE_SQL.updateDealStatus,
          [args.dealId, args.status],
        );
        return {
          text: `Deal #${row.id} "${row.name}" is now ${row.status}.`,
          details: { dealId: row.id },
        };
      },
    );
    return outcome.result as any;
  },
});

export const createCompetitor = defineTool({
  name: "crm_create_competitor",
  description:
    "Record a competitor (竞争对手) with brand influence, market price positioning, advantages and weaknesses. Requires the user's approval before it is executed.",
  parameters: Type.Object({
    name: Type.String(),
    brandInfluence: Type.Optional(
      Type.Union([
        Type.Literal("high"),
        Type.Literal("medium"),
        Type.Literal("low"),
      ]),
    ),
    marketPrice: Type.Optional(
      Type.Union([
        Type.Literal("high"),
        Type.Literal("medium"),
        Type.Literal("low"),
      ]),
    ),
    advantages: Type.Optional(Type.String()),
    weaknesses: Type.Optional(Type.String()),
  }),
  execute: async (args, api, context) => {
    const outcome = await withApproval(
      api,
      context,
      "crm_create_competitor",
      args,
      async () => `Create competitor "${args.name}"`,
      async (userId) => {
        const [row] = await queryAs<WriteResult>(
          userId,
          WRITE_SQL.createCompetitor,
          [
            args.name,
            args.brandInfluence ?? "medium",
            args.marketPrice ?? "medium",
            args.advantages ?? null,
            args.weaknesses ?? null,
          ],
        );
        return {
          text: `Competitor created: #${row.id} "${args.name}".`,
          details: { competitorId: row.id },
        };
      },
    );
    return outcome.result as any;
  },
});

const recordResource = Type.Union(
  RECORD_RESOURCES.map((resource) => Type.Literal(resource)),
);

export const createRecordTool = defineTool({
  name: "crm_create_record",
  description: `Create a CRM record in a given resource (full write access). Allowed resources: ${RECORD_RESOURCES.join(", ")}. Pass data as an object of column -> value (JSON objects/arrays allowed for jsonb/array columns). Ids, timestamps and generated columns are not writable. Requires the user's approval.`,
  parameters: Type.Object({
    resource: recordResource,
    data: Type.Record(Type.String(), Type.Unknown()),
  }),
  execute: async (args, api, context) => {
    const outcome = await withApproval(
      api,
      context,
      "crm_create_record",
      args,
      async () =>
        `Create ${args.resource}: ${JSON.stringify(args.data).slice(0, 400)}`,
      async (userId) => {
        const row = await createRecord(userId, args.resource, args.data as any);
        return {
          text: `Created ${args.resource} #${row.id}.`,
          details: { resource: args.resource, recordId: row.id },
        };
      },
    );
    return outcome.result as any;
  },
});

export const updateRecordTool = defineTool({
  name: "crm_update_record",
  description: `Update any CRM record (full write access). Allowed resources: ${RECORD_RESOURCES.join(", ")}. Pass only the columns to change; null clears a column. Requires the user's approval.`,
  parameters: Type.Object({
    resource: recordResource,
    id: Type.Number(),
    data: Type.Record(Type.String(), Type.Unknown()),
  }),
  execute: async (args, api, context) => {
    const outcome = await withApproval(
      api,
      context,
      "crm_update_record",
      args,
      async () =>
        `Update ${args.resource} #${args.id}: ${JSON.stringify(args.data).slice(0, 400)}`,
      async (userId) => {
        const row = await updateRecord(
          userId,
          args.resource,
          args.id,
          args.data as any,
        );
        return {
          text: `Updated ${args.resource} #${row.id}.`,
          details: { resource: args.resource, recordId: row.id },
        };
      },
    );
    return outcome.result as any;
  },
});

export const deleteRecordTool = defineTool({
  name: "crm_delete_record",
  description: `Delete any CRM record (full write access). Allowed resources: ${RECORD_RESOURCES.join(", ")}. Deleting a parent record cascades to its child rows (e.g. a deal removes its stakeholders/pains/meetings). Requires the user's approval.`,
  parameters: Type.Object({
    resource: recordResource,
    id: Type.Number(),
  }),
  execute: async (args, api, context) => {
    const outcome = await withApproval(
      api,
      context,
      "crm_delete_record",
      args,
      async (userId) => {
        const record = await getRecord(userId, args.resource, args.id).catch(
          () => undefined,
        );
        const label =
          record && typeof record.name === "string"
            ? ` "${record.name}"`
            : record && typeof record.text === "string"
              ? ` "${String(record.text).slice(0, 80)}"`
              : "";
        return `Delete ${args.resource} #${args.id}${label}`;
      },
      async (userId) => {
        await deleteRecord(userId, args.resource, args.id);
        return {
          text: `Deleted ${args.resource} #${args.id}.`,
          details: { resource: args.resource, recordId: args.id },
        };
      },
    );
    return outcome.result as any;
  },
});

export const claimDeal = defineTool({
  name: "crm_claim_deal",
  description:
    "Claim an unassigned deal from the public pool for the current user (sets the sales owner to the logged-in CRM user). Requires the user's approval.",
  parameters: Type.Object({ dealId: Type.Number() }),
  execute: async (args, api, context) => {
    const outcome = await withApproval(
      api,
      context,
      "crm_claim_deal",
      args,
      async (userId) => {
        const name = await dealDisplayName(userId, args.dealId);
        return `Claim deal "${name}" from the public pool`;
      },
      async (userId) => {
        const salesId = await currentSalesId(userId);
        if (salesId == null)
          throw new Error("Current user has no sales profile.");
        const row = await updateRecord(userId, "deals", args.dealId, {
          sales_id: salesId,
        });
        return {
          text: `Deal #${row.id} claimed by the current user (sales #${salesId}).`,
          details: { dealId: row.id, salesId },
        };
      },
    );
    return outcome.result as any;
  },
});

export const releaseDeal = defineTool({
  name: "crm_release_deal",
  description:
    "Release a deal back to the public pool by clearing its sales owner (sales_id = null). Requires the user's approval.",
  parameters: Type.Object({ dealId: Type.Number() }),
  execute: async (args, api, context) => {
    const outcome = await withApproval(
      api,
      context,
      "crm_release_deal",
      args,
      async (userId) => {
        const name = await dealDisplayName(userId, args.dealId);
        return `Release deal "${name}" to the public pool`;
      },
      async (userId) => {
        const row = await updateRecord(userId, "deals", args.dealId, {
          sales_id: null,
        });
        return {
          text: `Deal #${row.id} released to the public pool.`,
          details: { dealId: row.id },
        };
      },
    );
    return outcome.result as any;
  },
});
export const WRITE_TOOLS = [
  createContact,
  createTask,
  addContactNote,
  createDeal,
  updateDealStage,
  updateDealStatus,
  createCompetitor,
  createRecordTool,
  updateRecordTool,
  deleteRecordTool,
  claimDeal,
  releaseDeal,
  markTaskDone,
];

void txt;
