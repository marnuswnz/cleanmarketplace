import { cronAuthorized } from "@/lib/auth";
import { dispatchDueOffers, expireAndReroute, routeStuckLeads } from "@/lib/offers";

export const maxDuration = 60;

/** Every 5 min: send quiet-hours offers that are now due, expire lapsed offers and re-route. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const dispatched = await dispatchDueOffers();
  const expiry = await expireAndReroute();
  const stuck = await routeStuckLeads();
  return Response.json({ dispatched, ...expiry, stuck });
}
