"use client";

import { useState } from "react";
import { browserDb } from "@/lib/supabase/browser";
import { Alert, Button, Field, Input } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await browserDb().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: false,
      },
    });
    // Don't reveal whether the email exists.
    setState(error && error.status !== 400 && error.status !== 422 ? "error" : "sent");
  }

  if (state === "sent") {
    return <Alert tone="ok" className="mt-6">If {email} has a partner account, a sign-in link is on its way. Check your inbox.</Alert>;
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Field label="Email" htmlFor="email">
        <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {state === "error" && <Alert tone="danger">Couldn&apos;t send the link. Please try again.</Alert>}
      <Button type="submit" className="w-full" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
