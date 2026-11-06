-- Storage buckets. All uploads go through server routes using the service
-- role (signed upload URLs), so no storage.objects policies are granted to
-- anon/authenticated. Insurance docs and lead photos are private; reads use
-- short-lived signed URLs generated server-side.
insert into storage.buckets (id, name, public)
values
  ('lead-photos', 'lead-photos', false),
  ('insurance-docs', 'insurance-docs', false),
  ('partner-logos', 'partner-logos', true)
on conflict (id) do nothing;
