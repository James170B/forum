"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { friendlyError, getSupabaseClient } from "@/lib/supabase";

export function SiteHeader() {
  const { user, profile, loading, profileError } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setError(null);
    const { error: signOutError } = await getSupabaseClient().auth.signOut();
    if (signOutError) {
      setError(friendlyError(signOutError));
      return;
    }
    router.push("/");
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link className="brand" href="/">
          <span className="brand-mark">A</span>
          <span>Anonymous</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/">Boards</Link>
          <Link href="/chat">Live chat</Link>
          {profile?.role === "admin" || profile?.role === "mod" ? (
            <Link href="/admin">Moderation</Link>
          ) : null}
        </nav>
        <div className="nav-account">
          {loading ? (
            <span className="muted small">Loading account…</span>
          ) : user ? (
            <>
              <Link className="nav-profile" href="/profile">
                {profile?.username ?? user.email}
              </Link>
              <button className="button button-quiet button-small" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link className="button button-quiet button-small" href="/login">
                Log in
              </Link>
              <Link className="button button-primary button-small" href="/signup">
                Join the forum
              </Link>
            </>
          )}
        </div>
      </div>
      {error || profileError ? <div className="header-error">{error || profileError}</div> : null}
    </header>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="intro-copy">{description}</p> : null}
      </div>
      {action ? <div className="intro-action">{action}</div> : null}
    </div>
  );
}

export function Notice({
  children,
  tone = "error",
}: {
  children: React.ReactNode;
  tone?: "error" | "success" | "info";
}) {
  return <div className={`notice notice-${tone}`} role="status">{children}</div>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="loading-state"><span className="spinner" />{label}</div>;
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">✳</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function Author({
  userId,
  profile,
  fallback,
}: {
  userId: string;
  profile?: { username?: string | null; accent_color?: string | null } | null;
  fallback?: string;
}) {
  const name = profile?.username || fallback || "Member";
  return (
    <Link
      className="author-name"
      href={`/profile?user=${encodeURIComponent(userId)}`}
      style={{ color: profile?.accent_color || "#34345c" }}
    >
      @{name}
    </Link>
  );
}

export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "thread" | "post" | "message";
  targetId: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setError("Please log in to report content.");
      return;
    }
    if (!reason.trim()) {
      setError("Please tell the moderators why you’re reporting this.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: reportError } = await getSupabaseClient().from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason: reason.trim(),
      resolved: false,
    });
    setBusy(false);
    if (reportError) {
      setError(friendlyError(reportError));
      return;
    }
    setSent(true);
    setOpen(false);
  }

  if (sent) return <span className="reported-label">Reported</span>;
  return (
    <div className="report-wrap">
      <button
        className="text-button"
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setError(null);
        }}
        aria-expanded={open}
      >
        Report
      </button>
      {open ? (
        <form className="report-popover" onSubmit={submitReport}>
          <label className="field-label" htmlFor={`report-${targetType}-${targetId}`}>
            What should moderators know?
          </label>
          <textarea
            id={`report-${targetType}-${targetId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            required
            maxLength={1000}
          />
          {error ? <p className="form-error">{error}</p> : null}
          <div className="button-row">
            <button className="button button-quiet button-small" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="button button-primary button-small" disabled={busy}>
              {busy ? "Sending…" : "Send report"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function SignInPrompt({ message }: { message: string }) {
  return (
    <div className="signin-prompt">
      <span>{message}</span>
      <Link href="/login">Log in</Link>
      <span>or</span>
      <Link href="/signup">create an account</Link>
    </div>
  );
}

export function displayError(error: unknown): string {
  return friendlyError(error);
}
