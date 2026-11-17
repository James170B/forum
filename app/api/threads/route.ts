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
  const boardId = typeof values.board_id === "string" ? values.board_id : "";
  const title = typeof values.title === "string" ? values.title.trim() : "";
  const body = typeof values.body === "string" ? values.body.trim() : "";
  if (!boardId || !title || !body || title.length > 180 || body.length > 10000) {
    return Response.json({ error: "Threads need a board, a subject, and a message within the size limits." }, { status: 400 });
  }
  if (containsBlockedWord(`${title}\n${body}`, blockedWords)) {
    return Response.json({ error: "Your post contains language that is not allowed on this board." }, { status: 422 });
  }

  const auth = await authenticatePostingRequest(request);
  if (auth instanceof Response) return auth;
  const { data, error } = await auth.client
    .from("threads")
    .insert({
      board_id: boardId,
      author_id: auth.userId,
      title,
      body,
      is_anonymous: values.is_anonymous !== false,
    })
    .select("id, board_id, author_id, title, body, created_at, is_anonymous")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ data }, { status: 201 });
}
