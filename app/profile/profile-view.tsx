"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Loading, Notice, PageIntro } from "@/app/components";
import { useAuth } from "@/app/providers";
import { friendlyError, getSupabaseClient, type Profile } from "@/lib/supabase";

const DEFAULT_ACCENT = "#34345c";

export default function ProfilePage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const requestedProfileId = searchParams.get("user");
  const [viewProfile, setViewProfile] = useState<Profile | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loadingView, setLoadingView] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    async function loadProfile() {
      const requestedId = requestedProfileId;
      const own = !requestedId || requestedId === user?.id;
      if (own && user && profile) {
        if (active) {
          setViewProfile(profile);
          setIsOwnProfile(true);
          setBio(profile.bio ?? "");
          setAvatarUrl(profile.avatar_url ?? "");
          setAccentColor(profile.accent_color || DEFAULT_ACCENT);
          setLoadingView(false);
        }
        return;
      }
      if (own && user && !profile) {
        if (active) {
          setViewProfile(null);
          setIsOwnProfile(true);
          setError("Your profile isn’t available yet. Please try again in a moment.");
          setLoadingView(false);
        }
        return;
      }
      if (own && !user) {
        if (active) {
          setViewProfile(null);
          setIsOwnProfile(false);
          setLoadingView(false);
        }
        return;
      }
      if (!requestedId) return;

      setLoadingView(true);
      try {
        const { data, error: queryError } = await getSupabaseClient()
          .from("profiles")
          .select("id, username, bio, avatar_url, accent_color, role, banned")
          .eq("id", requestedId)
          .maybeSingle();
        if (queryError) throw queryError;
        if (active) {
          setViewProfile(data as Profile | null);
          setIsOwnProfile(false);
        }
      } catch (loadError) {
        if (active) setError(friendlyError(loadError));
      } finally {
        if (active) setLoadingView(false);
      }
    }
    void loadProfile();
    return () => {
      active = false;
    };
  }, [authLoading, profile, requestedProfileId, user]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !viewProfile || !isOwnProfile) return;
    const trimmedAvatar = avatarUrl.trim();
    if (trimmedAvatar) {
      try {
        const url = new URL(trimmedAvatar);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid protocol");
      } catch {
        setError("Enter a valid http or https avatar URL, or leave it blank.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: updateError } = await getSupabaseClient()
        .from("profiles")
        .update({
          bio: bio.trim() || null,
          avatar_url: trimmedAvatar || null,
          accent_color: accentColor,
        })
        .eq("id", user.id)
        .select("id")
        .single();
      if (updateError) throw updateError;
      await refreshProfile();
      setSuccess("Your profile has been saved.");
    } catch (saveError) {
      setError(friendlyError(saveError));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loadingView) {
    return <main className="page-wrap content-page"><div className="content-medium"><Loading label="Loading your profile…" /></div></main>;
  }

  if (!user && !viewProfile) {
    return (
      <main className="auth-layout">
        <section className="auth-panel">
          <p className="eyebrow">Your corner of the commons</p>
          <h1>Your profile.</h1>
          <p className="auth-description">Log in to edit your bio, avatar URL, and accent color.</p>
          <Link className="button button-primary" href="/login">Log in</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap content-page">
      <div className="content-medium">
        <PageIntro eyebrow="Your corner of the commons" title={isOwnProfile ? "Your profile." : "Member profile."} />
        {error ? <Notice>{error}</Notice> : null}
        {success ? <Notice tone="success">{success}</Notice> : null}
        {!viewProfile ? (
          <div className="empty-state"><h3>Profile not found</h3><p>This member profile isn’t available.</p></div>
        ) : (
          <div className="profile-layout">
            <aside className="profile-aside">
              <div className="profile-avatar" style={{ backgroundColor: `${viewProfile.accent_color || DEFAULT_ACCENT}22` }}>
                {viewProfile.avatar_url ? (
                  // Avatar images are user-provided URLs; no upload or remote image optimization is used.
                  <img src={viewProfile.avatar_url} alt={`${viewProfile.username}'s avatar`} />
                ) : (
                  <span>{viewProfile.username.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <h2 style={{ color: viewProfile.accent_color || DEFAULT_ACCENT }}>@{viewProfile.username}</h2>
              <p>{viewProfile.bio || (isOwnProfile ? "Add a few words about yourself." : "No bio yet.")}</p>
              {viewProfile.role && viewProfile.role !== "user" ? <span className="eyebrow">{viewProfile.role}</span> : null}
            </aside>
            {isOwnProfile ? (
              <form className="profile-card" onSubmit={saveProfile}>
                <h2>Edit your profile</h2>
                <div className="form-field">
                  <label className="field-label" htmlFor="bio">Bio</label>
                  <textarea id="bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} placeholder="A little about you…" />
                  <p className="form-hint">{bio.length}/500 characters</p>
                </div>
                <div className="form-field">
                  <label className="field-label" htmlFor="avatar-url">Avatar URL</label>
                  <input id="avatar-url" type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://example.com/avatar.jpg" />
                  <p className="form-hint">Paste an image URL. File uploads aren’t supported.</p>
                </div>
                <div className="form-field">
                  <label className="field-label" htmlFor="accent-color">Accent color</label>
                  <div className="color-field">
                    <input id="accent-color" type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} />
                    <span className="muted small">{accentColor}</span>
                  </div>
                </div>
                <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
              </form>
            ) : (
              <section className="profile-card">
                <h2>About @{viewProfile.username}</h2>
                <p className="post-card-body">{viewProfile.bio || "This member hasn’t written a bio yet."}</p>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
