"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Author, Loading, Notice, PageIntro, ReportButton, SignInPrompt } from "@/app/components";
import { useAuth } from "@/app/providers";
import {
  formatDate,
  friendlyError,
  getSupabaseClient,
  type Message,
  type Profile,
} from "@/lib/supabase";

export default function ChatPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<"connecting" | "live" | "offline">("connecting");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();

    async function loadMessages() {
      try {
        const { data, error: queryError } = await client
          .from("messages")
          .select("id, author_id, body, created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (queryError) throw queryError;
        const initialMessages = ((data ?? []) as Message[]).reverse();
        const authorIds = [...new Set(initialMessages.map((message) => message.author_id))];
        let profileMap: Record<string, Profile> = {};
        if (authorIds.length) {
          const { data: authors, error: profileError } = await client
            .from("profiles")
            .select("id, username, bio, avatar_url, accent_color, role, banned")
            .in("id", authorIds);
          if (profileError) throw profileError;
          profileMap = Object.fromEntries(
            ((authors ?? []) as Profile[]).map((author) => [author.id, author]),
          );
        }
        if (active) {
          setMessages((current) => {
            const merged = new Map(
              [...initialMessages, ...current].map((message) => [message.id, message]),
            );
            return [...merged.values()].sort(
              (left, right) =>
                new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
            );
          });
          setProfiles(profileMap);
          setError(null);
        }
      } catch (loadError) {
        if (active) setError(friendlyError(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMessages();
    const channel = client
      .channel("anonymous-live-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const message = payload.new as Message;
          if (!active) return;
          setMessages((current) =>
            current.some((item) => item.id === message.id) ? current : [...current, message],
          );
          void client
            .from("profiles")
            .select("id, username, bio, avatar_url, accent_color, role, banned")
            .eq("id", message.author_id)
            .maybeSingle()
            .then(({ data, error: profileError }) => {
              if (!active) return;
              if (profileError) {
                setError(friendlyError(profileError));
              } else if (data) {
                setProfiles((current) => ({ ...current, [data.id]: data as Profile }));
              }
            });
        },
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          setConnection("live");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("offline");
        }
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || profile?.banned) {
      setError(profile?.banned ? "This account can’t send chat messages." : "Please log in to send a message.");
      return;
    }
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "").trim();
    if (!body) {
      setError("Write a message before sending.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: insertError } = await getSupabaseClient()
        .from("messages")
        .insert({ author_id: user.id, body })
        .select("id, author_id, body, created_at")
        .single();
      if (insertError) throw insertError;
      setMessages((current) =>
        current.some((message) => message.id === data.id) ? current : [...current, data as Message],
      );
      if (profile) setProfiles((current) => ({ ...current, [profile.id]: profile }));
      form.reset();
    } catch (sendError) {
      setError(friendlyError(sendError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-wrap content-page">
      <div className="content-narrow">
        <PageIntro
          eyebrow="The commons / live"
          title="The open room."
          description="A little less formal, still thoughtful. Say hello."
        />
        {error ? <Notice>{error}</Notice> : null}
        <section className="chat-panel" aria-label="Live chat">
          <div className="chat-toolbar">
            <span><span className="live-dot" />{connection === "live" ? "Live conversation" : connection === "connecting" ? "Connecting…" : "Reconnecting soon"}</span>
            <span>{messages.length} recent messages</span>
          </div>
          <div className="chat-messages" ref={listRef}>
            {loading ? (
              <Loading label="Loading the room…" />
            ) : messages.length ? (
              messages.map((message) => (
                <article className="chat-message" key={message.id}>
                  <div className="post-meta">
                    <Author userId={message.author_id} profile={profiles[message.author_id]} />
                    <span className="meta-dot">·</span>
                    <time dateTime={message.created_at}>{formatDate(message.created_at)}</time>
                  </div>
                  <p className="post-card-body">{message.body}</p>
                  <div className="post-actions"><ReportButton targetType="message" targetId={message.id} /></div>
                </article>
              ))
            ) : (
              <div className="empty-state"><span className="empty-icon">✳</span><h3>The room is quiet</h3><p>Start things off with a friendly hello.</p></div>
            )}
          </div>
          {!authLoading && user ? (
            profile?.banned ? (
              <div className="chat-form"><Notice tone="info">Your account is currently unable to post.</Notice></div>
            ) : (
              <form className="chat-form" onSubmit={sendMessage}>
                <input name="body" maxLength={2000} required placeholder="Write a message…" aria-label="Message" />
                <button className="button button-primary" disabled={busy}>{busy ? "Sending…" : "Send"} <span aria-hidden="true">↗</span></button>
              </form>
            )
          ) : !authLoading ? (
            <div className="chat-form"><SignInPrompt message="Join the room to send a message." /></div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
