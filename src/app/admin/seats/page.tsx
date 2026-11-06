import Link from "next/link";
import { Badge } from "@/components/ui";
import { setSeatPriority } from "@/lib/admin-actions";
import { SEAT_TONE } from "@/lib/admin-ui";
import { requireAdmin } from "@/lib/auth";

export default async function AdminSeats() {
  const { db } = await requireAdmin();
  const [{ data: areas }, { data: groups }, { data: seats }] = await Promise.all([
    db.from("areas").select("id, name, code").order("sort"),
    db.from("service_groups").select("id, name, code").order("sort"),
    db.from("seats").select("id, area_id, group_id, status, priority, paused_reason, partners(id, business_name, status)").neq("status", "cancelled"),
  ]);
  const total = (areas?.length ?? 0) * (groups?.length ?? 0) * 2;
  const filled = seats?.length ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">Seat grid</h1>
        <p className="text-sm text-muted">{filled} / {total} seats filled</p>
      </div>
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-surface-2">
            <tr>
              <th className="p-3">Area</th>
              {(groups ?? []).map((g) => <th key={g.id} className="p-3">{g.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {(areas ?? []).map((a) => (
              <tr key={a.id} className="border-t border-line align-top">
                <th scope="row" className="p-3">{a.name}<span className="block text-xs font-normal text-muted">{a.code}</span></th>
                {(groups ?? []).map((g) => {
                  const cell = (seats ?? []).filter((s) => s.area_id === a.id && s.group_id === g.id);
                  return (
                    <td key={g.id} className="p-3">
                      <ul className="space-y-2">
                        {cell.map((s) => {
                          const p = s.partners as unknown as { id: string; business_name: string; status: string };
                          return (
                            <li key={s.id} className="rounded-lg border border-line p-2">
                              <Link href={`/admin/partners/${p.id}`} className="font-medium text-brand underline">{p.business_name}</Link>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                <Badge tone={SEAT_TONE[s.status as keyof typeof SEAT_TONE]}>{s.status}</Badge>
                                {p.status !== "approved" && <Badge tone="danger">{p.status}</Badge>}
                                {s.paused_reason && <Badge tone="danger">paused</Badge>}
                              </div>
                              <form action={setSeatPriority} className="mt-1 flex items-center gap-1 text-xs">
                                <input type="hidden" name="seatId" value={s.id} />
                                <label className="text-muted" htmlFor={`p-${s.id}`}>prio</label>
                                <input id={`p-${s.id}`} name="priority" type="number" defaultValue={s.priority} className="w-14 rounded border border-line px-1" />
                                <button className="text-brand underline">set</button>
                              </form>
                            </li>
                          );
                        })}
                        {Array.from({ length: Math.max(0, 2 - cell.length) }).map((_, i) => (
                          <li key={i} className="rounded-lg border border-dashed border-line p-2 text-xs text-muted">Open seat</li>
                        ))}
                      </ul>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
