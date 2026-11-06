-- Customer feedback feeds partner quality metrics.
alter table partners
  add column avg_rating numeric(3,2),
  add column contact_rate numeric(5,4);

create or replace function refresh_partner_metrics(p_partner_id uuid)
returns void language sql security definer set search_path = public as $$
  update partners p set
    accept_rate = m.accept_rate,
    avg_response_mins = m.avg_mins,
    avg_rating = f.avg_rating,
    contact_rate = f.contact_rate
  from (
    select
      case when count(*) filter (where status in ('accepted','declined','expired')) = 0 then null
           else (count(*) filter (where status = 'accepted'))::numeric
                / count(*) filter (where status in ('accepted','declined','expired')) end as accept_rate,
      avg(extract(epoch from (responded_at - offered_at)) / 60.0)
        filter (where responded_at is not null and status in ('accepted','declined')) as avg_mins
    from lead_offers
    where partner_id = p_partner_id and offered_at > now() - interval '90 days'
  ) m,
  (
    -- Feedback is per lead; attribute it to every partner that accepted it.
    select avg(fb.rating)::numeric(3,2) as avg_rating,
           case when count(fb.contacted) = 0 then null
                else (count(*) filter (where fb.contacted))::numeric / count(fb.contacted) end as contact_rate
      from feedback fb
      join lead_offers o on o.lead_id = fb.lead_id and o.status = 'accepted'
     where o.partner_id = p_partner_id and fb.created_at > now() - interval '180 days'
  ) f
  where p.id = p_partner_id
$$;
revoke all on function refresh_partner_metrics(uuid) from public, anon, authenticated;

-- Stats over each partner's last N decided offers (auto-flagging).
create or replace function partner_recent_quality(p_last int default 10)
returns table (partner_id uuid, decided bigint, accept_rate numeric, avg_response_mins numeric)
language sql stable security definer set search_path = public as $$
  select partner_id,
         count(*),
         (count(*) filter (where status = 'accepted'))::numeric / count(*),
         avg(extract(epoch from (responded_at - offered_at)) / 60.0) filter (where responded_at is not null)
    from (
      select o.*, row_number() over (partition by o.partner_id order by o.offered_at desc) rn
        from lead_offers o
        join partners p on p.id = o.partner_id and p.status = 'approved'
       where o.status in ('accepted', 'declined', 'expired')
    ) x
   where rn <= p_last
   group by partner_id
$$;
revoke all on function partner_recent_quality(int) from public, anon, authenticated;
