import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getConfiguredBlockedWords(): string[] | null {
  const configured = process.env.FORUM_BLOCKED_WORDS;
  if (!configured?.trim()) return null;
  const words = configured
    .split(/[,\r\n]/)
    .map((word) => word.trim())
    .filter(Boolean);
  return words.length ? words : null;
}

export function containsBlockedWord(text: string, blockedWords: string[]): boolean {
  const normalized = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return blockedWords.some((word) => {
    const tokens = word
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!tokens.length) return false;
    const pattern = tokens
      .map((token) => [...token].map(escapeRegExp).join("[^a-z0-9]*"))
      .join("[^a-z0-9]+");
    return new RegExp(`(?:^|[^a-z0-9])${pattern}(?=$|[^a-z0-9])`).test(normalized);
  });
}

export async function authenticatePostingRequest(
  request: Request,
): Promise<{ client: SupabaseClient; userId: string } | Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return Response.json({ error: "Please log in before posting." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !serviceRoleKey) {
    return Response.json(
      { error: "Supabase server posting is not configured." },
      { status: 503 },
    );
  }

  const userClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) {
    return Response.json({ error: "Your session is invalid or has expired. Please log in again." }, { status: 401 });
  }
  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("banned")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 500 });
  }
  if (profile?.banned) {
    return Response.json({ error: "This account can’t post." }, { status: 403 });
  }
  const postingClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { client: postingClient, userId: data.user.id };
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
