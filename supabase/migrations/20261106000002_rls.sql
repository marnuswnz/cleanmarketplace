-- =============================================================================
-- Row level security, helper functions and transactional RPCs.
--
-- Access model
--   * anon:          read active reference data only. No inserts anywhere —
--                    public writes go through server routes using service_role.
--   * authenticated: partner users see their own partner row, seats, offers,
--                    and leads where they hold an ACCEPTED offer. Admins
--                    (rows in admin_users) see everything.
--   * service_role:  bypasses RLS (server routes, cron, webhooks).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers (security definer so they can read membership tables under RLS)
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_users where user_id = auth.uid())
$$;

create or replace function my_partner_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select partner_id from partner_users where user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table app_settings enable row level security;
alter table areas enable row level security;
alter table area_adjacency enable row level security;
alter table suburbs enable row level security;
alter table service_groups enable row level security;
alter table services enable row level security;
alter table pricing_rules enable row level security;
alter table partners enable row level security;
alter table partner_users enable row level security;
alter table admin_users enable row level security;
alter table seats enable row level security;
alter table leads enable row level security;
alter table lead_offers enable row level security;
alter table messages enable row level security;
alter table feedback enable row level security;
alter table waitlist enable row level security;
alter table audit_log enable row level security;
alter table rate_limit_hits enable row level security;

-- ---------------------------------------------------------------------------
-- Reference data: public read of active rows, admin full access
-- ---------------------------------------------------------------------------
create policy areas_read on areas for select using (active or is_admin());
create policy areas_admin on areas for all to authenticated using (is_admin()) with check (is_admin());

create policy adjacency_read on area_adjacency for select using (true);
create policy adjacency_admin on area_adjacency for all to authenticated using (is_admin()) with check (is_admin());

create policy suburbs_read on suburbs for select using (active or is_admin());
create policy suburbs_admin on suburbs for all to authenticated using (is_admin()) with check (is_admin());

create policy groups_read on service_groups for select using (true);
create policy groups_admin on service_groups for all to authenticated using (is_admin()) with check (is_admin());

create policy services_read on services for select using (active or is_admin());
create policy services_admin on services for all to authenticated using (is_admin()) with check (is_admin());

create policy pricing_read on pricing_rules for select using (active or is_admin());
create policy pricing_admin on pricing_rules for all to authenticated using (is_admin()) with check (is_admin());

create policy settings_admin on app_settings for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Partners
-- ---------------------------------------------------------------------------
create policy partners_self_read on partners for select to authenticated
  using (id in (select my_partner_ids()) or is_admin());
create policy partners_self_update on partners for update to authenticated
  using (id in (select my_partner_ids()) or is_admin())
  with check (id in (select my_partner_ids()) or is_admin());
create policy partners_admin on partners for all to authenticated using (is_admin()) with check (is_admin());

-- Partners may only edit their public profile fields. Status, insurance
-- expiry, billing ids and metrics are admin/system only.
revoke update on partners from anon, authenticated;
grant update (contact_name, mobile, logo_url, description, gbp_url, insurance_doc_path)
  on partners to authenticated;
