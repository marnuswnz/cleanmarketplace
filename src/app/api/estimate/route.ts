import { estimate } from "@/lib/pricing/estimate";
import { loadPricing } from "@/lib/pricing/load";
import { json, zodErrors } from "@/lib/request";
import { estimateRequestSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = estimateRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid", fields: zodErrors(parsed.error.issues) }, 400);
  const pricing = await loadPricing();
  return json({ ...estimate(parsed.data.services, parsed.data.details, pricing), currency: "NZD", gstInclusive: true, isEstimate: true });
}
