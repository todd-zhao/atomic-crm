import { queryAs } from "../db";

/**
 * Generic record CRUD for the assistant.
 *
 * The model can read and write every CRM table, but only through this
 * whitelist: table names and column names are fixed here, values are always
 * parameterized, and generated columns are never writable. Every write tool is
 * still gated by the approval flow.
 */

type ColumnKind = "value" | "jsonb" | "array" | "jsonbArray";

type ResourceSchema = {
  table: string;
  columns: Record<string, ColumnKind>;
  /** Columns added automatically on insert when missing. */
  defaults?: Record<string, string>;
  /** Adds updated_at = now() on update. */
  touchUpdatedAt?: boolean;
};

export const RECORD_SCHEMAS: Record<string, ResourceSchema> = {
  contacts: {
    table: "public.contacts",
    columns: {
      name: "value",
      first_name: "value",
      last_name: "value",
      title: "value",
      company_id: "value",
      referrer_contact_id: "value",
      email_jsonb: "jsonb",
      phone_jsonb: "jsonb",
      tags: "array",
      gender: "value",
      sales_id: "value",
      status: "value",
      background: "value",
      wechat_id: "value",
      contact_type: "value",
      birthday: "value",
      communication_style: "value",
      attitude: "value",
      tenure_years: "value",
      social_organization: "value",
      work_experience: "jsonb",
      education: "jsonb",
      has_newsletter: "value",
      avatar: "jsonb",
      first_seen: "value",
      last_seen: "value",
    },
  },
  companies: {
    table: "public.companies",
    columns: {
      name: "value",
      company_kind: "value",
      channel_type: "value",
      sector: "value",
      customer_category: "value",
      parent_company_id: "value",
      size: "value",
      linkedin_url: "value",
      website: "value",
      phone_number: "value",
      address: "value",
      zipcode: "value",
      city: "value",
      state_abbr: "value",
      sales_id: "value",
      context_links: "jsonb",
      country: "value",
      description: "value",
      revenue: "value",
      tax_identifier: "value",
      logo: "jsonb",
      hotel_type: "value",
      rooms: "value",
      opening_year: "value",
      hotel_services: "array",
      average_room_rate: "value",
    },
  },
  deals: {
    table: "public.deals",
    columns: {
      name: "value",
      company_id: "value",
      stage: "value",
      status: "value",
      deal_type: "value",
      source_type: "value",
      channel_id: "value",
      description: "value",
      decision_process: "value",
      budget: "value",
      final_amount: "value",
      expected_closing_date: "value",
      sales_id: "value",
      competitor_id: "value",
      attachments: "jsonbArray",
      index: "value",
      archived_at: "value",
    },
    touchUpdatedAt: true,
  },
  tasks: {
    table: "public.tasks",
    columns: {
      contact_id: "value",
      type: "value",
      text: "value",
      due_date: "value",
      done_date: "value",
      sales_id: "value",
    },
  },
  contact_notes: {
    table: "public.contact_notes",
    columns: {
      contact_id: "value",
      text: "value",
      date: "value",
      sales_id: "value",
      status: "value",
      attachments: "jsonbArray",
    },
  },
  deal_notes: {
    table: "public.deal_notes",
    columns: {
      deal_id: "value",
      type: "value",
      text: "value",
      date: "value",
      sales_id: "value",
      attachments: "jsonbArray",
    },
  },
  competitors: {
    table: "public.competitors",
    columns: {
      name: "value",
      brand_influence: "value",
      market_price: "value",
      advantages: "value",
      weaknesses: "value",
      sales_id: "value",
    },
  },
  deal_contacts: {
    table: "public.deal_contacts",
    columns: {
      deal_id: "value",
      contact_id: "value",
      role: "value",
      attitude: "value",
      influence: "value",
      pain: "value",
      index: "value",
    },
  },
  deal_pains: {
    table: "public.deal_pains",
    columns: {
      deal_id: "value",
      symptom: "value",
      cause: "value",
      duration: "value",
      quantified_loss: "value",
      index: "value",
    },
  },
  deal_milestones: {
    table: "public.deal_milestones",
    columns: {
      deal_id: "value",
      event: "value",
      date: "value",
      index: "value",
    },
  },
  deal_meetings: {
    table: "public.deal_meetings",
    columns: {
      deal_id: "value",
      meeting_date: "value",
      customer_attendee_ids: "array",
      our_attendee_ids: "array",
      content: "value",
      next_steps: "value",
      sales_id: "value",
    },
  },
};

