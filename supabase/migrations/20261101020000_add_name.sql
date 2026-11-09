-- Add an optional full display name to contacts and sales team members.
--
-- Chinese users are used to a single full name ("张伟"), while the legacy
-- first_name / last_name columns are still kept for English names and backward
-- compatibility. The UI displays `name` when set and falls back to
-- "first_name last_name" otherwise.

alter table public.contacts add column name text;

alter table public.sales add column name text;

-- Expose the new column through the list view used by the contacts list.
-- The view is dropped and recreated because the new column is not appended at
-- the end (Postgres cannot reorder columns with CREATE OR REPLACE VIEW).
drop view if exists public.contacts_summary;

create view public.contacts_summary with (security_invoker = on) as
select
    co.id,
    co.name,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    co.email_jsonb,
    co.phone_jsonb,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'))::text as email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'))::text as phone_fts,
    c.name as company_name,
    count(distinct t.id) filter (where t.done_date is null) as nb_tasks
from public.contacts co
    left join public.tasks t on co.id = t.contact_id
    left join public.companies c on co.company_id = c.id
group by co.id, c.name;
