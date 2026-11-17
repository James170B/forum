"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.",
    );
  }

  client = createClient(url, key);
  return client;
}

export function friendlyError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
        ? error.message
        : "";

  if (/rate.?limit|too many requests|security purposes|over_email_send_rate_limit|429/i.test(message)) {
    return "You’ve reached a short-term rate limit. Please wait a moment and try again.";
  }
  return message || "Something went wrong. Please try again.";
}

export type Profile = {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  accent_color: string | null;
  role: string | null;
  banned: boolean | null;
};

export type Board = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

export type Thread = {
  id: string;
  board_id: string;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
  is_anonymous: boolean;
};

export type Post = {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  created_at: string;
  is_anonymous: boolean;
};

export type Message = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type Report = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  resolved: boolean;
};

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function submitBoardContent<T>(
  path: "/api/threads" | "/api/posts",
  payload: Record<string, unknown>,
): Promise<T> {
  const { data, error: sessionError } = await getSupabaseClient().auth.getSession();
  if (sessionError) throw sessionError;
  if (!data.session) throw new Error("Please log in before posting.");

  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as { data?: T; error?: string };
  if (!response.ok) throw new Error(result.error || "Your post could not be submitted.");
  if (!result.data) throw new Error("The server returned an invalid posting response.");
  return result.data;
}
