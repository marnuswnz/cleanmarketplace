"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { AREAS, GROUP_BY_CODE, SERVICES, SERVICE_BY_CODE, type ServiceCode } from "@/lib/catalog";
import { DEFAULT_DETAILS, estimate, formatNzd, formatRange } from "@/lib/pricing/estimate";
import type { PricingConfig, ServiceDetails } from "@/lib/pricing/schema";
import { track } from "@/lib/analytics";
import { Alert, Button, Card, EstimateNote, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { Turnstile } from "./turnstile";

type Details = Required<ServiceDetails>;
const STEPS = ["Services", "Job details", "Where & when", "Your details"] as const;

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex gap-2" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex-1" aria-current={i === step ? "step" : undefined}>
          <div className={cx("h-1.5 rounded-full", i <= step ? "bg-brand" : "bg-line")} />
          <p className={cx("mt-1.5 hidden text-xs sm:block", i === step ? "font-semibold text-ink" : "text-muted")}>{s}</p>
        </li>
      ))}
    </ol>
  );
}

function Counter({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - 1))}>
          −
        </Button>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          className="w-20 text-center"
        />
        <Button type="button" variant="secondary" size="sm" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(Math.min(max, value + 1))}>
          +
        </Button>
      </div>
    </Field>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-3.5">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div className="flex gap-2">
        {options.map((o) => (
          <label key={String(o.v)} className={cx("flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-medium", value === o.v ? "border-brand bg-brand-soft text-brand-2" : "border-line bg-surface")}>
            <input type="radio" className="sr-only" checked={value === o.v} onChange={() => onChange(o.v)} />
            {o.l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DetailsFor({ code, d, set }: { code: ServiceCode; d: Details; set: <K extends ServiceCode>(k: K, v: Details[K]) => void }) {
  switch (code) {
    case "end_of_tenancy":
    case "deep_clean": {
      const v = d[code] as { bedrooms: number; bathrooms: number; pets?: boolean };
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Counter id={`${code}-bed`} label="Bedrooms" value={v.bedrooms} min={1} max={10} onChange={(n) => set(code, { ...v, bedrooms: n } as Details[typeof code])} />
          <Counter id={`${code}-bath`} label="Bathrooms" value={v.bathrooms} min={1} max={10} onChange={(n) => set(code, { ...v, bathrooms: n } as Details[typeof code])} />
          {code === "end_of_tenancy" && (
            <Toggle id="eot-pets" label="Pets have lived here" checked={!!v.pets} onChange={(b) => set("end_of_tenancy", { ...d.end_of_tenancy, pets: b })} />
          )}
        </div>
      );
    }
    case "carpet_clean": {
      const v = d.carpet_clean;
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Counter id="carpet-rooms" label="Carpeted rooms" value={v.rooms} min={0} max={30} onChange={(n) => set("carpet_clean", { ...v, rooms: n })} />
          <div className="space-y-2">
            <Toggle id="carpet-hall" label="Hallway (counts as a room)" checked={v.hallway} onChange={(b) => set("carpet_clean", { ...v, hallway: b })} />
            <Toggle id="carpet-stairs" label="Stairs" checked={v.stairs} onChange={(b) => set("carpet_clean", { ...v, stairs: b })} />
          </div>
        </div>
      );
    }
    case "upholstery_clean": {
      const v = d.upholstery_clean;
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Counter id="uph-seats" label="Couch / chair seats" value={v.seats} min={0} max={40} onChange={(n) => set("upholstery_clean", { ...v, seats: n })} />
          <Counter id="uph-matt" label="Mattresses" value={v.mattresses} min={0} max={10} onChange={(n) => set("upholstery_clean", { ...v, mattresses: n })} />
        </div>
      );
    }
    case "oven_clean": {
      const v = d.oven_clean;
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Segmented label="Oven" value={v.type} options={[{ v: "single", l: "Single" }, { v: "double", l: "Double" }]} onChange={(t) => set("oven_clean", { ...v, type: t })} />
          <div className="sm:pt-7">
            <Toggle id="oven-hood" label="Add rangehood" checked={v.rangehood} onChange={(b) => set("oven_clean", { ...v, rangehood: b })} />
          </div>
        </div>
      );
    }
    case "window_clean": {
      const v = d.window_clean;
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Counter id="win-count" label="Number of windows" value={v.windows} min={1} max={200} onChange={(n) => set("window_clean", { ...v, windows: n })} />
          <Segmented label="Storeys" value={v.storeys} options={[{ v: 1, l: "Single" }, { v: 2, l: "Two storey" }]} onChange={(s) => set("window_clean", { ...v, storeys: s as 1 | 2 })} />
        </div>
      );
    }
    case "house_wash": {
      const v = d.house_wash;
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Segmented label="Storeys" value={v.storeys} options={[{ v: 1, l: "Single" }, { v: 2, l: "Two storey" }]} onChange={(s) => set("house_wash", { ...v, storeys: s as 1 | 2 })} />
          <div className="sm:pt-7">
            <Toggle id="hw-roof" label="Roof spray-wash (quoted on site)" checked={v.roof} onChange={(b) => set("house_wash", { ...v, roof: b })} />
          </div>
        </div>
      );
    }
  }
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(new Date());
}