-- Admins need full column access; they act through the service role for
-- writes to protected columns (see src/lib/admin/*), so no extra grant here.

create policy partner_users_self on partner_users for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy partner_users_admin on partner_users for all to authenticated using (is_admin()) with check (is_admin());

create policy admin_users_read on admin_users for select to authenticated using (is_admin());

create policy seats_self_read on seats for select to authenticated
  using (partner_id in (select my_partner_ids()) or is_admin());
create policy seats_admin on seats for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Leads: a partner can read a lead (including customer contact fields) only
-- once it holds an ACCEPTED offer for it. Pre-acceptance previews come from
-- get_partner_offers(), which never returns contact fields.
-- ---------------------------------------------------------------------------
create policy leads_partner_accepted on leads for select to authenticated
  using (
    is_admin() or exists (
      select 1 from lead_offers o
       where o.lead_id = leads.id
         and o.status = 'accepted'
         and o.partner_id in (select my_partner_ids())
    )
  );
create policy leads_admin on leads for all to authenticated using (is_admin()) with check (is_admin());

create policy offers_self_read on lead_offers for select to authenticated
  using (partner_id in (select my_partner_ids()) or is_admin());
-- Partners can record the outcome of offers they accepted.
create policy offers_self_outcome on lead_offers for update to authenticated
  using (partner_id in (select my_partner_ids()) and status = 'accepted')
  with check (partner_id in (select my_partner_ids()) and status = 'accepted');
create policy offers_admin on lead_offers for all to authenticated using (is_admin()) with check (is_admin());

revoke update on lead_offers from anon, authenticated;
grant update (outcome, price_cents) on lead_offers to authenticated;

-- ---------------------------------------------------------------------------
-- Internal tables: admin read only
-- ---------------------------------------------------------------------------
create policy messages_admin on messages for select to authenticated using (is_admin());
create policy feedback_admin on feedback for select to authenticated using (is_admin());
create policy waitlist_admin on waitlist for select to authenticated using (is_admin());
create policy audit_admin on audit_log for select to authenticated using (is_admin());
-- rate_limit_hits: no policies => no access except service_role.

-- ---------------------------------------------------------------------------
-- Partner offer inbox (no customer contact until accepted)
-- ---------------------------------------------------------------------------
create or replace function get_partner_offers()
returns table (
  offer_id uuid,
  lead_id uuid,
  ref_code text,
  status offer_status,
  kind offer_kind,
  group_code text,
  offered_at timestamptz,
  expires_at timestamptz,
  responded_at timestamptz,
  outcome offer_outcome,
  price_cents int,
  token text,
  suburb_name text,
  area_name text,
  services text[],
  details jsonb,
  est_low_cents int,
  est_high_cents int,
  preferred_date date,
  flexible boolean,
  customer_name text,
  customer_mobile text,
  customer_email text,
  notes text
)
language sql stable security definer set search_path = public as $$
  select o.id, l.id, l.ref_code, o.status, o.kind, g.code,
         o.offered_at, o.expires_at, o.responded_at, o.outcome, o.price_cents,
         case when o.status = 'offered' then o.token end,
         s.name, a.name, l.services, l.details, l.est_low_cents, l.est_high_cents,
         l.preferred_date, l.flexible,
         case when o.status = 'accepted' then l.customer_name end,
         case when o.status = 'accepted' then l.customer_mobile end,
         case when o.status = 'accepted' then l.customer_email end,
         case when o.status = 'accepted' then l.notes end
    from lead_offers o
    join leads l on l.id = o.lead_id
    join suburbs s on s.id = l.suburb_id
    join areas a on a.id = l.area_id
    join service_groups g on g.id = o.group_id
   where o.partner_id in (select my_partner_ids())
     and o.offered_at <= now()
   order by o.offered_at desc
$$;
revoke all on function get_partner_offers() from public, anon;
grant execute on function get_partner_offers() to authenticated;

-- ---------------------------------------------------------------------------
-- Offer responses (service_role only; called from /api/offers/[token]/*)
-- Idempotent: repeated calls return the current state without side effects.
-- ---------------------------------------------------------------------------
create or replace function accept_offer(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o lead_offers%rowtype;
  v_max int := setting_int('max_partners_per_lead', 2);
  v_accepted int;
begin
  select * into o from lead_offers where token = p_token for update;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  if o.status = 'accepted' then
    return jsonb_build_object('result', 'already_accepted', 'offer_id', o.id, 'lead_id', o.lead_id);
  end if;
  if o.status in ('declined', 'cancelled', 'expired') then
    return jsonb_build_object('result', o.status::text, 'offer_id', o.id, 'lead_id', o.lead_id);
  end if;
  if o.expires_at < now() then
    update lead_offers set status = 'expired' where id = o.id;
    return jsonb_build_object('result', 'expired', 'offer_id', o.id, 'lead_id', o.lead_id, 'newly_expired', true);
  end if;

  perform pg_advisory_xact_lock(hashtext('offercell:' || o.lead_id::text || ':' || o.group_id::text));
  select count(*) into v_accepted from lead_offers
   where lead_id = o.lead_id and group_id = o.group_id and status = 'accepted';
  if v_accepted >= v_max then
    update lead_offers set status = 'cancelled', responded_at = now() where id = o.id;
    return jsonb_build_object('result', 'filled', 'offer_id', o.id, 'lead_id', o.lead_id);
  end if;

  update lead_offers set status = 'accepted', responded_at = now() where id = o.id;
  update leads
     set status = case when status in ('closed', 'spam') then status else 'accepted' end,
         first_accepted_at = coalesce(first_accepted_at, now())
   where id = o.lead_id;

  return jsonb_build_object(
    'result', 'accepted', 'offer_id', o.id, 'lead_id', o.lead_id,
    'partner_id', o.partner_id, 'kind', o.kind::text, 'group_id', o.group_id
  );
end $$;

create or replace function decline_offer(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o lead_offers%rowtype;
begin
  select * into o from lead_offers where token = p_token for update;
  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;
  if o.status <> 'offered' then
    return jsonb_build_object('result', 'already_' || o.status::text, 'offer_id', o.id, 'lead_id', o.lead_id);
  end if;
  if o.expires_at < now() then
    update lead_offers set status = 'expired' where id = o.id;
    return jsonb_build_object('result', 'expired', 'offer_id', o.id, 'lead_id', o.lead_id, 'newly_expired', true);
  end if;
  update lead_offers set status = 'declined', responded_at = now() where id = o.id;
  return jsonb_build_object('result', 'declined', 'offer_id', o.id, 'lead_id', o.lead_id,
                            'partner_id', o.partner_id, 'group_id', o.group_id);
end $$;

-- Expire all lapsed offers; returns the affected (lead_id, group_id) pairs.
create or replace function expire_lapsed_offers()
returns table (lead_id uuid, group_id uuid, partner_id uuid)
language sql security definer set search_path = public as $$
  update lead_offers set status = 'expired'
   where status = 'offered' and expires_at < now()
  returning lead_offers.lead_id, lead_offers.group_id, lead_offers.partner_id
$$;

-- ---------------------------------------------------------------------------
-- Partner metrics (last 90 days)
-- ---------------------------------------------------------------------------
create or replace function refresh_partner_metrics(p_partner_id uuid)
returns void language sql security definer set search_path = public as $$
  update partners p set
    accept_rate = m.accept_rate,
    avg_response_mins = m.avg_mins
  from (
    select
      case when count(*) filter (where status in ('accepted','declined','expired')) = 0 then null
           else (count(*) filter (where status = 'accepted'))::numeric
                / count(*) filter (where status in ('accepted','declined','expired')) end as accept_rate,
      avg(extract(epoch from (responded_at - offered_at)) / 60.0)
        filter (where responded_at is not null and status in ('accepted','declined')) as avg_mins
    from lead_offers
    where partner_id = p_partner_id and offered_at > now() - interval '90 days'
  ) m
  where p.id = p_partner_id
$$;

-- Offer counts per partner over the last N days (fairness ordering).
create or replace function partner_recent_offer_counts(p_partner_ids uuid[], p_days int default 7)
returns table (partner_id uuid, offers bigint)
language sql stable security definer set search_path = public as $$
  select partner_id, count(*) from lead_offers
   where partner_id = any(p_partner_ids) and offered_at > now() - make_interval(days => p_days)
   group by partner_id
$$;

-- ---------------------------------------------------------------------------
-- Privacy: purge customer PII 18 months after a lead is closed.
-- ---------------------------------------------------------------------------
create or replace function purge_closed_lead_pii()
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update leads set
    customer_name = null, customer_mobile = null, customer_email = null,
    notes = null, photo_paths = '{}', source = '{}', pii_purged_at = now()
  where closed_at is not null and closed_at < now() - interval '18 months'
    and pii_purged_at is null;
  get diagnostics v = row_count;
  return v;
end $$;

-- Service-role-only RPCs
revoke all on function accept_offer(text) from public, anon, authenticated;
revoke all on function decline_offer(text) from public, anon, authenticated;
revoke all on function expire_lapsed_offers() from public, anon, authenticated;
revoke all on function refresh_partner_metrics(uuid) from public, anon, authenticated;
revoke all on function partner_recent_offer_counts(uuid[], int) from public, anon, authenticated;
revoke all on function purge_closed_lead_pii() from public, anon, authenticated;
revoke all on function rate_limit_hit(text, int, int) from public, anon, authenticated;
