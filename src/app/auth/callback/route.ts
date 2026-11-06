import { NextResponse } from "next/server";
import { userDb } from "@/lib/supabase/server";

/** Magic-link landing: exchange the code for a session cookie, then continue. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/partner";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/partner";
  if (code) {
    const db = await userDb();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
