import { SERVICE_BY_CODE, type ServiceCode } from "@/lib/catalog";
import { formatNzd } from "@/lib/pricing/estimate";

type LineItem = { label: string; amount: number };

/** Human-readable job details from leads.details (stored per service + _estimate). */
export function LeadDetails({ services, details }: { services: string[]; details: Record<string, unknown> }) {
  const est = details._estimate as { lineItems?: LineItem[]; quoteOnly?: string[] } | undefined;
  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2">
        {services.map((s) => (
          <li key={s} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand-2">
            {SERVICE_BY_CODE[s as ServiceCode]?.name ?? s}
          </li>
        ))}
      </ul>
      {est?.lineItems?.length ? (
        <ul className="space-y-1 text-sm">
          {est.lineItems.map((li, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className="text-ink-2">{li.label}</span>
              <span>{li.amount < 0 ? `−${formatNzd(-li.amount)}` : formatNzd(li.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {est?.quoteOnly?.map((q) => (
        <p key={q} className="text-sm text-warn">+ {q}</p>
      ))}
    </div>
  );
}
