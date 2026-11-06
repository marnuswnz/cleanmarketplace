# [BRAND] — Christchurch cleaning lead marketplace (MVP)

Customers get an instant price estimate and their request is routed automatically to **up to 2 partner
businesses per service group**. Partners pay a monthly fee per area seat (Stripe Billing); overflow leads
are billed per accepted lead. No job payments go through the platform.

Stack: Next.js 16 (App Router, TypeScript, Tailwind v4) on Vercel · Supabase (Postgres + RLS, Auth magic
link, Storage) · Stripe Billing + Customer Portal · Twilio or ClickSend SMS · Resend email · Vercel Cron.

## Quick start

```bash
npm install
cp .env.example .env.local            # fill in Supabase keys at minimum
supabase db push                      # or run supabase/migrations/*.sql in order
psql "$DATABASE_URL" -f supabase/seed.sql
npm run dev
```

With `DRY_RUN_MESSAGES=true` (default outside production) SMS and email are logged to the console and still
recorded in the `messages` table.

### Creating the first admin

1. Supabase dashboard → Authentication → Users → *Invite user* with your email.
2. `insert into admin_users (user_id) select id from auth.users where email = 'you@example.co.nz';`
3. Sign in at `/login` (magic link) and open `/admin`.

Partners get their auth user and `partner_users` link automatically when you click **Approve** in
`/admin/partners/[id]`.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests: estimator (every service), routing engine (incl. acceptance scenarios), quiet hours, validation |
| `npm run test:db` | Spins up a throwaway Postgres 15+, applies migrations + seed (twice, for idempotency), runs `supabase/tests/*.test.sql` (RLS, seat/offer caps, accept/decline RPCs) |
| `npm run typecheck` / `npm run lint` / `npm run build` | Static checks and production build |
| `npm run db:seed:gen` | Regenerates `supabase/seed.sql` from `src/lib/catalog.ts` and default pricing |

## How it fits together

```
src/lib/catalog.ts          Areas, suburbs, services, groups, adjacency — seed + marketing copy
src/lib/pricing/            Pure estimator (shared client/server), zod rule schemas, DB loader
src/lib/routing.ts          Pure routing engine: eligibility, ranking, per-group planning, routeLead()
src/lib/routing-store.ts    Supabase implementation of the RoutingStore interface
src/lib/offers.ts           Offer notifications, accept/decline, expiry → re-route, quiet-hours dispatch
src/lib/messaging/          SmsProvider (Twilio | ClickSend | dry-run), Resend email, templates
src/lib/billing.ts          Stripe customers, seat subscription items, overflow invoice items, portal
src/lib/cron-jobs.ts        Feedback/outcome follow-ups, insurance reminders + auto-pause, flags, retention
supabase/migrations/        Schema, RLS + RPCs, storage buckets, feedback metrics
```

### Routing rules (as built)

1. Suburb → area via the `suburbs` table (unknown suburb → waitlist). Services split into groups
   (HOME / CARPET / EXTERIOR); each group routes independently.
2. Candidates: seats in the lead's area + group where the partner is `approved`, insurance expiry ≥ today
   (NZ), seat not paused, and status `trial`/`active` — or `past_due` for up to 7 days.
3. Ranked by priority ↓, accept rate ↓ (no history = 0.75), offers in the last 7 days ↑.
4. Up to `MAX_PARTNERS_PER_LEAD` live offers per group, TTL `OFFER_TTL_MINUTES`. SMS + email sent
   immediately (via `after()` on lead submit).
5. Quiet hours 20:00–07:00 NZT: offers are created with `offered_at` = 07:00 and the TTL starts then; the
   5-minute cron sends them, so partners get them between 07:00 and 07:05.
6. Decline/expiry → next candidate. No seat holders left → overflow to partners with a seat in that group
   in an adjacent area (`area_adjacency`), billed `OVERFLOW_PRICE_CENTS` on accept. After 2 overflow rounds
   with nobody accepting → group is `unrouted`, admin is emailed, customer is told we're still looking.
7. Hard guarantees in Postgres, not just app code: a trigger caps live offers per lead/group, a unique index
   prevents re-offering a partner, `accept_offer()` locks and refuses a 3rd acceptance, and a trigger caps
   live seats per cell at `app_settings.max_seats_per_cell`.

### Security model

- RLS on every table. Partners read only their own partner row, seats and offers, and a lead **only after
  they hold an accepted offer for it**. Pre-acceptance inbox data comes from `get_partner_offers()`, which
  nulls customer contact fields. Partners can update only profile columns and the outcome of accepted
  offers (column grants). Admins (`admin_users`) read everything; admin writes go through server actions
  that check `is_admin()` then use the service role.
- Public writes (leads, waitlist, applications, feedback) only through server routes using the service role,
  with zod validation, Turnstile, Postgres-backed rate limits (IP and mobile), a honeypot and duplicate
  detection (same mobile + overlapping service within 7 days).
- Offer links are 192-bit random tokens; accept/decline are POST-only (SMS link previewers can't accept),
  idempotent, and expired tokens show a friendly page.

## Deploying

1. Create the Supabase project, run migrations and seed, configure Auth → URL configuration with
   `${SITE_URL}/auth/callback` as a redirect URL. Set the magic-link email template.
2. Stripe: create two recurring monthly prices (standard, large) → `STRIPE_PRICE_SEAT_*`. Enable the
   Customer Portal. Webhook endpoint `${SITE_URL}/api/stripe/webhook` with events
   `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`.
3. Vercel: set env vars from `.env.example`. `vercel.json` registers the crons; Vercel sends
   `Authorization: Bearer $CRON_SECRET` automatically.
4. Twilio: an NZ-capable sender; Twilio handles STOP opt-outs on long codes.

## Placeholders to replace before launch

- Brand name/emails/legal entity (`NEXT_PUBLIC_BRAND_*` env vars, `src/lib/brand.ts`).
- Design tokens in `src/app/globals.css` — the Claude Design export wasn't included with the spec, so the
  UI uses a neutral, accessible token set that every component reads from.
- All prices (pricing rules and seat prices) are placeholders; edit at `/admin/pricing` and `app_settings`.
- Legal pages are drafts for review by an NZ lawyer.
