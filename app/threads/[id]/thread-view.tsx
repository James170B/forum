"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Author, EmptyState, Loading, Notice, PageIntro, ReportButton, SignInPrompt } from "@/app/components";
import { useAuth } from "@/app/providers";
import {
  formatDate,
  friendlyError,
  getSupabaseClient,
  submitBoardContent,
  type Board,
  type Post,
  type Profile,
  type Thread,
} from "@/lib/supabase";

type QuoteTarget = { body: string };

function anonymousId(userId: string, threadId: string) {
  let hash = 0x811c9dc5;
  for (const character of `${userId}:${threadId}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
  }
  return {
    value: hash.toString(16).padStart(8, "0").slice(0, 6).toUpperCase(),
    hue: hash % 360,
  };
}

function PostAuthor({
  userId,
  profile,
  threadId,
  isAnonymous,
}: {
  userId: string;
  profile?: Profile;
  threadId: string;
  isAnonymous: boolean;
}) {
  if (!isAnonymous) return <Author userId={userId} profile={profile} />;
  const tag = anonymousId(userId, threadId);
  return (
    <>
      <span className="anonymous-name">Anonymous</span>
      <span className="id-tag" style={{ backgroundColor: `hsl(${tag.hue} 48% 88%)` }}>
        ID:{tag.value}
      </span>
    </>
  );
}

function PostBody({
  body,
  targets,
}: {
  body: string;
  targets: Map<number, QuoteTarget>;
}) {
  return (
    <div className="post-card-body">
      {body.split(/\r?\n/).map((line, lineIndex) => (
        <div className={line.startsWith(">") ? "post-body-line quote-line" : "post-body-line"} key={lineIndex}>
          {line.split(/(>>\d+)/g).map((part, partIndex) => {
            const number = part.match(/^>>(\d+)$/);
            const target = number ? targets.get(Number(number[1])) : undefined;
            if (!number || !target) return part;
            return (
              <a className="quote-link" href={`#post-${number[1]}`} key={`${lineIndex}-${partIndex}`}>
                {part}
                <span className="quote-preview">{target.body.slice(0, 240)}</span>
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function ThreadView({ id }: { id: string }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const client = getSupabaseClient();
        const { data: threadData, error: threadError } = await client
          .from("threads")
          .select("id, board_id, author_id, title, body, created_at, is_anonymous")
          .eq("id", id)
          .maybeSingle();
        if (threadError) throw threadError;
        if (!threadData) {
          if (active) setThread(null);
          return;
        }
        const [boardResult, postResult] = await Promise.all([
          client.from("boards").select("id, slug, name, description").eq("id", threadData.board_id).maybeSingle(),
          client.from("posts").select("id, thread_id, author_id, body, created_at, is_anonymous").eq("thread_id", id).order("created_at"),
        ]);
        if (boardResult.error) throw boardResult.error;
        if (postResult.error) throw postResult.error;
        const allPosts = (postResult.data ?? []) as Post[];
        const authorIds = [...new Set([threadData.author_id, ...allPosts.map((post) => post.author_id)])];
        const { data: profileData, error: profileError } = await client
          .from("profiles")
          .select("id, username, bio, avatar_url, accent_color, role, banned")
          .in("id", authorIds);
        if (profileError) throw profileError;
        const profileMap = Object.fromEntries(
          ((profileData ?? []) as Profile[]).map((author) => [author.id, author]),
        );
        if (active) {
          setThread(threadData as Thread);
          setBoard(boardResult.data as Board | null);
          setPosts(allPosts);
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
  }, [id]);

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !thread) return;
    if (profile?.banned) {
      setError("This account can’t post replies.");
      return;
    }
    const form = event.currentTarget;
    const values = new FormData(form);
    const body = String(values.get("body") ?? "").trim();
    if (!body) {
      setError("Write a message before posting your reply.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await submitBoardContent<Post>("/api/posts", {
        thread_id: thread.id,
        body,
        is_anonymous: values.get("show_username") !== "on",
      });
      setPosts((current) => [...current, data]);
      if (profile) setProfiles((current) => ({ ...current, [profile.id]: profile }));
      form.reset();
      setReplyBody("");
    } catch (replyError) {
      setError(friendlyError(replyError));
    } finally {
      setBusy(false);
    }
  }

  function insertQuote(number: number) {
    const input = replyInputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const quote = `>>${number} `;
    const nextBody = `${replyBody.slice(0, start)}${quote}${replyBody.slice(end)}`;
    setReplyBody(nextBody);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + quote.length, start + quote.length);
    });
  }

  const quoteTargets = new Map<number, QuoteTarget>();
  if (thread) quoteTargets.set(1, { body: thread.body });
  posts.forEach((post, index) => quoteTargets.set(index + 2, { body: post.body }));

  return (
    <main className="page-wrap content-page">
      <div className="content-narrow">
        <div className="breadcrumb">
          <Link href="/">Boards</Link><span> / </span>
          {board ? <><Link href={`/boards/${encodeURIComponent(board.slug)}`}>{board.name}</Link><span> / </span></> : null}
          Thread
        </div>
        {loading ? (
          <Loading label="Opening the conversation…" />
        ) : !thread ? (
          <EmptyState title="Conversation not found" description="This conversation may have been removed or the address is incorrect." />
        ) : (
          <>
            <PageIntro eyebrow={board?.name ?? "Thread"} title={thread.title} />
            {error ? <Notice>{error}</Notice> : null}
            {!authLoading && user ? (
              profile?.banned ? (
                <Notice tone="info">Your account is currently unable to post.</Notice>
              ) : (
                <form className="reply-form" onSubmit={submitReply}>
                  <h2 className="form-heading">Reply</h2>
                  <div className="form-field">
                    <label className="field-label" htmlFor="reply-body">Comment</label>
                    <textarea
                      id="reply-body"
                      name="body"
                      ref={replyInputRef}
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      required
                      maxLength={10000}
                      placeholder="Write a reply…"
                    />
                  </div>
                  <label className="checkbox-field">
                    <input name="show_username" type="checkbox" />
                    Post with my username instead of Anonymous
                  </label>
                  <button className="button button-primary" disabled={busy}>{busy ? "Posting…" : "Post reply"}</button>
                </form>
              )
            ) : !authLoading ? (
              <SignInPrompt message="Log in to reply." />
            ) : null}
            <section aria-label="Posts in this thread" className="thread-posts">
              <article className="post-card" id="post-1">
                <div className="post-meta">
                  <a
                    className="post-number"
                    href="#reply-body"
                    onClick={(event) => {
                      event.preventDefault();
                      insertQuote(1);
                    }}
                  >
                    No.1
                  </a>
                  <PostAuthor
                    userId={thread.author_id}
                    profile={profiles[thread.author_id]}
                    threadId={thread.id}
                    isAnonymous={thread.is_anonymous !== false}
                  />
                  <time dateTime={thread.created_at}>{formatDate(thread.created_at)}</time>
                </div>
                <PostBody body={thread.body} targets={quoteTargets} />
                <div className="post-actions"><ReportButton targetType="thread" targetId={thread.id} /></div>
              </article>
              {posts.map((post, index) => {
                const number = index + 2;
                return (
                  <article className="post-card" id={`post-${number}`} key={post.id}>
                    <div className="post-meta">
                      <a
                        className="post-number"
                        href="#reply-body"
                        onClick={(event) => {
                          event.preventDefault();
                          insertQuote(number);
                        }}
                      >
                        No.{number}
                      </a>
                      <PostAuthor
                        userId={post.author_id}
                        profile={profiles[post.author_id]}
                        threadId={thread.id}
                        isAnonymous={post.is_anonymous !== false}
                      />
                      <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
                    </div>
                    <PostBody body={post.body} targets={quoteTargets} />
                    <div className="post-actions"><ReportButton targetType="post" targetId={post.id} /></div>
                  </article>
                );
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
