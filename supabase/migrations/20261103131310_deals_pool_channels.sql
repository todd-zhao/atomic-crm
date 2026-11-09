drop trigger if exists "set_deal_sales_id_trigger" on "public"."deals";

drop view if exists "public"."activity_log";

drop view if exists "public"."companies_summary";

drop view if exists "public"."contacts_summary";

drop view if exists "public"."init_state";

alter table "public"."companies" add column "channel_type" text;

alter table "public"."companies" add column "company_kind" text not null default 'hotel'::text;

alter table "public"."companies" drop column "fts";
alter table "public"."companies" add column "fts" tsvector generated always as (
    public.search_document(name, company_kind, channel_type, sector, customer_category, hotel_type, description, (website)::text, phone_number, zipcode, city, state_abbr)
) stored;
create index companies_fts_idx on public.companies using gin (fts);

alter table "public"."deals" add column "channel_id" bigint;

alter table "public"."deals" add column "is_unassigned" boolean generated always as ((sales_id IS NULL)) stored;

alter table "public"."deals" add column "source_type" text not null default 'direct'::text;

CREATE INDEX companies_company_kind_idx ON public.companies USING btree (company_kind);

CREATE INDEX deals_channel_id_idx ON public.deals USING btree (channel_id);

CREATE INDEX deals_is_unassigned_idx ON public.deals USING btree (is_unassigned) WHERE is_unassigned;

CREATE INDEX deals_sales_id_idx ON public.deals USING btree (sales_id);

alter table "public"."deals" add constraint "deals_channel_id_fkey" FOREIGN KEY (channel_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."deals" validate constraint "deals_channel_id_fkey";

set check_function_bodies = off;

create or replace view "public"."activity_log" with (security_invoker = on) as  SELECT (('company.'::text || c.id) || '.created'::text) AS id,
    'company.created'::text AS type,
    c.created_at AS date,
    c.id AS company_id,
    c.sales_id,
    ((to_jsonb(c.*) - 'fts'::text))::json AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note
   FROM public.companies c
UNION ALL
 SELECT (('contact.'::text || co.id) || '.created'::text) AS id,
    'contact.created'::text AS type,
    co.first_seen AS date,
    co.company_id,
    co.sales_id,
    NULL::json AS company,
    ((to_jsonb(co.*) - 'fts'::text))::json AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note
   FROM public.contacts co
UNION ALL
 SELECT (('contactNote.'::text || cn.id) || '.created'::text) AS id,
    'contactNote.created'::text AS type,
    cn.date,
    co.company_id,
    cn.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    ((to_jsonb(cn.*) - 'fts'::text))::json AS contact_note,
    NULL::json AS deal_note
   FROM (public.contact_notes cn
     LEFT JOIN public.contacts co ON ((co.id = cn.contact_id)))
UNION ALL
 SELECT (('deal.'::text || d.id) || '.created'::text) AS id,
    'deal.created'::text AS type,
    d.created_at AS date,
    d.company_id,
    d.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    ((to_jsonb(d.*) - 'fts'::text))::json AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note
   FROM public.deals d
UNION ALL
 SELECT (('dealNote.'::text || dn.id) || '.created'::text) AS id,
    'dealNote.created'::text AS type,
    dn.date,
    d.company_id,
    dn.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    ((to_jsonb(dn.*) - 'fts'::text))::json AS deal_note
   FROM (public.deal_notes dn
     LEFT JOIN public.deals d ON ((d.id = dn.deal_id)));


create or replace view "public"."companies_summary" with (security_invoker = on) as  SELECT c.id,
    c.created_at,
    c.name,
    c.company_kind,
    c.channel_type,
    c.sector,
    c.customer_category,
    c.parent_company_id,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.sales_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    c.hotel_type,
    c.rooms,
    c.opening_year,
    c.hotel_services,
    c.average_room_rate,
    count(DISTINCT d.id) AS nb_deals,
    count(DISTINCT co.id) AS nb_contacts
   FROM ((public.companies c
     LEFT JOIN public.deals d ON ((c.id = d.company_id)))
     LEFT JOIN public.contacts co ON ((c.id = co.company_id)))
  GROUP BY c.id;


create or replace view "public"."contacts_summary" with (security_invoker = on) as  SELECT co.id,
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
    co.wechat_id,
    co.contact_type,
    co.birthday,
    co.communication_style,
    co.attitude,
    co.tenure_years,
    co.social_organization,
    co.work_experience,
    co.education,
    co.email_jsonb,
    co.phone_jsonb,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'::jsonpath))::text AS email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'::jsonpath))::text AS phone_fts,
    c.name AS company_name,
    count(DISTINCT t.id) FILTER (WHERE (t.done_date IS NULL)) AS nb_tasks
   FROM ((public.contacts co
     LEFT JOIN public.tasks t ON ((co.id = t.contact_id)))
     LEFT JOIN public.companies c ON ((co.company_id = c.id)))
  GROUP BY co.id, c.name;


