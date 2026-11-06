import Link from "next/link";
import { Badge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { PARTNER_TONE, pct } from "@/lib/admin-ui";

export default async function AdminPartners({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { db } = await requireAdmin();
  let q = db.from("partners").select("id, business_name, contact_name, email, status, insurance_expiry, accept_rate, avg_response_mins, avg_rating, flagged_at, created_at, seats(status)").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data: partners } = await q;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Partners</h1>
      <nav className="flex flex-wrap gap-2">
        {["", "applied", "approved", "suspended", "churned"].map((s) => (
          <Link key={s} href={s ? `/admin/partners?status=${s}` : "/admin/partners"} className={`rounded-full border px-3 py-1 text-sm ${(status ?? "") === s ? "border-brand bg-brand-soft" : "border-line bg-surface"}`}>
            {s || "all"}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-surface-2"><tr><th className="p-3">Business</th><th className="p-3">Status</th><th className="p-3">Seats</th><th className="p-3">Insurance</th><th className="p-3">Accept</th><th className="p-3">Response</th><th className="p-3">Rating</th></tr></thead>
          <tbody>
            {(partners ?? []).map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="p-3"><Link href={`/admin/partners/${p.id}`} className="font-medium text-brand underline">{p.business_name}</Link><span className="block text-xs text-muted">{p.contact_name} · {p.email}</span></td>
                <td className="p-3"><Badge tone={PARTNER_TONE[p.status as keyof typeof PARTNER_TONE]}>{p.status}</Badge>{p.flagged_at && <Badge tone="danger" className="ml-1">flagged</Badge>}</td>
                <td className="p-3">{((p.seats as { status: string }[]) ?? []).filter((s) => s.status !== "cancelled").length}</td>
                <td className="p-3">{p.insurance_expiry ?? <span className="text-danger">none</span>}</td>
                <td className="p-3">{pct(p.accept_rate)}</td>
                <td className="p-3">{p.avg_response_mins ? `${Math.round(Number(p.avg_response_mins))}m` : "—"}</td>
                <td className="p-3">{p.avg_rating ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
