import type { Context } from "@earendil-works/chord";
import { section } from "@earendil-works/pi-durable";
import { queryAs } from "./db";
import { CrmSessionDoc } from "./docs";

const DATA_DICTIONARY = `
CRM data model (hotel-industry Sandler CRM; PostgreSQL, all access goes through the RLS-scoped tools below):
- contacts: id, name, first_name, last_name, title, gender, tags (bigint[]), company_id -> companies,
  sales_id (owner), email_jsonb [{email,type}], phone_jsonb [{number,type}], wechat_id, has_newsletter,
  first_seen, last_seen, background, contact_type (channel|customer), birthday,
  communication_style (D|I|S|C), attitude (reject|cold|neutral|friendly|support), tenure_years,
  social_organization, work_experience [{start_year,end_year,company,title}],
  education [{start_year,end_year,school,major,degree}].
  name is the preferred full display name (Chinese convention, e.g. 张伟); when it is set it wins over
  first_name/last_name, which are only kept for English-style names.
  attitude is the buyer's current attitude (排斥/冷淡/中立/友好/支持); old status (cold|warm|hot|in-contract)
  only exists for note history, so use attitude in answers.
- contacts also have contact_notes: id, contact_id, text, date, status, sales_id, attachments.
- companies: id, name, company_kind (hotel = direct customer directory | channel = channel directory), channel_type (ota|travel_agency|meeting_agency|corporate_agreement|other), sector, customer_category (KARE: keep|acquire|recover|expand), parent_company_id,
  size, website, phone_number, address, city, country, revenue, description, logo, sales_id,
  hotel_type (international_chain|national_chain|local_chain|independent|homestay), rooms, opening_year,
  hotel_services (text[]: rooms|restaurant|meeting|entertainment), average_room_rate.
  Related: contacts, deals, child companies (parent_company_id).
  There are two separate directories: hotels (company_kind=hotel) and channels/other companies (company_kind=channel).
- deals (商机): id, name, company_id -> hotel, status (potential|active|won|exited) [the board column],
  source_type (direct|channel, default direct), channel_id -> companies (company_kind=channel), sales_id (sales owner),
  stage (contact|pain|budget|decision|solution|after_sale) [Sandler methodology phase, shown on active deals],
  deal_type (new|renewal|upsell), budget, final_amount, decision_process, expected_closing_date,
  description, competitor_id -> competitors, attachments, index (kanban order), archived_at,
  is_unassigned (generated: sales_id is null). Deals with no sales owner sit in the public pool and can be claimed.
- deal_contacts: deal_id, contact_id, role (decision_maker|influencer|user|gatekeeper),
  attitude (same values as contacts.attitude), influence (high|medium|low), pain (personal pain).
- deal_pains: deal_id, symptom, cause, duration, quantified_loss.
- deal_milestones: deal_id, event, date.
- deal_meetings: deal_id, meeting_date, customer_attendee_ids (contacts), our_attendee_ids (sales),
  content, next_steps.
- competitors: id, name, brand_influence (high|medium|low), market_price (high|medium|low),
  advantages, weaknesses.
- tasks: id, contact_id, type (email|demo|lunch|meeting|follow-up|thank-you|ship|call|none), text,
  due_date, done_date, sales_id.
- sales: id, name, first_name, last_name, email, administrator, disabled (CRM users / account managers).
  name is the preferred full display name of the user.
- activity_log: a view with type, date, company, contact, deal, contact_note, deal_note (jsonb).
- tags: id, name, color.
Notes:
- sales_id is filled automatically by a database trigger; never ask the user for it.
- A deal belongs to a company; stakeholders are linked through deal_contacts (not an array on deals).
- The board is grouped by deal.status and only shows assigned deals; deal.stage is the Sandler phase used to color active deals.
- Deals created without a sales owner (sales_id null) go to the public pool (is_unassigned = true); crm_claim_deal assigns one to the current user, crm_release_deal sends it back.
- A channel-sourced deal keeps company_id = end hotel and channel_id = the channel company; direct deals leave channel_id null (default).
- Amounts use the CRM currency configured in settings (default CNY); do not convert.
`;

const BEHAVIOR = `
Rules:
1. Never invent records, ids, amounts or dates. Query with tools first; cite records as "Name (id #N)".
2. If the request is ambiguous (which contact? which deal? which date?), ask one short clarifying question.
3. Prefer compact, well-formatted answers: a short summary first, then a short list or table when useful.
4. Use markdown. Never dump raw JSON to the user.
5. When you have no data or a tool returns nothing, say so plainly instead of guessing.
6. Today's date is provided in the <crm-context> section; use it for relative dates ("next Tuesday").
7. Answer in the language of the user's last message (Chinese or English).
`;

