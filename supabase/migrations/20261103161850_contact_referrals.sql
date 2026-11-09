drop view if exists "public"."activity_log";

drop view if exists "public"."companies_summary";

drop view if exists "public"."contacts_summary";

drop view if exists "public"."init_state";

alter table "public"."contacts" add column "referrer_contact_id" bigint;

CREATE INDEX contacts_referrer_contact_id_idx ON public.contacts USING btree (referrer_contact_id);

alter table "public"."contacts" add constraint "contacts_referrer_contact_id_fkey" FOREIGN KEY (referrer_contact_id) REFERENCES public.contacts(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."contacts" validate constraint "contacts_referrer_contact_id_fkey";

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
    co.referrer_contact_id,
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


create or replace view "public"."init_state" with (security_invoker = off) as  SELECT count(sub.id) AS is_initialized
   FROM ( SELECT sales.id
           FROM public.sales
         LIMIT 1) sub;


CREATE OR REPLACE FUNCTION public.merge_contacts(loser_id bigint, winner_id bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  winner_contact contacts%ROWTYPE;
  loser_contact contacts%ROWTYPE;
  deal_record RECORD;
  merged_emails jsonb;
  merged_phones jsonb;
  merged_tags bigint[];
  winner_emails jsonb;
  loser_emails jsonb;
  winner_phones jsonb;
  loser_phones jsonb;
  email_map jsonb;
  phone_map jsonb;
BEGIN
  -- Fetch both contacts
  SELECT * INTO winner_contact FROM contacts WHERE id = winner_id;
  SELECT * INTO loser_contact FROM contacts WHERE id = loser_id;

  IF winner_contact IS NULL OR loser_contact IS NULL THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- 1. Reassign tasks from loser to winner
  UPDATE tasks SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 2. Reassign contact notes from loser to winner
  UPDATE contact_notes SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 3. Reassign deal stakeholders from loser to winner (deal_contacts replaces
  -- the old deals.contact_ids array), then deal meetings attendee arrays.
  DELETE FROM deal_contacts dc
  WHERE dc.contact_id = loser_id
    AND EXISTS (
      SELECT 1 FROM deal_contacts w
      WHERE w.deal_id = dc.deal_id AND w.contact_id = winner_id
    );
  UPDATE deal_contacts SET contact_id = winner_id WHERE contact_id = loser_id;

  UPDATE deal_meetings
  SET customer_attendee_ids = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(
        array_remove(deal_meetings.customer_attendee_ids, loser_id) || ARRAY[winner_id]
      )
    )
  )
  WHERE customer_attendee_ids @> ARRAY[loser_id];

  -- 4. Merge contact data

  -- Get email arrays
  winner_emails := COALESCE(winner_contact.email_jsonb, '[]'::jsonb);
  loser_emails := COALESCE(loser_contact.email_jsonb, '[]'::jsonb);

  -- Merge emails with deduplication by email address
  -- Build a map of email -> email object, then convert back to array
  email_map := '{}'::jsonb;

  -- Add winner emails to map
  IF jsonb_array_length(winner_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_emails)-1 LOOP
      email_map := email_map || jsonb_build_object(
        winner_emails->i->>'email',
        winner_emails->i
      );
    END LOOP;
  END IF;

  -- Add loser emails to map (won't overwrite existing keys)
  IF jsonb_array_length(loser_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_emails)-1 LOOP
      IF NOT email_map ? (loser_emails->i->>'email') THEN
        email_map := email_map || jsonb_build_object(
          loser_emails->i->>'email',
          loser_emails->i
        );
      END IF;
    END LOOP;
  END IF;

  -- Convert map back to array
  merged_emails := (SELECT jsonb_agg(value) FROM jsonb_each(email_map));
  merged_emails := COALESCE(merged_emails, '[]'::jsonb);

  -- Get phone arrays
  winner_phones := COALESCE(winner_contact.phone_jsonb, '[]'::jsonb);
  loser_phones := COALESCE(loser_contact.phone_jsonb, '[]'::jsonb);

  -- Merge phones with deduplication by number
  phone_map := '{}'::jsonb;

  -- Add winner phones to map
  IF jsonb_array_length(winner_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_phones)-1 LOOP
      phone_map := phone_map || jsonb_build_object(
        winner_phones->i->>'number',
        winner_phones->i
      );
    END LOOP;
  END IF;

  -- Add loser phones to map (won't overwrite existing keys)
  IF jsonb_array_length(loser_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_phones)-1 LOOP
      IF NOT phone_map ? (loser_phones->i->>'number') THEN
        phone_map := phone_map || jsonb_build_object(
          loser_phones->i->>'number',
          loser_phones->i
        );
      END IF;
    END LOOP;
  END IF;

  -- Convert map back to array
  merged_phones := (SELECT jsonb_agg(value) FROM jsonb_each(phone_map));
  merged_phones := COALESCE(merged_phones, '[]'::jsonb);

  -- Merge tags (remove duplicates)
  merged_tags := ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(winner_contact.tags, ARRAY[]::bigint[]) ||
      COALESCE(loser_contact.tags, ARRAY[]::bigint[])
    )
  );

  -- 5. Update winner with merged data
  UPDATE contacts SET
    avatar = COALESCE(winner_contact.avatar, loser_contact.avatar),
    gender = COALESCE(winner_contact.gender, loser_contact.gender),
    name = COALESCE(winner_contact.name, loser_contact.name),
    first_name = COALESCE(winner_contact.first_name, loser_contact.first_name),
    last_name = COALESCE(winner_contact.last_name, loser_contact.last_name),
    title = COALESCE(winner_contact.title, loser_contact.title),
    company_id = COALESCE(winner_contact.company_id, loser_contact.company_id),
    email_jsonb = merged_emails,
    phone_jsonb = merged_phones,
    wechat_id = COALESCE(winner_contact.wechat_id, loser_contact.wechat_id),
    contact_type = COALESCE(winner_contact.contact_type, loser_contact.contact_type),
    birthday = COALESCE(winner_contact.birthday, loser_contact.birthday),
    communication_style = COALESCE(winner_contact.communication_style, loser_contact.communication_style),
    attitude = COALESCE(winner_contact.attitude, loser_contact.attitude),
    tenure_years = COALESCE(winner_contact.tenure_years, loser_contact.tenure_years),
    social_organization = COALESCE(winner_contact.social_organization, loser_contact.social_organization),
    work_experience = COALESCE((
      SELECT jsonb_agg(DISTINCT value)
      FROM jsonb_array_elements(
        COALESCE(winner_contact.work_experience, '[]'::jsonb) ||
        COALESCE(loser_contact.work_experience, '[]'::jsonb)
      )
    ), '[]'::jsonb),
    education = COALESCE((
      SELECT jsonb_agg(DISTINCT value)
      FROM jsonb_array_elements(
        COALESCE(winner_contact.education, '[]'::jsonb) ||
        COALESCE(loser_contact.education, '[]'::jsonb)
      )
    ), '[]'::jsonb),
    status = COALESCE(winner_contact.status, loser_contact.status),
    background = COALESCE(winner_contact.background, loser_contact.background),
    has_newsletter = COALESCE(winner_contact.has_newsletter, loser_contact.has_newsletter),
    first_seen = LEAST(COALESCE(winner_contact.first_seen, loser_contact.first_seen), COALESCE(loser_contact.first_seen, winner_contact.first_seen)),
    last_seen = GREATEST(COALESCE(winner_contact.last_seen, loser_contact.last_seen), COALESCE(loser_contact.last_seen, winner_contact.last_seen)),
    sales_id = COALESCE(winner_contact.sales_id, loser_contact.sales_id),
    tags = merged_tags
  WHERE id = winner_id;

  -- 6. Re-point referral relationships to the winner (an old referral to the
  -- loser now points at the winner; a loser who referred the winner disappears
  -- instead of leaving a self-reference).
  UPDATE contacts
     SET referrer_contact_id = winner_id
   WHERE referrer_contact_id = loser_id
     AND id <> winner_id;

  UPDATE contacts
     SET referrer_contact_id = CASE
           WHEN loser_contact.referrer_contact_id = winner_id THEN NULL
           ELSE loser_contact.referrer_contact_id
         END
   WHERE id = winner_id
     AND referrer_contact_id = loser_id;

  -- 7. Delete loser contact
  DELETE FROM contacts WHERE id = loser_id;

  RETURN winner_id;
END;
$function$
;

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