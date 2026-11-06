import { NextResponse } from "next/server";
import { userDb } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const db = await userDb();
  await db.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
