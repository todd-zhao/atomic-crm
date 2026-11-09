import { queryAs } from "../db";

/** SQL used by the assistant tools. All statements are parameterized and
 *  executed as the `authenticated` role so RLS applies. */

export type ContactRow = {
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

export function contactName(row: {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (name) return name;
  return (
    [row.first_name, row.last_name].filter(Boolean).join(" ") ||
    "(unnamed contact)"
  );
}

export async function contactDisplayName(
  userId: string,
  contactId: number,
): Promise<string> {
  const rows = await queryAs<{
    name: string | null;
    first_name: string | null;
    last_name: string | null;
  }>(
    userId,
    "select name, first_name, last_name from public.contacts where id = $1",
    [contactId],
    { readOnly: true },
  );
  return rows[0] ? contactName(rows[0]) : `contact #${contactId}`;
}

export async function companyDisplayName(
  userId: string,
  companyId: number,
): Promise<string> {
  const rows = await queryAs<{ name: string }>(
    userId,
    "select name from public.companies where id = $1",
    [companyId],
    { readOnly: true },
  );
  return rows[0]?.name ?? `company #${companyId}`;
}

export async function dealDisplayName(
  userId: string,
  dealId: number,
): Promise<string> {
  const rows = await queryAs<{ name: string }>(
    userId,
    "select name from public.deals where id = $1",
    [dealId],
    { readOnly: true },
  );
  return rows[0]?.name ?? `deal #${dealId}`;
}

export async function taskDisplayName(
  userId: string,
  taskId: number,
): Promise<string> {
  const rows = await queryAs<{ text: string | null }>(
    userId,
    "select text from public.tasks where id = $1",
    [taskId],
    { readOnly: true },
  );
  return rows[0]?.text ?? `task #${taskId}`;
}

export const READ_SQL = {
  searchContacts: `
    select c.id, c.name, c.first_name, c.last_name, c.title, c.status, c.attitude,
           c.contact_type, c.last_seen,
           comp.name as company_name,
           (select coalesce(json_agg(tg.name order by tg.name), '[]'::json)
              from public.tags tg where tg.id = any(c.tags)) as tags,
           (select count(*) from public.tasks t
              where t.contact_id = c.id and t.done_date is null) as pending_tasks
      from public.contacts c
      left join public.companies comp on comp.id = c.company_id
     where ($1::text is null
            or (coalesce(c.name, '') || ' ' || coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '') || ' ' || coalesce(comp.name, '')) ilike '%' || $1 || '%')
       and ($2::text is null or c.attitude = $2)
       and ($3::bigint is null or c.sales_id = $3)
       and ($4::text is null or exists (
             select 1 from public.tags tg where tg.id = any(c.tags) and tg.name ilike '%' || $4 || '%'))
     order by c.last_seen desc nulls last
     limit $5`,
  getContact: `
    select c.id, c.name, c.first_name, c.last_name, c.title, c.status, c.attitude,
           c.contact_type, c.birthday, c.communication_style, c.tenure_years,
           c.social_organization, c.work_experience, c.education,
           c.gender, c.wechat_id, c.email_jsonb, c.phone_jsonb, c.background,
           c.first_seen, c.last_seen, c.has_newsletter,
           comp.id as company_id, comp.name as company_name, comp.sector,
           comp.website, comp.customer_category, comp.hotel_type, comp.rooms,
           comp.opening_year, comp.hotel_services, comp.average_room_rate,
           comp.company_kind, comp.channel_type,
           (select coalesce(json_agg(tg.name order by tg.name), '[]'::json)
              from public.tags tg where tg.id = any(c.tags)) as tags
      from public.contacts c
      left join public.companies comp on comp.id = c.company_id
     where c.id = $1`,
  contactNotes: `
    select id, date, text, status
      from public.contact_notes
     where contact_id = $1
     order by date desc nulls last
     limit 10`,
  contactTasks: `
    select id, type, text, due_date, done_date
      from public.tasks
     where contact_id = $1
     order by (done_date is not null), due_date asc nulls last
     limit 20`,
  contactDeals: `
    select d.id, d.name, d.status, d.stage, d.deal_type, d.budget, d.final_amount,
           d.expected_closing_date, dc.role, dc.attitude as contact_attitude,
           dc.influence, dc.pain
      from public.deals d
      join public.deal_contacts dc on dc.deal_id = d.id
     where dc.contact_id = $1
     order by d.updated_at desc nulls last
     limit 20`,
  searchCompanies: `
    select c.id, c.name, c.company_kind, c.channel_type, c.sector, c.customer_category,
           c.hotel_type, c.rooms, c.size, c.city, c.country, c.website,
           (select count(*) from public.contacts ct where ct.company_id = c.id) as nb_contacts,
           (select count(*) from public.deals d where d.company_id = c.id) as nb_deals
      from public.companies c
     where ($1::text is null or c.name ilike '%' || $1 || '%')
       and ($2::text is null or c.sector = $2)
       and ($3::text is null or c.company_kind = $3)
     order by c.name asc
     limit $4`,
  getCompany: `
    select c.*,
           parent.name as parent_company_name,
           (select count(*) from public.contacts ct where ct.company_id = c.id) as nb_contacts,
           (select count(*) from public.deals d where d.company_id = c.id) as nb_deals
      from public.companies c
      left join public.companies parent on parent.id = c.parent_company_id
     where c.id = $1`,
  companyContacts: `
    select id, name, first_name, last_name, title, contact_type, attitude, last_seen
      from public.contacts
     where company_id = $1
     order by last_seen desc nulls last
     limit 25`,
  companyDeals: `
    select id, name, status, stage, deal_type, budget, final_amount,
           expected_closing_date
      from public.deals
     where company_id = $1 and archived_at is null
     order by updated_at desc nulls last
     limit 25`,
  listDeals: `
    select d.id, d.name, d.status, d.stage, d.deal_type, d.source_type,
           d.is_unassigned, d.budget, d.final_amount, d.expected_closing_date,
           d.created_at, d.updated_at, d.sales_id,
           comp.name as company_name, cp.name as competitor_name,
           ch.name as channel_name, owner.name as owner_name,
           owner.first_name as owner_first_name, owner.last_name as owner_last_name
      from public.deals d
      left join public.companies comp on comp.id = d.company_id
      left join public.competitors cp on cp.id = d.competitor_id
      left join public.companies ch on ch.id = d.channel_id
      left join public.sales owner on owner.id = d.sales_id
     where ($1::text is null or d.status = $1)
       and ($2::text is null or d.stage = $2)
       and ($3::bigint is null or d.sales_id = $3)
       and ($4::bigint is null or coalesce(d.budget, 0) >= $4)
       and ($5::text is null or d.source_type = $5)
       and ($6::boolean is null or d.is_unassigned = $6)
       and d.archived_at is null
     order by d.index desc nulls last, d.updated_at desc
     limit $7`,
  getDeal: `
    select d.*, comp.name as company_name, comp.company_kind as company_kind,
           cp.name as competitor_name,
           ch.name as channel_name, ch.channel_type as channel_type,
           owner.name as owner_name, owner.first_name as owner_first_name,
           owner.last_name as owner_last_name
      from public.deals d
      left join public.companies comp on comp.id = d.company_id
      left join public.competitors cp on cp.id = d.competitor_id
      left join public.companies ch on ch.id = d.channel_id
      left join public.sales owner on owner.id = d.sales_id
     where d.id = $1`,
  dealContacts: `
    select dc.id, dc.contact_id, dc.role, dc.attitude, dc.influence, dc.pain,
           c.name, c.first_name, c.last_name, c.title, comp.name as company_name
      from public.deal_contacts dc
      join public.contacts c on c.id = dc.contact_id
      left join public.companies comp on comp.id = c.company_id
     where dc.deal_id = $1
     order by dc.index asc nulls last, dc.id asc`,
  dealPains: `
    select id, symptom, cause, duration, quantified_loss
      from public.deal_pains
     where deal_id = $1
     order by index asc nulls last, id asc`,
  dealMilestones: `
    select id, event, date
      from public.deal_milestones
     where deal_id = $1
     order by date asc nulls last, id asc`,
  dealMeetings: `
    select dm.id, dm.meeting_date, dm.content, dm.next_steps,
           (select coalesce(json_agg(coalesce(nullif(trim(c.name), ''), trim(concat(c.first_name, ' ', c.last_name))) order by c.id), '[]'::json)
              from public.contacts c where c.id = any(dm.customer_attendee_ids)) as customer_attendees,
           (select coalesce(json_agg(coalesce(nullif(trim(s.name), ''), trim(concat(s.first_name, ' ', s.last_name))) order by s.id), '[]'::json)
              from public.sales s where s.id = any(dm.our_attendee_ids)) as our_attendees
      from public.deal_meetings dm
     where dm.deal_id = $1
     order by dm.meeting_date desc nulls last, dm.id desc`,
  listCompetitors: `
    select id, name, brand_influence, market_price, advantages, weaknesses
      from public.competitors
     where ($1::text is null or name ilike '%' || $1 || '%')
     order by name asc
     limit $2`,
  listTasks: `
    select t.id, t.type, t.text, t.due_date, t.done_date, t.contact_id,
           c.name, c.first_name, c.last_name
      from public.tasks t
      join public.contacts c on c.id = t.contact_id
     where ($1::bigint is null or t.contact_id = $1)
       and ($2::boolean is null
            or ($2::boolean and t.done_date is not null)
            or (not $2::boolean and t.done_date is null))
       and ($3::timestamptz is null or t.due_date <= $3::timestamptz)
     order by t.done_date nulls first, t.due_date asc nulls last
     limit $4`,
  listActivity: `
    select type, date, sales_id,
           case when contact is not null then
             coalesce(nullif(trim(contact->>'name'), ''),
                      trim(concat(contact->>'first_name', ' ', contact->>'last_name'))) end as contact_name,
           case when company is not null then company->>'name' end as company_name,
           case when deal is not null then deal->>'name' end as deal_name,
           case when contact_note is not null then contact_note->>'text' end as note_text,
           case when deal_note is not null then deal_note->>'text' end as deal_note_text
      from public.activity_log
     where ($1::bigint is null or (contact->>'id')::bigint = $1)
       and ($2::timestamptz is null or date >= $2::timestamptz)
     order by date desc nulls last
     limit $3`,
  teamMembers: `
    select id, name, first_name, last_name, email, administrator
      from public.sales
     where disabled = false
     order by coalesce(name, last_name) asc
     limit 50`,
} as const;

export const WRITE_SQL = {
  createContact: `
    insert into public.contacts
      (name, first_name, last_name, title, company_id, email_jsonb, phone_jsonb,
       status, attitude, contact_type, wechat_id, first_seen, last_seen,
       has_newsletter, tags, gender, avatar)
    values ($1, $2, $3, $4, $5, coalesce($6::jsonb, '[]'::jsonb), coalesce($7::jsonb, '[]'::jsonb),
            'cold', coalesce($8, 'neutral'), coalesce($9, 'customer'), $10,
            now(), now(), false, '{}', 'unknown', $11::jsonb)
    returning id, name, first_name, last_name`,
  createTask: `
    insert into public.tasks (contact_id, type, text, due_date)
    values ($1, coalesce($2, 'none'), $3, $4)
    returning id, contact_id, text, due_date`,
  addContactNote: `
    insert into public.contact_notes (contact_id, text, status, date)
    values ($1, $2, coalesce($3, 'cold'), now())
    returning id, contact_id, text, status`,
  createDeal: `
    insert into public.deals
      (name, company_id, budget, stage, status, deal_type, expected_closing_date,
       description, competitor_id, source_type, channel_id, sales_id)
    values ($1, $2, coalesce($3, 0), coalesce($4, 'contact'), coalesce($5, 'potential'),
            $6, $7::date, $8, $9, coalesce($10, 'direct'), $11, $12)
    returning id, name, status, stage, budget, source_type, sales_id`,
  updateDealStage: `
    update public.deals
       set stage = $2, updated_at = now()
     where id = $1
    returning id, name, stage`,
  updateDealStatus: `
    update public.deals
       set status = $2,
           updated_at = now(),
           final_amount = case when $2 = 'won' then coalesce(final_amount, budget) else final_amount end
     where id = $1
    returning id, name, status, final_amount`,
  createCompetitor: `
    insert into public.competitors (name, brand_influence, market_price, advantages, weaknesses)
    values ($1, $2, $3, $4, $5)
    returning id, name`,
  markTaskDone: `
    update public.tasks
       set done_date = coalesce(done_date, now())
     where id = $1
    returning id, text, done_date`,
} as const;