CREATE OR REPLACE FUNCTION public.global_search(query text, resources text[] DEFAULT NULL::text[], max_results integer DEFAULT 50)
 RETURNS TABLE(resource text, record_id bigint, title text, subtitle text, contact_id bigint, deal_id bigint, date timestamp with time zone, content text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
    tsq tsquery := public.search_query(query);
    branch_templates constant jsonb := jsonb_build_object(
        'companies', $q$
            select 'companies', c.id, c.name, c.sector, null::bigint, null::bigint, c.created_at,
                concat_ws(' · ', c.company_kind, c.channel_type, c.sector, c.customer_category, c.hotel_type, c.description, c.website::text, c.phone_number, c.zipcode, c.city, c.state_abbr)
            from public.companies c
            where c.fts @@ %1$L::tsquery
            order by c.created_at desc
            limit %2$s $q$,
        'contacts', $q$
            select 'contacts', co.id, coalesce(nullif(co.name, ''), concat_ws(' ', co.first_name, co.last_name)),
                (select cc.name from public.companies cc where cc.id = co.company_id), co.id, null::bigint, co.first_seen,
                concat_ws(' · ', co.title, co.contact_type, co.background, co.wechat_id,
                    (select string_agg(e ->> 'email', ' ') from jsonb_array_elements(co.email_jsonb) e),
                    (select string_agg(p ->> 'number', ' ') from jsonb_array_elements(co.phone_jsonb) p))
            from public.contacts co
            where co.fts @@ %1$L::tsquery
            order by co.first_seen desc nulls last
            limit %2$s $q$,
        'deals', $q$
            select 'deals', d.id, d.name,
                (select dc.name from public.companies dc where dc.id = d.company_id), null::bigint, d.id, d.created_at,
                concat_ws(' · ', d.deal_type, d.stage, d.status, d.description, d.decision_process)
            from public.deals d
            where d.archived_at is null and d.fts @@ %1$L::tsquery
            order by d.created_at desc
            limit %2$s $q$,
        'tasks', $q$
            select 'tasks', t.id, left(t.text, 200),
                (select coalesce(nullif(tc.name, ''), concat_ws(' ', tc.first_name, tc.last_name)) from public.contacts tc where tc.id = t.contact_id),
                t.contact_id, null::bigint, t.created_at,
                concat_ws(' · ', t.text, t.type)
            from public.tasks t
            where t.done_date is null and t.fts @@ %1$L::tsquery
            order by t.created_at desc
            limit %2$s $q$,
        'contact_notes', $q$
            select 'contact_notes', cn.id, left(cn.text, 200),
                (select coalesce(nullif(nc.name, ''), concat_ws(' ', nc.first_name, nc.last_name)) from public.contacts nc where nc.id = cn.contact_id),
                cn.contact_id, null::bigint, cn.date,
                concat_ws(' · ', cn.text, public.search_attachment_titles(cn.attachments))
            from public.contact_notes cn
            where cn.fts @@ %1$L::tsquery
            order by cn.date desc nulls last
            limit %2$s $q$,
        'deal_notes', $q$
            select 'deal_notes', dn.id, left(dn.text, 200), nd.name, null::bigint, dn.deal_id, dn.date,
                concat_ws(' · ', dn.text, public.search_attachment_titles(dn.attachments))
            from public.deal_notes dn
                join public.deals nd on nd.id = dn.deal_id
            where nd.archived_at is null and dn.fts @@ %1$L::tsquery
            order by dn.date desc nulls last
            limit %2$s $q$
    );
    row_limit constant integer := least(coalesce(max_results, 50), 200);
    branches text[];
begin
    if tsq is null or row_limit < 1 then
        return;
    end if;

    select array_agg(format('(%s)', format(template, tsq::text, row_limit)))
    into branches
    from jsonb_each_text(branch_templates) as b(name, template)
    where resources is null or b.name = any(resources);

    if branches is null then
        return;
    end if;

    return query execute format(
        'select * from (%s) results order by 7 desc nulls last',
        array_to_string(branches, ' union all ')
    );
end
$function$
;

create or replace view "public"."init_state" with (security_invoker = off) as  SELECT count(sub.id) AS is_initialized
   FROM ( SELECT sales.id
           FROM public.sales
         LIMIT 1) sub;

-- Views were dropped and recreated above: restore their grants.
grant all on table public.activity_log to anon;
grant all on table public.activity_log to authenticated;
grant all on table public.activity_log to service_role;
grant all on table public.companies_summary to anon;
grant all on table public.companies_summary to authenticated;
grant all on table public.companies_summary to service_role;
grant all on table public.contacts_summary to anon;
grant all on table public.contacts_summary to authenticated;
grant all on table public.contacts_summary to service_role;
grant all on table public.init_state to anon;
grant all on table public.init_state to authenticated;
grant all on table public.init_state to service_role;