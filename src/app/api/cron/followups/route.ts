import { cronAuthorized } from "@/lib/auth";
import { sendCustomerFeedbackRequests, sendPartnerOutcomePrompts } from "@/lib/cron-jobs";

export const maxDuration = 60;

/** Hourly: customer feedback (T+2d) and partner outcome prompts (T+3d). */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const feedback = await sendCustomerFeedbackRequests();
  const outcomes = await sendPartnerOutcomePrompts();
  return Response.json({ feedback, outcomes });
}
