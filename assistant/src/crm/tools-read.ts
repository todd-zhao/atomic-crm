import type { Context } from "@earendil-works/chord";
import { Type } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-durable";
import { queryAs } from "../db";
import { CrmSessionDoc } from "../docs";
import { contactName, READ_SQL } from "./sql";
import { getRecord, RECORD_RESOURCES } from "./records";

const txt = (text: string) => [{ type: "text" as const, text }];

async function userIdOf(api: any, context: Context): Promise<string> {
  const session = await api.snapshot(
    CrmSessionDoc,
    api.conversationId,
    context,
  );
  const userId: string | undefined = session?.userId;
  if (!userId) throw new Error("No CRM user bound to this conversation");
  return userId;
}

type ContactSearchRow = {
  id: number;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  status: string | null;
  attitude: string | null;
  contact_type: string | null;
  last_seen: string | null;
  company_name: string | null;
  tags: string[] | null;
  pending_tasks: number;
};

function formatContactLine(row: ContactSearchRow): string {
  const tags = (row.tags ?? []).join(",") || "-";
  const name = contactName(row);
  return `#${row.id} ${name}${row.title ? ` — ${row.title}` : ""}${
    row.company_name ? ` @ ${row.company_name}` : ""
  } [${row.attitude ?? "neutral"}] type:${row.contact_type ?? "customer"} tags:${tags} pending_tasks:${row.pending_tasks} last_seen:${
    row.last_seen ?? "never"
  }`;
}

export const searchContacts = defineTool({
  name: "crm_search_contacts",
  description:
    "Search CRM contacts by free text (name/company), attitude (排斥/冷淡/中立/友好/支持), tag or account manager. Returns id + name + company + attitude + contact type + tags + pending tasks, ordered by most recent activity. Use this first for questions about contacts/customers.",
  parameters: Type.Object({
    query: Type.Optional(
      Type.String({
        description: "Free text matched against contact and company name",
      }),
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
    tag: Type.Optional(Type.String({ description: "Tag name, partial match" })),
    ownerId: Type.Optional(
      Type.Number({ description: "Account manager (sales) id" }),
    ),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 25 })),
  }),
  execute: async (args, api, context) => {
    const userId = await userIdOf(api, context);
    const rows = await queryAs<ContactSearchRow>(
      userId,
      READ_SQL.searchContacts,
      [
        args.query ?? null,
        args.attitude ?? null,
        args.ownerId ?? null,
        args.tag ?? null,
        args.limit ?? 10,
      ],
      { readOnly: true },
    );
    return {
      output: txt(
        rows.length
          ? `Found ${rows.length} contact(s):\n${rows.map(formatContactLine).join("\n")}`
          : "No contacts matched.",
      ),
      details: { contacts: rows } as any,
    };
  },
});

