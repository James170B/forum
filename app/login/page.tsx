"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Notice } from "@/app/components";
import { friendlyError, getSupabaseClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError(null);
    const { error: loginError } = await getSupabaseClient().auth.signInWithPassword({
      email: String(values.get("email") ?? "").trim(),
      password: String(values.get("password") ?? ""),
    });
    if (loginError) {
      setError(friendlyError(loginError));
      setBusy(false);
      return;
    }
    router.push("/");
  }

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <p className="eyebrow">Good to have you back</p>
        <h1>Welcome back.</h1>
        <p className="auth-description">Log in and pick up where the conversation left off.</p>
        {error ? <Notice>{error}</Notice> : null}
        <form className="auth-form" onSubmit={submit}>
          <div className="form-field">
            <label className="field-label" htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="button button-primary" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
        </form>
        <p className="auth-switch">New around here? <Link href="/signup">Create an account</Link></p>
      </section>
    </main>
  );
}
