-- =============================================================================
-- Core schema: reference data, partners, seats, leads, offers, messaging.
-- All tables have RLS enabled (see 20261106000002_rls.sql).
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type partner_status as enum ('applied', 'approved', 'suspended', 'churned');
create type partner_role as enum ('owner', 'staff');
create type seat_status as enum ('trial', 'active', 'past_due', 'cancelled');
create type lead_status as enum ('new', 'routing', 'offered', 'accepted', 'unrouted', 'closed', 'spam');
create type offer_kind as enum ('seat', 'overflow');
create type offer_status as enum ('offered', 'accepted', 'declined', 'expired', 'cancelled');
create type offer_outcome as enum ('booked', 'not_booked', 'no_contact');
create type message_channel as enum ('sms', 'email');
create type area_price_tier as enum ('standard', 'large');

-- ---------------------------------------------------------------------------
-- Runtime settings that the database itself must enforce (trigger limits).
-- Mirrors env config; the DB value is authoritative for triggers.
-- ---------------------------------------------------------------------------
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function setting_int(p_key text, p_default int)
returns int language sql stable as $$
  select coalesce((select (value #>> '{}')::int from app_settings where key = p_key), p_default)
$$;

-- ---------------------------------------------------------------------------
-- Coverage
-- ---------------------------------------------------------------------------
create table areas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  slug text not null unique,
  price_tier area_price_tier not null default 'standard',
  sort int not null default 0,
  active boolean not null default true
);

-- Adjacency map used for overflow routing (symmetric rows are stored explicitly).
create table area_adjacency (
  area_id uuid not null references areas(id) on delete cascade,
  adjacent_area_id uuid not null references areas(id) on delete cascade,
  primary key (area_id, adjacent_area_id),
  check (area_id <> adjacent_area_id)
);

create table suburbs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  area_id uuid not null references areas(id),
  active boolean not null default true
);
create index suburbs_area_idx on suburbs(area_id);
create index suburbs_name_lower_idx on suburbs(lower(name));

create table service_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort int not null default 0
);

create table services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  slug text not null unique,
  group_id uuid not null references service_groups(id),
  sort int not null default 0,
  active boolean not null default true
);

-- One row per service (key = service code) plus non-service rules such as
-- bundles (key = 'bundle:<name>') and the output range (key = 'range').
create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  service_id uuid references services(id),
  rule jsonb not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Partners
-- ---------------------------------------------------------------------------
create table partners (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  nzbn text,
  contact_name text not null,
  email text not null,
  mobile text not null,
  logo_url text,
  description text,
  gbp_url text,
  insurance_doc_path text,
  insurance_expiry date,
  status partner_status not null default 'applied',
  founding boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  accept_rate numeric(5,4),
  avg_response_mins numeric(8,2),
  flagged_at timestamptz,
  flag_reason text,
  applied_services text[] not null default '{}',
  applied_areas text[] not null default '{}',
  admin_notes text,
  created_at timestamptz not null default now()
);
create index partners_status_idx on partners(status);

create table partner_users (
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references partners(id) on delete cascade,
  role partner_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (user_id, partner_id)
);
create index partner_users_partner_idx on partner_users(partner_id);

create table admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table seats (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  area_id uuid not null references areas(id),
  group_id uuid not null references service_groups(id),
  status seat_status not null default 'trial',
  priority int not null default 0,
  monthly_price_cents int not null,
  trial_ends_at timestamptz,
  stripe_subscription_item_id text unique,
  past_due_since timestamptz,
  paused_at timestamptz,
  paused_reason text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index seats_cell_idx on seats(area_id, group_id) where status <> 'cancelled';
create index seats_partner_idx on seats(partner_id);

-- A partner may hold at most one live seat per cell.
create unique index seats_one_per_partner_cell
  on seats(partner_id, area_id, group_id) where status <> 'cancelled';

-- Enforce MAX_SEATS_PER_CELL live seats per (area, group).
create or replace function enforce_seat_cap() returns trigger
language plpgsql as $$
declare
  v_max int := setting_int('max_seats_per_cell', 2);
  v_count int;
begin
  if new.status = 'cancelled' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'cancelled'
     and old.area_id = new.area_id and old.group_id = new.group_id then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('seatcell:' || new.area_id::text || ':' || new.group_id::text));
  select count(*) into v_count
    from seats
   where area_id = new.area_id and group_id = new.group_id
     and status <> 'cancelled' and id <> new.id;
  if v_count >= v_max then
    raise exception 'seat cap reached for this area and service group (max %)', v_max
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger seats_cap_trg
  before insert or update of status, area_id, group_id on seats
  for each row execute function enforce_seat_cap();

