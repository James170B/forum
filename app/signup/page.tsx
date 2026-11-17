"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Notice } from "@/app/components";
import { friendlyError, getSupabaseClient } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const username = String(values.get("username") ?? "").trim();
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    setBusy(true);
    setError(null);
    setSuccess(null);

    const { data, error: signupError } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (signupError) {
      setError(friendlyError(signupError));
      setBusy(false);
      return;
    }
    if (data.session) {
      router.push("/");
      return;
    }
    setSuccess("Check your inbox for a confirmation link. You can log in once your email is confirmed.");
    setBusy(false);
    form.reset();
  }

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <p className="eyebrow">Pull up a chair</p>
        <h1>Join the conversation.</h1>
        <p className="auth-description">Create an account to start threads, reply, and meet your people.</p>
        {error ? <Notice>{error}</Notice> : null}
        {success ? <Notice tone="success">{success}</Notice> : null}
        <form className="auth-form" onSubmit={submit}>
          <div className="form-field">
            <label className="field-label" htmlFor="username">Username</label>
            <input id="username" name="username" autoComplete="username" required minLength={2} maxLength={32} />
            <p className="form-hint">This is how you’ll appear in conversations.</p>
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} />
          </div>
          <button className="button button-primary" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
        </form>
        <p className="auth-switch">Already have an account? <Link href="/login">Log in</Link></p>
      </section>
    </main>
  );
}