export const getContact = defineTool({
  name: "crm_get_contact",
  description:
    "Fetch one contact by id: identity, company, emails/phones, tags, the 10 most recent notes, open and recent tasks, and related deals. Use after crm_search_contacts to prepare a briefing or a follow-up.",
  parameters: Type.Object({
    contactId: Type.Number({
      description: "Contact id from crm_search_contacts",
    }),
  }),
  execute: async (args, api, context) => {
    const userId = await userIdOf(api, context);
    const [contacts, notes, tasks, deals] = await Promise.all([
      queryAs<Record<string, unknown>>(
        userId,
        READ_SQL.getContact,
        [args.contactId],
        { readOnly: true },
      ),
      queryAs<Record<string, unknown>>(
        userId,
        READ_SQL.contactNotes,
        [args.contactId],
        { readOnly: true },
      ),
      queryAs<Record<string, unknown>>(
        userId,
        READ_SQL.contactTasks,
        [args.contactId],
        { readOnly: true },
      ),
      queryAs<Record<string, unknown>>(
        userId,
        READ_SQL.contactDeals,
        [args.contactId],
        { readOnly: true },
      ),
    ]);
    const contact = contacts[0];
    if (!contact) {
      return {
        isError: true,
        output: txt(
          `Contact #${args.contactId} not found or not visible to the user.`,
        ),
      };
    }
    const lines: string[] = [
      `Contact #${contact.id}: ${contactName(contact as any)}`,
      `Title: ${contact.title ?? "-"} | Company: ${contact.company_name ?? "-"}${contact.company_id ? ` (#${contact.company_id})` : ""}`,
      `Type: ${contact.contact_type ?? "customer"} | Attitude: ${contact.attitude ?? "neutral"} | DISC: ${contact.communication_style ?? "-"}`,
      `Birthday: ${contact.birthday ?? "-"} | Tenure: ${contact.tenure_years ?? "-"} years | Social org: ${contact.social_organization ?? "-"}`,
      `Tags: ${((contact.tags as string[]) ?? []).join(", ") || "-"}`,
      `Emails: ${JSON.stringify(contact.email_jsonb ?? [])}`,
      `Phones: ${JSON.stringify(contact.phone_jsonb ?? [])}`,
      `WeChat: ${contact.wechat_id ?? "-"} | Newsletter: ${contact.has_newsletter ? "yes" : "no"}`,
      `First seen: ${contact.first_seen ?? "-"} | Last seen: ${contact.last_seen ?? "-"}`,
    ];
    if (contact.company_name) {
      lines.push(
        `Company profile: sector ${contact.sector ?? "-"} | KARE ${contact.customer_category ?? "-"} | hotel type ${contact.hotel_type ?? "-"} | rooms ${contact.rooms ?? "-"} | opened ${contact.opening_year ?? "-"} | services ${JSON.stringify(contact.hotel_services ?? [])} | average room rate ${contact.average_room_rate ?? "-"}`,
      );
    }
    if (
      Array.isArray(contact.work_experience) &&
      contact.work_experience.length
    ) {
      lines.push("Work experience:");
      for (const item of contact.work_experience as any[]) {
        lines.push(
          `  - ${item.start_year ?? "?"}-${item.end_year ?? "?"} ${item.company ?? ""} ${item.title ?? ""}`.trimEnd(),
        );
      }
    }
    if (Array.isArray(contact.education) && contact.education.length) {
      lines.push("Education:");
      for (const item of contact.education as any[]) {
        lines.push(
          `  - ${item.start_year ?? "?"}-${item.end_year ?? "?"} ${item.school ?? ""} ${item.major ?? ""} ${item.degree ?? ""}`.trimEnd(),
        );
      }
    }
    if (notes.length) {
      lines.push("Recent notes:");
      for (const note of notes) {
        lines.push(
          `  - [${note.status ?? "-"}] ${note.date ?? ""}: ${String(note.text ?? "").slice(0, 240)}`,
        );
      }
    }
    if (tasks.length) {
      lines.push("Tasks:");
      for (const task of tasks) {
        lines.push(
          `  - #${task.id} [${task.type ?? "none"}] ${task.text ?? ""} due ${task.due_date ?? "-"}${
            task.done_date ? ` (done ${task.done_date})` : ""
          }`,
        );
      }
    }
    if (deals.length) {
      lines.push("Deals:");
      for (const deal of deals) {
        lines.push(
          `  - #${deal.id} ${deal.name ?? ""} [${deal.status}/${deal.stage}] type:${deal.deal_type ?? "-"} budget:${deal.budget ?? "-"} final:${deal.final_amount ?? "-"} role:${deal.role ?? "-"} influence:${deal.influence ?? "-"} pain:${deal.pain ?? "-"}`,
        );
      }
    }
    return {
      output: txt(lines.join("\n")),
      details: { contact, notes, tasks, deals } as any,
    };
  },
});

export const searchCompanies = defineTool({
  name: "crm_search_companies",
  description:
    "Search CRM companies by name or sector. Returns id, name, sector, size, location, number of contacts and deals.",
  parameters: Type.Object({
    query: Type.Optional(Type.String()),
    sector: Type.Optional(
      Type.String({ description: "Sector value, e.g. information-technology" }),
    ),
    companyKind: Type.Optional(
      Type.Union([Type.Literal("hotel"), Type.Literal("channel")], {
        description:
          "hotel = direct customer directory, channel = channel directory",
      }),
    ),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 25 })),
  }),
  execute: async (args, api, context) => {
    const userId = await userIdOf(api, context);
    const rows = await queryAs<Record<string, unknown>>(
      userId,
      READ_SQL.searchCompanies,
      [
        args.query ?? null,
        args.sector ?? null,
        args.companyKind ?? null,
        args.limit ?? 10,
      ],
      { readOnly: true },
    );
    const lines = rows.map((row) =>
      `#${row.id} ${row.name} [${row.company_kind ?? "hotel"}${row.channel_type ? "/" + row.channel_type : ""}] [${row.sector ?? "-"}] KARE:${row.customer_category ?? "-"} hotel:${row.hotel_type ?? "-"} rooms:${row.rooms ?? "-"} ${row.city ?? ""} ${
        row.country ?? ""
      } contacts:${row.nb_contacts} deals:${row.nb_deals}`.replace(/\s+/g, " "),
    );
    return {
      output: txt(
        rows.length
          ? `Found ${rows.length} companies:\n${lines.join("\n")}`
          : "No companies matched.",
      ),
      details: { companies: rows } as any,
    };
  },
});

