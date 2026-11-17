import {
  authenticatePostingRequest,
  containsBlockedWord,
  getConfiguredBlockedWords,
} from "@/lib/server-posting";

export async function POST(request: Request) {
  const blockedWords = getConfiguredBlockedWords();
  if (!blockedWords) {
    return Response.json(
      { error: "Posting is unavailable until FORUM_BLOCKED_WORDS is configured on the server." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "The post request must contain valid JSON." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return Response.json({ error: "The post request is invalid." }, { status: 400 });
  }
  const values = payload as Record<string, unknown>;
  const threadId = typeof values.thread_id === "string" ? values.thread_id : "";
  const body = typeof values.body === "string" ? values.body.trim() : "";
  if (!threadId || !body || body.length > 10000) {
    return Response.json({ error: "Replies need a thread and a message within the size limit." }, { status: 400 });
  }
  if (containsBlockedWord(body, blockedWords)) {
    return Response.json({ error: "Your post contains language that is not allowed on this board." }, { status: 422 });
  }

  const auth = await authenticatePostingRequest(request);
  if (auth instanceof Response) return auth;
  const { data, error } = await auth.client
    .from("posts")
    .insert({
      thread_id: threadId,
      author_id: auth.userId,
      body,
      is_anonymous: values.is_anonymous !== false,
    })
    .select("id, thread_id, author_id, body, created_at, is_anonymous")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ data }, { status: 201 });
}