export function QuoteForm({ pricing, initialService, turnstileSiteKey }: { pricing: PricingConfig; initialService?: string; turnstileSiteKey: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<ServiceCode[]>(initialService && initialService in SERVICE_BY_CODE ? [initialService as ServiceCode] : []);
  const [details, setDetails] = useState<Details>(DEFAULT_DETAILS);
  const [suburb, setSuburb] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [flexible, setFlexible] = useState(true);
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [photos, setPhotos] = useState<{ name: string; path: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [waitlist, setWaitlist] = useState<"idle" | "open" | "done">("idle");
  const [waitEmail, setWaitEmail] = useState("");
  const onToken = useCallback((t: string | null) => setToken(t), []);

  const est = useMemo(() => estimate(services, details, pricing), [services, details, pricing]);
  const set = <K extends ServiceCode>(k: K, v: Details[K]) => setDetails((d) => ({ ...d, [k]: v }));
  const toggleService = (c: ServiceCode) => setServices((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  const groups = [...new Set(services.map((s) => SERVICE_BY_CODE[s].group))];

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0 && services.length === 0) e.services = "Choose at least one service";
    if (s === 2) {
      if (!suburb) e.suburb = "Choose your suburb";
      if (preferredDate && preferredDate < todayIso()) e.preferredDate = "Choose a future date";
    }
    if (s === 3) {
      if (!name.trim()) e.name = "Enter your name";
      if (!/^\+?[\d\s\-().]{8,}$/.test(mobile)) e.mobile = "Enter a valid NZ mobile number, e.g. 021 123 4567";
      if (email && !/^\S+@\S+\.\S+$/.test(email)) e.email = "Enter a valid email";
      if (!consent) e.consent = "Please agree so we can share your details";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validate(step)) return;
    if (step === 2 && suburb === "__other") {
      setWaitlist("open");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    if (step === 0) track("Quote Started", { services: services.join(",") });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 5 - photos.length)) {
        if (file.size > 8 * 1024 * 1024) continue;
        const r = await fetch("/api/uploads/lead-photo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentType: file.type || "image/jpeg" }),
        });
        if (!r.ok) continue;
        const { path, signedUrl } = (await r.json()) as { path: string; signedUrl: string };
        const up = await fetch(signedUrl, { method: "PUT", body: file, headers: { "content-type": file.type || "image/jpeg" } });
        if (up.ok) setPhotos((p) => [...p, { name: file.name, path }]);
      }
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate(3)) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const utm = Object.fromEntries(
        [...new URLSearchParams(window.location.search)].filter(([k]) => k.startsWith("utm_") || k === "gclid" || k === "fbclid"),
      );
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          suburb,
          services,
          details: Object.fromEntries(services.map((s) => [s, details[s]])),
          preferredDate: preferredDate || null,
          flexible,
          name,
          mobile,
          email,
          notes,
          photoPaths: photos.map((p) => p.path),
          consent,
          turnstileToken: token ?? undefined,
          utm: { ...utm, referrer: document.referrer.slice(0, 200), landing: window.location.pathname },
        }),
      });
      const json = (await res.json()) as { ok?: boolean; ref?: string; error?: string; message?: string; fields?: Record<string, string> };
      if (res.ok && json.ref) {
        track("Lead Submitted", { services: services.join(","), est_low: est.low, est_high: est.high });
        router.push(`/quote/sent/${json.ref}`);
        return;
      }
      if (json.error === "unknown_suburb") {
        setWaitlist("open");
        return;
      }
      if (json.fields) setErrors(json.fields);
      setFormError(json.message ?? "Please check the highlighted fields and try again.");
    } catch {
      setFormError("Something went wrong sending your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function joinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: waitEmail, suburb: suburb === "__other" ? "other" : suburb, service: services.join(",") }),
    });
    if (res.ok) {
      setWaitlist("done");
      track("Waitlist Joined");
    }
  }

  const summary = (
    <Card className="lg:sticky lg:top-24">
      <p className="text-sm font-semibold text-muted">Your estimate</p>
      {services.length === 0 ? (
        <p className="mt-2 text-ink-2">Choose a service to see a price.</p>
      ) : (
        <>
          <p className="mt-1 text-3xl font-bold" aria-live="polite">
            {formatRange(est.low, est.high)}
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            {est.lineItems.map((li, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-ink-2">{li.label}</span>
                <span className={cx("font-medium", li.amount < 0 && "text-ok")}>{li.amount < 0 ? `−${formatNzd(-li.amount)}` : formatNzd(li.amount)}</span>
              </li>
            ))}
          </ul>
          {est.quoteOnly.map((q) => (
            <p key={q} className="mt-2 text-sm text-warn">+ {q}</p>
          ))}
          {services.includes("end_of_tenancy") && !services.includes("carpet_clean") && !services.includes("oven_clean") && (
            <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-2">Add carpets or oven to save 10%.</p>
          )}
          <p className="mt-4 text-sm text-ink-2">
            Up to 2 businesses per service type will contact you ({groups.map((g) => GROUP_BY_CODE[g].name.toLowerCase()).join(" + ")}).
          </p>
        </>
      )}
      <EstimateNote className="mt-4" />
    </Card>
  );

  if (waitlist !== "idle") {
    return (
      <Card className="mx-auto max-w-lg">
        {waitlist === "done" ? (
          <p className="text-lg font-semibold">Thanks — we&apos;ll email you when we cover your area.</p>
        ) : (
          <form onSubmit={joinWaitlist} className="space-y-4">
            <h2 className="text-xl font-bold">We don&apos;t cover your suburb yet</h2>
            <p className="text-ink-2">We&apos;re growing across Canterbury. Leave your email and we&apos;ll let you know when local businesses are available.</p>
            <Field label="Email" htmlFor="wl-email">
              <Input id="wl-email" type="email" required autoComplete="email" value={waitEmail} onChange={(e) => setWaitEmail(e.target.value)} />
            </Field>
            <div className="flex gap-3">
              <Button type="submit">Join the waitlist</Button>
              <Button type="button" variant="ghost" onClick={() => { setWaitlist("idle"); setSuburb(""); }}>
                Choose another suburb
              </Button>
            </div>
          </form>
        )}
      </Card>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <form onSubmit={submit} noValidate className="min-w-0">
        <Stepper step={step} />
        {services.length > 0 && (
          <div className="sticky top-16 z-20 -mx-4 mb-4 flex items-center justify-between border-y border-line bg-surface/95 px-4 py-2 backdrop-blur lg:hidden">
            <span className="text-sm text-muted">Estimate</span>
            <span className="font-bold">{formatRange(est.low, est.high)}</span>
          </div>
        )}
        {formError && <Alert tone="danger" className="mb-4">{formError}</Alert>}

        {step === 0 && (
          <fieldset>
            <legend className="text-2xl font-bold">What do you need cleaned?</legend>
            <p className="mt-1 text-ink-2">Choose one or more.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {SERVICES.map((s) => (
                <label key={s.code} className={cx("flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border bg-surface p-4", services.includes(s.code) ? "border-brand ring-2 ring-brand/20" : "border-line")}>
                  <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--brand)]" checked={services.includes(s.code)} onChange={() => toggleService(s.code)} />
                  <span>
                    <span className="block font-semibold">{s.name}</span>
                    <span className="block text-sm text-muted">{s.tagline}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.services && <p className="mt-2 text-sm text-danger" role="alert">{errors.services}</p>}
          </fieldset>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Tell us about the job</h2>
            {services.map((c) => (
              <Card key={c}>
                <h3 className="mb-4 font-semibold">{SERVICE_BY_CODE[c].name}</h3>
                <DetailsFor code={c} d={details} set={set} />
              </Card>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold">Where and when?</h2>
            <Field label="Suburb" htmlFor="suburb" error={errors.suburb}>
              <Select id="suburb" value={suburb} onChange={(e) => setSuburb(e.target.value)} autoComplete="address-level2">
                <option value="">Choose your suburb…</option>
                {AREAS.map((a) => (
                  <optgroup key={a.code} label={a.name}>
                    {[...a.suburbs].sort().map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="__other">My suburb isn&apos;t listed</option>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred date (optional)" htmlFor="date" error={errors.preferredDate}>
                <Input id="date" type="date" min={todayIso()} value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
              </Field>
              <div className="sm:pt-7">
                <Toggle id="flexible" label="I'm flexible on timing" checked={flexible} onChange={setFlexible} />
              </div>
            </div>
            <Field label="Anything the business should know? (optional)" htmlFor="notes" hint="E.g. access, parking, stains, deadline for your final inspection.">
              <Textarea id="notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Field label="Photos (optional, up to 5)" htmlFor="photos" hint="Photos help businesses quote accurately. Only shared with businesses that accept your request.">
              <Input id="photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple disabled={uploading || photos.length >= 5} onChange={(e) => uploadPhotos(e.target.files)} />
            </Field>
            {uploading && <p className="text-sm text-muted">Uploading…</p>}
            {photos.length > 0 && (
              <ul className="text-sm text-ink-2">
                {photos.map((p) => (
                  <li key={p.path}>✓ {p.name}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-2xl font-bold">Who should the businesses contact?</h2>
            <Field label="Name" htmlFor="name" error={errors.name}>
              <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Mobile" htmlFor="mobile" error={errors.mobile} hint="NZ mobile — businesses will call or text you.">
              <Input id="mobile" type="tel" inputMode="tel" autoComplete="tel" placeholder="021 123 4567" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </Field>
            <Field label="Email (optional)" htmlFor="email" error={errors.email} hint="For your confirmation and updates.">
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-line bg-surface p-4 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                I agree to my name, mobile, email, suburb and job details being shared with <strong>up to 2 local businesses per service type</strong> so they can
                contact me about this quote, as described in the <Link href="/privacy" className="text-brand underline">privacy policy</Link>. I understand the price
                shown is an estimate and the business confirms the final price and is responsible for the work.
              </span>
            </label>
            {errors.consent && <p className="text-sm text-danger" role="alert">{errors.consent}</p>}
            <Turnstile siteKey={turnstileSiteKey} onToken={onToken} />
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
              ← Back
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" size="lg" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button type="submit" size="lg" disabled={submitting || uploading || (!!turnstileSiteKey && !token)}>
              {submitting ? "Sending…" : "Send my request"}
            </Button>
          )}
        </div>
        <div className="mt-8 lg:hidden">{summary}</div>
      </form>
      <aside className="hidden lg:block">{summary}</aside>
    </div>
  );
}