export const getCompany = defineTool({
  name: "crm_get_company",
  description: "Fetch one company by id with its contacts and deals.",
  parameters: Type.Object({ companyId: Type.Number() }),
  execute: async (args, api, context) => {
    const userId = await userIdOf(api, context);
    const [companies, contacts, deals] = await Promise.all([
      queryAs<Record<string, unknown>>(
        userId,
        READ_SQL.getCompany,
        [args.companyId],
        { readOnly: true },
      ),
      queryAs<Record<string, unknown>>(
        userId,
        READ_SQL.companyContacts,
        [args.companyId],
        { readOnly: true },
      ),
      queryAs<Record<string, unknown>>(
        userId,
        READ_SQL.companyDeals,
        [args.companyId],
        { readOnly: true },
      ),
    ]);
    const company = companies[0];
    if (!company)
      return {
        isError: true,
        output: txt(`Company #${args.companyId} not found.`),
      };
    const lines = [
      `Company #${company.id}: ${company.name}`,
      `Sector: ${company.sector ?? "-"} | KARE: ${company.customer_category ?? "-"} | Parent: ${company.parent_company_name ?? "-"}`,
      `Hotel: type ${company.hotel_type ?? "-"} | rooms ${company.rooms ?? "-"} | opened ${company.opening_year ?? "-"} | services ${JSON.stringify(company.hotel_services ?? [])} | average room rate ${company.average_room_rate ?? "-"}`,
      `Website: ${company.website ?? "-"} | Phone: ${company.phone_number ?? "-"} | City: ${company.city ?? "-"} | Country: ${company.country ?? "-"}`,
      `Contacts: ${company.nb_contacts} | Deals: ${company.nb_deals}`,
      "Contacts:",
      ...contacts.map(
        (c) =>
          `  - #${c.id} ${contactName(c as any)} (${c.title ?? "-"}) [${c.contact_type ?? "-"}/${c.attitude ?? "-"}]`,
      ),
      "Deals:",
      ...deals.map(
        (d) =>
          `  - #${d.id} ${d.name ?? ""} [${d.status ?? "-"}/${d.stage ?? "-"}] type:${d.deal_type ?? "-"} budget:${d.budget ?? "-"} final:${d.final_amount ?? "-"}`,
      ),
    ];
    return {
      output: txt(lines.join("\n")),
      details: { company, contacts, deals } as any,
    };
  },
});

export const listDeals = defineTool({
  name: "crm_list_deals",
  description:
    "List deals (商机) with board status, Sandler stage, deal type, budget, final amount, competitor and company. Filter by status, stage, owner or minimum budget. Use status for board questions (potential/active/won/exited).",
  parameters: Type.Object({
    status: Type.Optional(
      Type.Union([
        Type.Literal("potential"),
        Type.Literal("active"),
        Type.Literal("won"),
        Type.Literal("exited"),
      ]),
    ),
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
    ownerId: Type.Optional(
      Type.Number({ description: "Sales owner (sales) id" }),
    ),
    sourceType: Type.Optional(
      Type.Union([Type.Literal("direct"), Type.Literal("channel")], {
        description: "direct = 直客, channel = 渠道",
      }),
    ),
    unassigned: Type.Optional(
      Type.Boolean({
        description: "true = only public-pool deals (no sales owner)",
      }),
    ),
    minBudget: Type.Optional(Type.Number()),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  }),
  execute: async (args, api, context) => {
    const userId = await userIdOf(api, context);
    const rows = await queryAs<Record<string, unknown>>(
      userId,
      READ_SQL.listDeals,
      [
        args.status ?? null,
        args.stage ?? null,
        args.ownerId ?? null,
        args.minBudget ?? null,
        args.sourceType ?? null,
        args.unassigned ?? null,
        args.limit ?? 20,
      ],
      { readOnly: true },
    );
    const lines = rows.map(
      (d) =>
        `#${d.id} ${d.name} @ ${d.company_name ?? "-"} [${d.status}/${d.stage}] type:${d.deal_type ?? "-"} source:${d.source_type ?? "direct"}${d.channel_name ? " via " + d.channel_name : ""} owner:${d.is_unassigned ? "PUBLIC_POOL" : (d.owner_name ?? "-")} budget:${d.budget ?? 0} final:${d.final_amount ?? "-"} competitor:${d.competitor_name ?? "-"} expected:${
          d.expected_closing_date ?? "-"
        }`,
    );
    return {
      output: txt(
        rows.length
          ? `Found ${rows.length} deal(s):\n${lines.join("\n")}`
          : "No deals matched.",
      ),
      details: { deals: rows } as any,
    };
  },
});