-- ---------------------------------------------------------------------------
-- Leads & offers
-- ---------------------------------------------------------------------------
create table leads (
  id uuid primary key default gen_random_uuid(),
  ref_code text not null unique,
  suburb_id uuid not null references suburbs(id),
  area_id uuid not null references areas(id),
  services text[] not null check (cardinality(services) > 0),
  details jsonb not null default '{}',
  est_low_cents int,
  est_high_cents int,
  preferred_date date,
  flexible boolean not null default false,
  customer_name text,
  customer_mobile text,
  customer_email text,
  notes text,
  photo_paths text[] not null default '{}',
  consent_at timestamptz not null,
  source jsonb not null default '{}',
  status lead_status not null default 'new',
  unrouted_groups text[] not null default '{}',
  first_accepted_at timestamptz,
  feedback_requested_at timestamptz,
  closed_at timestamptz,
  pii_purged_at timestamptz,
  created_at timestamptz not null default now()
);
create index leads_status_idx on leads(status, created_at desc);
create index leads_mobile_idx on leads(customer_mobile, created_at desc);
create index leads_area_idx on leads(area_id);

create table lead_offers (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  partner_id uuid not null references partners(id),
  seat_id uuid references seats(id),
  group_id uuid not null references service_groups(id),
  kind offer_kind not null,
  round int not null default 1,
  status offer_status not null default 'offered',
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  notified_at timestamptz,
  responded_at timestamptz,
  outcome offer_outcome,
  price_cents int,
  outcome_prompted_at timestamptz,
  stripe_invoice_item_id text,
  created_at timestamptz not null default now()
);
-- A partner is offered a given lead/group at most once.
create unique index lead_offers_once_per_partner on lead_offers(lead_id, group_id, partner_id);
create index lead_offers_partner_idx on lead_offers(partner_id, offered_at desc);
create index lead_offers_pending_idx on lead_offers(expires_at) where status = 'offered';
create index lead_offers_unnotified_idx on lead_offers(offered_at) where notified_at is null and status = 'offered';

-- Never more than MAX_PARTNERS_PER_LEAD live (offered or accepted) offers per lead/group.
create or replace function enforce_offer_cap() returns trigger
language plpgsql as $$
declare
  v_max int := setting_int('max_partners_per_lead', 2);
  v_count int;
begin
  if new.status not in ('offered', 'accepted') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('offered', 'accepted') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('offercell:' || new.lead_id::text || ':' || new.group_id::text));
  select count(*) into v_count
    from lead_offers
   where lead_id = new.lead_id and group_id = new.group_id
     and status in ('offered', 'accepted') and id <> new.id;
  if v_count >= v_max then
    raise exception 'offer cap reached for this lead and service group (max %)', v_max
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger lead_offers_cap_trg
  before insert or update of status on lead_offers
  for each row execute function enforce_offer_cap();

-- ---------------------------------------------------------------------------
-- Messaging, feedback, waitlist, audit, rate limits
-- ---------------------------------------------------------------------------
create table messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  partner_id uuid references partners(id) on delete set null,
  channel message_channel not null,
  "to" text not null,
  template text not null,
  status text not null,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index messages_lead_idx on messages(lead_id);
create index messages_partner_template_idx on messages(partner_id, template);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references leads(id) on delete cascade,
  contacted boolean,
  booked boolean,
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  suburb_text text,
  service text,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  actor text not null,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on audit_log(entity, entity_id);
create index audit_log_action_idx on audit_log(action, created_at desc);

create table rate_limit_hits (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_hits_key_idx on rate_limit_hits(key, created_at desc);

-- Atomic sliding-window rate limit. Returns true if the call is allowed.
create or replace function rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql as $$
declare v_count int;
begin
  perform pg_advisory_xact_lock(hashtext('rl:' || p_key));
  select count(*) into v_count from rate_limit_hits
   where key = p_key and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_max then
    return false;
  end if;
  insert into rate_limit_hits(key) values (p_key);
  return true;
end $$;