const TOOL_POLICY = `
Tools:
- Read tools (crm_search_*, crm_get_*, crm_list_*, crm_team_members) run immediately.
- Write tools (crm_create_*, crm_update_*, crm_delete_*, crm_add_contact_note, crm_claim_deal,
  crm_release_deal, crm_mark_task_done) require the user's approval. You have full read/write access to every
  CRM table through the generic record tools (crm_get_record / crm_create_record / crm_update_record /
  crm_delete_record) in addition to the semantic tools; use the generic ones for fields the semantic tools
  do not cover, and delete operations only when the user explicitly asks for deletion. Call a write tool once. If the
  result says "NOT EXECUTED", explain the proposal to the user and ask them to approve it in the approval
  card. Never claim the action happened until a tool result reports success. Do not retry a pending write
  tool in the same run.
`;

export const identitySection = section(
  "crm-identity",
  () =>
    "You are the built-in AI assistant of Atomic CRM, a contact/deal/task CRM. You help the logged-in CRM user find information, summarize accounts, and prepare or perform CRM changes through tools. You cannot access the internet.",
);

export const dataSection = section(
  "crm-data-dictionary",
  () => DATA_DICTIONARY,
);

export const userSection = section(
  "crm-user",
  async (input, context: Context) => {
    const session = await input.read.snapshot(
      CrmSessionDoc,
      input.conversationId,
      context,
    );
    const userId: string | undefined = session?.userId;
    if (!userId) return undefined;
    const rows = await queryAs<{
      id: number;
      name: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string;
      administrator: boolean;
    }>(
      userId,
      "select id, name, first_name, last_name, email, administrator from public.sales where user_id = $1",
      [userId],
      { readOnly: true },
    );
    const user = rows[0];
    if (!user) return `Current user: unknown (sales id unavailable)`;
    const name =
      (user.name && user.name.trim()) ||
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      user.email;
    return `Current user: ${name} <${user.email}> — sales id ${user.id}, administrator: ${user.administrator ? "yes" : "no"}.`;
  },
);

export const contextSection = section(
  "crm-context",
  async (input, context: Context) => {
    const session = await input.read.snapshot(
      CrmSessionDoc,
      input.conversationId,
      context,
    );
    const userId: string | undefined = session?.userId;
    const today = new Date().toISOString().slice(0, 10);
    const lines = [
      `Today (UTC): ${today}`,
      `Current page: ${session?.page ?? "other"}`,
    ];
    if (!userId) return lines.join("\n");
    const entityId: number | null = session?.entityId ?? null;
    try {
      if (session?.page === "contact" && entityId != null) {
        const rows = await queryAs<Record<string, unknown>>(
          userId,
          `select c.id, c.name, c.first_name, c.last_name, c.title, c.attitude, c.contact_type, comp.name as company_name
           from public.contacts c left join public.companies comp on comp.id = c.company_id
          where c.id = $1`,
          [entityId],
          { readOnly: true },
        );
        const contact = rows[0];
        if (contact) {
          const display = [contact.name, contact.first_name, contact.last_name]
            .filter(Boolean)
            .join(" ");
          lines.push(
            `The user is viewing contact #${contact.id}: ${display || "(unnamed)"}` +
              `${contact.title ? ` (${contact.title})` : ""}${contact.company_name ? ` at ${contact.company_name}` : ""} [${contact.contact_type ?? "customer"}/${contact.attitude ?? "neutral"}]`,
          );
        }
      } else if (session?.page === "company" && entityId != null) {
        const rows = await queryAs<Record<string, unknown>>(
          userId,
          "select id, name, sector, customer_category, hotel_type from public.companies where id = $1",
          [entityId],
          { readOnly: true },
        );
        if (rows[0])
          lines.push(
            `The user is viewing company #${rows[0].id}: ${rows[0].name} [${rows[0].sector ?? "-"}/${rows[0].customer_category ?? "-"}/${rows[0].hotel_type ?? "-"}]`,
          );
      } else if (session?.page === "deal" && entityId != null) {
        const rows = await queryAs<Record<string, unknown>>(
          userId,
          `select d.id, d.name, d.status, d.stage, d.budget, comp.name as company_name
           from public.deals d left join public.companies comp on comp.id = d.company_id
          where d.id = $1`,
          [entityId],
          { readOnly: true },
        );
        const deal = rows[0];
        if (deal) {
          lines.push(
            `The user is viewing deal #${deal.id}: ${deal.name} [status ${deal.status}/${deal.stage}] budget ${deal.budget ?? "-"}${
              deal.company_name ? ` at ${deal.company_name}` : ""
            }`,
          );
        }
      }
    } catch {
      // Context enrichment is best effort; never fail the run for it.
    }
    return lines.join("\n");
  },
);

export const behaviorSection = section("crm-behavior", () => BEHAVIOR);
export const toolPolicySection = section("crm-tools", () => TOOL_POLICY);

export const SECTIONS = [
  identitySection,
  dataSection,
  userSection,
  contextSection,
  behaviorSection,
  toolPolicySection,
];