export const getDeal = defineTool({
  name: "crm_get_deal",
  description:
    "Fetch one deal (商机) by id with its stakeholders (role/attitude/influence/personal pain), pains, key milestones and meeting records. Use after crm_list_deals for a full opportunity briefing.",
  parameters: Type.Object({ dealId: Type.Number() }),
  execute: async (args, api, context) => {
    const userId = await userIdOf(api, context);
    const [deals, stakeholders, pains, milestones, meetings] =
      await Promise.all([
        queryAs<Record<string, unknown>>(
          userId,
          READ_SQL.getDeal,
          [args.dealId],
          {
            readOnly: true,
          },
        ),
        queryAs<Record<string, unknown>>(
          userId,
          READ_SQL.dealContacts,
          [args.dealId],
          { readOnly: true },
        ),
        queryAs<Record<string, unknown>>(
          userId,
          READ_SQL.dealPains,
          [args.dealId],
          {
            readOnly: true,
          },
        ),
        queryAs<Record<string, unknown>>(
          userId,
          READ_SQL.dealMilestones,
          [args.dealId],
          { readOnly: true },
        ),
        queryAs<Record<string, unknown>>(
          userId,
          READ_SQL.dealMeetings,
          [args.dealId],
          { readOnly: true },
        ),
      ]);
    const deal = deals[0];
    if (!deal) {
      return {
        isError: true,
        output: txt(`Deal #${args.dealId} not found.`),
      };
    }
    const lines = [
      `Deal #${deal.id}: ${deal.name}`,
      `Company: ${deal.company_name ?? "-"} | Status: ${deal.status ?? "-"} | Stage: ${deal.stage ?? "-"} | Type: ${deal.deal_type ?? "-"}`,
      `Source: ${deal.source_type ?? "direct"}${deal.channel_name ? " via " + deal.channel_name : ""} | Sales owner: ${deal.is_unassigned ? "PUBLIC POOL (unassigned)" : (deal.owner_name ?? "-")}`,
      `Budget: ${deal.budget ?? "-"} | Final amount: ${deal.final_amount ?? "-"} | Expected close: ${deal.expected_closing_date ?? "-"} | Competitor: ${deal.competitor_name ?? "-"}`,
      `Decision process: ${deal.decision_process ?? "-"}`,
      `Description: ${deal.description ?? "-"}`,
      "Stakeholders:",
      ...stakeholders.map(
        (s) =>
          `  - ${contactName(s as any)} (#${s.contact_id}) role:${s.role ?? "-"} attitude:${s.attitude ?? "-"} influence:${s.influence ?? "-"} pain:${s.pain ?? "-"}`,
      ),
      "Pains:",
      ...pains.map(
        (p) =>
          `  - symptom:${p.symptom ?? "-"} cause:${p.cause ?? "-"} duration:${p.duration ?? "-"} quantified loss:${p.quantified_loss ?? "-"}`,
      ),
      "Key milestones:",
      ...milestones.map((m) => `  - ${m.date ?? "-"} ${m.event ?? "-"}`),
      "Meetings:",
      ...meetings.map(
        (m) =>
          `  - ${m.meeting_date ?? "-"} customer:${JSON.stringify(m.customer_attendees ?? [])} ours:${JSON.stringify(m.our_attendees ?? [])} content:${String(m.content ?? "").slice(0, 160)} next:${m.next_steps ?? "-"}`,
      ),
    ];
    return {
      output: txt(lines.join("\n")),
      details: { deal, stakeholders, pains, milestones, meetings } as any,
    };
  },
});

