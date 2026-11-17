"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Author, EmptyState, Loading, Notice, PageIntro, ReportButton, SignInPrompt } from "@/app/components";
import { useAuth } from "@/app/providers";
import {
  formatDate,
  friendlyError,
  getSupabaseClient,
  submitBoardContent,
  type Board,
  type Profile,
  type Thread,
} from "@/lib/supabase";

export default function BoardView({ slug }: { slug: string }) {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [lastReplies, setLastReplies] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const client = getSupabaseClient();
        const { data: boardData, error: boardError } = await client
          .from("boards")
          .select("id, slug, name, description")
          .eq("slug", slug)
          .maybeSingle();
        if (boardError) throw boardError;
        if (!boardData) {
          if (active) setBoard(null);
          return;
        }
        const { data: threadData, error: threadError } = await client
          .from("threads")
          .select("id, board_id, author_id, title, body, created_at, is_anonymous")
          .eq("board_id", boardData.id)
          .order("created_at", { ascending: false });
        if (threadError) throw threadError;
        const allThreads = (threadData ?? []) as Thread[];
        const threadIds = allThreads.map((thread) => thread.id);
        const replyCountMap: Record<string, number> = {};
        const lastReplyMap: Record<string, string> = {};
        if (threadIds.length) {
          const { data: replyData, error: replyError } = await client
            .from("posts")
            .select("thread_id, created_at")
            .in("thread_id", threadIds)
            .order("created_at", { ascending: false });
          if (replyError) throw replyError;
          for (const reply of replyData ?? []) {
            replyCountMap[reply.thread_id] = (replyCountMap[reply.thread_id] ?? 0) + 1;
            lastReplyMap[reply.thread_id] ??= reply.created_at;
          }
        }
        const authorIds = [...new Set(allThreads.map((thread) => thread.author_id))];
        let profileMap: Record<string, Profile> = {};
        if (authorIds.length) {
          const { data: profileData, error: profileError } = await client
            .from("profiles")
            .select("id, username, bio, avatar_url, accent_color, role, banned")
            .in("id", authorIds);
          if (profileError) throw profileError;
          profileMap = Object.fromEntries(
            ((profileData ?? []) as Profile[]).map((author) => [author.id, author]),
          );
        }
        if (active) {
          setBoard(boardData as Board);
          setThreads(
            allThreads.sort((left, right) => {
              const leftDate = lastReplyMap[left.id] ?? left.created_at;
              const rightDate = lastReplyMap[right.id] ?? right.created_at;
              return new Date(rightDate).getTime() - new Date(leftDate).getTime();
            }),
          );
          setReplyCounts(replyCountMap);
          setLastReplies(lastReplyMap);
          setProfiles(profileMap);
        }
      } catch (loadError) {
        if (active) setError(friendlyError(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [slug]);

  async function createThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !board) return;
    if (profile?.banned) {
      setError("This account can’t create new conversations.");
      return;
    }
    const form = event.currentTarget;
    const values = new FormData(form);
    const title = String(values.get("title") ?? "").trim();
    const body = String(values.get("body") ?? "").trim();
    if (!title || !body) {
      setError("Add both a title and a message to start a conversation.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await submitBoardContent<{ id: string }>("/api/threads", {
        board_id: board.id,
        title,
        body,
        is_anonymous: values.get("show_username") !== "on",
      });
      router.push(`/threads/${data.id}`);
    } catch (createError) {
      setError(friendlyError(createError));
      setBusy(false);
    }
  }

  return (
    <main className="page-wrap content-page">
      <div className="content-narrow">
        <div className="breadcrumb"><Link href="/">Boards</Link><span> / </span>{board?.name ?? "Board"}</div>
        {loading ? (
          <Loading label="Opening this board…" />
        ) : !board ? (
          <EmptyState title="Board not found" description="This board may have moved or no longer exists." />
        ) : (
          <>
            <PageIntro
              eyebrow="Board"
              title={board.name}
              description={board.description || "Text discussion."}
              action={<span className="section-count">{threads.length} threads</span>}
            />
            {error ? <Notice>{error}</Notice> : null}
            {!authLoading && user ? (
              profile?.banned ? (
                <Notice tone="info">Your account is currently unable to post.</Notice>
              ) : (
                <form className="thread-form" onSubmit={createThread}>
                  <h2 className="form-heading">Start a thread</h2>
                  <div className="form-field">
                    <label className="field-label" htmlFor="thread-title">Subject</label>
                    <input id="thread-title" name="title" required maxLength={180} placeholder="Thread subject" />
                  </div>
                  <div className="form-field">
                    <label className="field-label" htmlFor="thread-body">Comment</label>
                    <textarea id="thread-body" name="body" required maxLength={10000} placeholder="Write your post…" />
                  </div>
                  <label className="checkbox-field">
                    <input name="show_username" type="checkbox" />
                    Post with my username instead of Anonymous
                  </label>
                  <button className="button button-primary" disabled={busy}>{busy ? "Posting…" : "Post thread"}</button>
                </form>
              )
            ) : !authLoading ? (
              <SignInPrompt message="Log in to start a thread." />
            ) : null}
            {threads.length ? (
              <div className="thread-list">
                {threads.map((thread) => (
                  <article className="thread-row" key={thread.id}>
                    <Link className="thread-title" href={`/threads/${thread.id}`}>{thread.title}</Link>
                    <p className="thread-excerpt">{thread.body}</p>
                    <div className="meta-row">
                      {thread.is_anonymous !== false ? (
                        <span className="anonymous-name">Anonymous</span>
                      ) : (
                        <Author userId={thread.author_id} profile={profiles[thread.author_id]} />
                      )}
                      <span className="meta-dot">·</span>
                      <time dateTime={lastReplies[thread.id] ?? thread.created_at}>
                        {formatDate(lastReplies[thread.id] ?? thread.created_at)}
                      </time>
                      <span className="meta-dot">·</span>
                      <span>{replyCounts[thread.id] ?? 0} replies</span>
                      <span className="meta-dot">·</span>
                      <ReportButton targetType="thread" targetId={thread.id} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No threads yet" description="Start a thread to get the board going." />
            )}
          </>
        )}
      </div>
    </main>
  );
}
