import { cronAuthorized } from "@/lib/auth";
import { flagPartners, housekeeping, insuranceChecks } from "@/lib/cron-jobs";

export const maxDuration = 60;

/** Daily: insurance reminders + auto-pause, partner quality flags, retention housekeeping. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const insurance = await insuranceChecks();
  const flagged = await flagPartners();
  const house = await housekeeping();
  return Response.json({ insurance, flagged, ...house });
}