export const listCompetitors = defineTool({
  name: "crm_list_competitors",
  description:
    "List known competitors (竞争对手) with brand influence, market price positioning, advantages and weaknesses. Use when the user asks about competitive situations.",
  parameters: Type.Object({
    query: Type.Optional(Type.String({ description: "Partial name match" })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  }),
  execute: async (args, api, context) => {
    const userId = await userIdOf(api, context);
    const rows = await queryAs<Record<string, unknown>>(
      userId,
      READ_SQL.listCompetitors,
      [args.query ?? null, args.limit ?? 20],
      { readOnly: true },
    );
    const lines = rows.map(
      (c) =>
        `#${c.id} ${c.name} brand:${c.brand_influence ?? "-"} price:${c.market_price ?? "-"} advantages:${c.advantages ?? "-"} weaknesses:${c.weaknesses ?? "-"}`,
    );
    return {
      output: txt(
        rows.length
          ? `Found ${rows.length} competitor(s):\n${lines.join("\n")}`
          : "No competitors matched.",
      ),
      details: { competitors: rows } as any,
    };
  },
});

export const listTasks = defineTool({
  name: "crm_list_tasks",
  description:
    "List tasks, optionally by contact, done state or due date. Useful for 'what should I follow up on' questions.",
  parameters: Type.Object({
    contactId: Type.Optional(Type.Number()),
    done: Type.Optional(
      Type.Boolean({
        description: "true = completed only, false = open only, omit = both",
      }),
    ),
    dueBefore: Type.Optional(
      Type.String({ description: "ISO date/time upper bound for due_date" }),
    ),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  }),
  execute: async (args, api, context) => {
    const userId = await userIdOf(api, context);
    const rows = await queryAs<Record<string, unknown>>(
      userId,
      READ_SQL.listTasks,
      [
        args.contactId ?? null,
        args.done ?? null,
        args.dueBefore ?? null,
        args.limit ?? 25,
      ],
      { readOnly: true },
    );
    const lines = rows.map(
      (t) =>
        `#${t.id} [${t.type ?? "none"}] ${t.text ?? ""} — contact #${t.contact_id} ${contactName(t as any)} due:${t.due_date ?? "-"}${t.done_date ? " DONE" : ""}`,
    );
    return {
      output: txt(
        rows.length
          ? `Found ${rows.length} task(s):\n${lines.join("\n")}`
          : "No tasks matched.",
      ),
      details: { tasks: rows } as any,
    };
  },
});

export const listActivity = defineTool({
  name: "crm_list_activity",
  description:
    "Recent CRM activity (created contacts/companies/deals, notes) optionally filtered by contact and since a date.",
  parameters: Type.Object({
    contactId: Type.Optional(Type.Number()),
    since: Type.Optional(
      Type.String({ description: "ISO date/time lower bound" }),
    ),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 30 })),
  }),
  execute: async (args, api, context) => {
    const userId = await userIdOf(api, context);
    const rows = await queryAs<Record<string, unknown>>(
      userId,
      READ_SQL.listActivity,
      [args.contactId ?? null, args.since ?? null, args.limit ?? 15],
      { readOnly: true },
    );
    const lines = rows.map(
      (a) =>
        `${a.date ?? ""} ${a.type ?? ""} — contact:${a.contact_name ?? "-"} company:${a.company_name ?? "-"} deal:${
          a.deal_name ?? "-"
        } note:${a.note_text ? String(a.note_text).slice(0, 120) : a.deal_note_text ? String(a.deal_note_text).slice(0, 120) : "-"}`,
    );
    return {
      output: txt(
        rows.length
          ? `Recent activity:\n${lines.join("\n")}`
          : "No activity found.",
      ),
      details: { activity: rows } as any,
    };
  },
});

export const teamMembers = defineTool({
  name: "crm_team_members",
  description:
    "List the CRM users (account managers) visible to the current user.",
  parameters: Type.Object({}),
  execute: async (args, api, context) => {
    const userId = await userIdOf(api, context);
    const rows = await queryAs<Record<string, unknown>>(
      userId,
      READ_SQL.teamMembers,
      [],
      { readOnly: true },
    );
    const lines = rows.map(
      (u) =>
        `#${u.id} ${contactName(u as any)} <${u.email ?? ""}>${u.administrator ? " (admin)" : ""}`,
    );
    return {
      output: txt(`Team members:\n${lines.join("\n")}`),
      details: { members: rows } as any,
    };
  },
});

export const getRecordTool = defineTool({
  name: "crm_get_record",
  description: `Read any CRM record by resource and id (full read access). Allowed resources: ${RECORD_RESOURCES.join(", ")}. Returns every column of that row.`,
  parameters: Type.Object({
    resource: Type.Union(
      RECORD_RESOURCES.map((resource) => Type.Literal(resource)),
    ),
    id: Type.Number(),
  }),
  execute: async (args, api, context) => {
    const userId = await userIdOf(api, context);
    const record = await getRecord(userId, args.resource, args.id);
    if (!record) {
      return {
        isError: true,
        output: txt(`${args.resource} #${args.id} not found.`),
      };
    }
    return {
      output: txt(
        `${args.resource} #${args.id}:\n${JSON.stringify(record, null, 2).slice(0, 4000)}`,
      ),
      details: { record } as any,
    };
  },
});
export const READ_TOOLS = [
  searchContacts,
  getContact,
  searchCompanies,
  getCompany,
  listDeals,
  getDeal,
  listCompetitors,
  getRecordTool,
  listTasks,
  listActivity,
  teamMembers,
];