export const RECORD_RESOURCES = Object.keys(RECORD_SCHEMAS);

export function recordSchema(resource: string): ResourceSchema {
  const schema = RECORD_SCHEMAS[resource];
  if (!schema) {
    throw new Error(
      `Unknown resource "${resource}". Allowed: ${RECORD_RESOURCES.join(", ")}`,
    );
  }
  return schema;
}

function validateData(
  resource: string,
  data: Record<string, unknown>,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): [string, ColumnKind, unknown][] {
  const schema = recordSchema(resource);
  const entries = Object.entries(data ?? {});
  if (!allowEmpty && entries.length === 0) {
    throw new Error(`No fields provided for ${resource}.`);
  }
  for (const [column] of entries) {
    if (!(column in schema.columns)) {
      throw new Error(
        `Column "${column}" is not writable on ${resource}. Allowed: ${Object.keys(
          schema.columns,
        ).join(", ")}`,
      );
    }
  }
  return entries.map(([column, value]) => [
    column,
    schema.columns[column],
    value,
  ]);
}

function prepareValue(kind: ColumnKind, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  switch (kind) {
    case "jsonb":
    case "jsonbArray":
      return typeof value === "string" ? value : JSON.stringify(value);
    case "array":
      return Array.isArray(value) ? value : [value];
    default:
      return value;
  }
}

export async function createRecord(
  userId: string,
  resource: string,
  data: Record<string, unknown>,
): Promise<{ id: number }> {
  const schema = recordSchema(resource);
  const fields = validateData(resource, data);
  const columns = fields.map(([column]) => `"${column}"`);
  const values = fields.map(([, kind, value]) => prepareValue(kind, value));
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const sql = `insert into ${schema.table} (${columns.join(", ")})
    values (${placeholders.join(", ")})
    returning id, *`;
  const [row] = await queryAs<{ id: number; [key: string]: unknown }>(
    userId,
    sql,
    values,
  );
  return row;
}

export async function updateRecord(
  userId: string,
  resource: string,
  id: number,
  data: Record<string, unknown>,
): Promise<{ id: number; [key: string]: unknown }> {
  const schema = recordSchema(resource);
  const fields = validateData(resource, data);
  const values = fields.map(([, kind, value]) => prepareValue(kind, value));
  const assignments = fields.map(
    ([column], index) => `"${column}" = $${index + 1}`,
  );
  if (schema.touchUpdatedAt) {
    assignments.push(`updated_at = now()`);
  }
  const sql = `update ${schema.table}
    set ${assignments.join(", ")}
    where id = $${values.length + 1}
    returning id, *`;
  const [row] = await queryAs<{ id: number; [key: string]: unknown }>(
    userId,
    sql,
    [...values, id],
  );
  if (!row) throw new Error(`${resource} #${id} not found.`);
  return row;
}

export async function deleteRecord(
  userId: string,
  resource: string,
  id: number,
): Promise<{ id: number }> {
  const schema = recordSchema(resource);
  const [row] = await queryAs<{ id: number }>(
    userId,
    `delete from ${schema.table} where id = $1 returning id`,
    [id],
  );
  if (!row) throw new Error(`${resource} #${id} not found.`);
  return row;
}

export async function getRecord(
  userId: string,
  resource: string,
  id: number,
): Promise<Record<string, unknown> | undefined> {
  const schema = recordSchema(resource);
  const [row] = await queryAs<Record<string, unknown>>(
    userId,
    `select * from ${schema.table} where id = $1`,
    [id],
    { readOnly: true },
  );
  return row;
}

/** The `sales.id` of the current CRM user (used to claim a public-pool deal). */
export async function currentSalesId(userId: string): Promise<number | null> {
  const [row] = await queryAs<{ id: number }>(
    userId,
    "select id from public.sales where user_id = $1",
    [userId],
    { readOnly: true },
  );
  return row?.id ?? null;
}
