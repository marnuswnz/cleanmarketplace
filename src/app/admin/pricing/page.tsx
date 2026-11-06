import { Alert, Button, Card, EstimateNote } from "@/components/ui";
import { savePricingRule } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/auth";
import { SERVICES } from "@/lib/catalog";
import { DEFAULT_DETAILS, estimate, formatRange } from "@/lib/pricing/estimate";
import { loadPricing } from "@/lib/pricing/load";
import { fmtDateTime } from "@/lib/admin-ui";

export default async function AdminPricing({ searchParams }: { searchParams: Promise<{ error?: string; key?: string; saved?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireAdmin();
  const { data: rows } = await db.from("pricing_rules").select("key, rule, active, updated_at").order("key");
  const cfg = await loadPricing();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pricing rules</h1>
      <p className="text-ink-2">
        NZD incl. GST. Each rule is validated before saving; invalid rules are rejected and the live site keeps the previous value. Changes apply to new
        estimates immediately (marketing pages refresh within an hour).
      </p>
      {sp.error && <Alert tone="danger">Rule “{sp.key}” not saved: {sp.error}</Alert>}
      {sp.saved && <Alert tone="ok">Saved “{sp.saved}”.</Alert>}
      <Card>
        <h2 className="font-semibold">Typical estimates with current rules</h2>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {SERVICES.map((s) => {
            const e = estimate([s.code], { [s.code]: DEFAULT_DETAILS[s.code] }, cfg);
            return <li key={s.code}>{s.name}: <strong>{formatRange(e.low, e.high)}</strong></li>;
          })}
        </ul>
        <EstimateNote className="mt-2" />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {(rows ?? []).map((r) => (
          <Card key={r.key}>
            <form action={savePricingRule} className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm font-semibold">{r.key}</h2>
                <span className="text-xs text-muted">updated {fmtDateTime(r.updated_at)}</span>
              </div>
              <input type="hidden" name="key" value={r.key} />
              <label className="sr-only" htmlFor={`rule-${r.key}`}>Rule JSON for {r.key}</label>
              <textarea
                id={`rule-${r.key}`}
                name="rule"
                spellCheck={false}
                rows={8}
                defaultValue={JSON.stringify(r.rule, null, 2)}
                className="block w-full rounded-xl border border-line bg-bg p-3 font-mono text-xs"
              />
              <Button size="sm">Validate &amp; save</Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
