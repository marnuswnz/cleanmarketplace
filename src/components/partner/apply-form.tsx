"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AREAS, SERVICES } from "@/lib/catalog";
import { track } from "@/lib/analytics";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { Turnstile } from "@/components/quote/turnstile";

export function ApplyForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [token, setToken] = useState<string | null>(null);
  const onToken = useCallback((t: string | null) => setToken(t), []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const fd = new FormData(e.currentTarget);
    if (token) fd.set("cf-turnstile-response", token);
    const res = await fetch("/api/partners/apply", { method: "POST", body: fd });
    const json = (await res.json().catch(() => ({}))) as { fields?: Record<string, string> };
    if (res.ok) {
      setState("done");
      track("Partner Applied");
      return;
    }
    setErrors(json.fields ?? {});
    setState("error");
  }

  if (state === "done") {
    return <Alert tone="ok" className="mt-8">Thanks — application received. We&apos;ll be in touch within 2 business days.</Alert>;
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
      {state === "error" && <Alert tone="danger">Please check the highlighted fields.</Alert>}
      <Field label="Business name" htmlFor="businessName" error={errors.businessName}>
        <Input id="businessName" name="businessName" required autoComplete="organization" />
      </Field>
      <Field label="NZBN" htmlFor="nzbn" error={errors.nzbn} hint="13 digits, starting with 94.">
        <Input id="nzbn" name="nzbn" inputMode="numeric" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact name" htmlFor="contactName" error={errors.contactName}>
          <Input id="contactName" name="contactName" required autoComplete="name" />
        </Field>
        <Field label="Mobile (for lead SMS)" htmlFor="mobile" error={errors.mobile}>
          <Input id="mobile" name="mobile" type="tel" required autoComplete="tel" />
        </Field>
      </div>
      <Field label="Email (used to sign in)" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Services you offer</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SERVICES.map((s) => (
            <label key={s.code} className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface px-3 text-sm">
              <input type="checkbox" name="services" value={s.code} className="h-5 w-5 accent-[var(--brand)]" />
              {s.name}
            </label>
          ))}
        </div>
        {errors.services && <p className="mt-1 text-xs text-danger">{errors.services}</p>}
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Areas you can reliably cover</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {AREAS.map((a) => (
            <label key={a.code} className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface px-3 text-sm">
              <input type="checkbox" name="areas" value={a.code} className="h-5 w-5 accent-[var(--brand)]" />
              {a.name}
            </label>
          ))}
        </div>
        {errors.areas && <p className="mt-1 text-xs text-danger">{errors.areas}</p>}
      </fieldset>
      <Field label="Google Business Profile link (optional)" htmlFor="gbpUrl" error={errors.gbpUrl}>
        <Input id="gbpUrl" name="gbpUrl" type="url" placeholder="https://g.page/…" />
      </Field>
      <Field label="About your business (optional)" htmlFor="description">
        <Textarea id="description" name="description" maxLength={1000} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Public liability insurance certificate" htmlFor="insuranceDoc" error={errors.insuranceDoc} hint="PDF, JPG or PNG, max 4 MB.">
          <Input id="insuranceDoc" name="insuranceDoc" type="file" accept="application/pdf,image/jpeg,image/png" />
        </Field>
        <Field label="Insurance expiry date" htmlFor="insuranceExpiry" error={errors.insuranceExpiry}>
          <Input id="insuranceExpiry" name="insuranceExpiry" type="date" />
        </Field>
      </div>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" name="agree" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" />
        <span>
          I agree to the <Link href="/partner-terms" className="text-brand underline">partner terms</Link>, including the seat fee, 30-day cancellation, response
          expectations and the insurance requirement.
        </span>
      </label>
      {errors.agree && <p className="text-xs text-danger">{errors.agree}</p>}
      <Turnstile siteKey={turnstileSiteKey} onToken={onToken} />
      <Button type="submit" size="lg" disabled={state === "sending" || (!!turnstileSiteKey && !token)}>
        {state === "sending" ? "Sending…" : "Submit application"}
      </Button>
    </form>
  );
}
