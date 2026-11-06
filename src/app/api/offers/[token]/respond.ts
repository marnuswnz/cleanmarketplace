import { NextResponse } from "next/server";
import { respondToOffer } from "@/lib/offers";
import { clientIp, hash, rateLimit } from "@/lib/request";

/** Shared handler: HTML form posts get a 303 back to the offer page; JSON clients get JSON. */
export async function handleOfferResponse(req: Request, token: string, action: "accept" | "decline") {
  const wantsJson = req.headers.get("accept")?.includes("application/json");
  const ip = clientIp(req);
  if (ip && !(await rateLimit(`offer:${hash(ip)}`, 60, 30))) {
    return wantsJson ? Response.json({ error: "rate_limited" }, { status: 429 }) : new Response("Too many requests", { status: 429 });
  }
  const { result } = await respondToOffer(token, action);
  if (wantsJson) return Response.json({ result });
  return NextResponse.redirect(new URL(`/offer/${encodeURIComponent(token)}?r=${result}`, req.url), 303);
}
