"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState, Loading, Notice, PageIntro } from "@/app/components";
import { friendlyError, getSupabaseClient, type Board } from "@/lib/supabase";

export default function HomePage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [threadCounts, setThreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadBoards() {
      try {
        const client = getSupabaseClient();
        const [boardResult, threadResult] = await Promise.all([
          client.from("boards").select("id, slug, name, description").order("name"),
          client.from("threads").select("board_id"),
        ]);
        if (boardResult.error) throw boardResult.error;
        if (threadResult.error) throw threadResult.error;
        const counts = (threadResult.data ?? []).reduce<Record<string, number>>((acc, thread) => {
          acc[thread.board_id] = (acc[thread.board_id] ?? 0) + 1;
          return acc;
        }, {});
        if (active) {
          setBoards((boardResult.data ?? []) as Board[]);
          setThreadCounts(counts);
          setError(null);
        }
      } catch (loadError) {
        if (active) setError(friendlyError(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadBoards();
    return () => {
      active = false;
    };
  }, []);

  const totalThreads = Object.values(threadCounts).reduce((total, count) => total + count, 0);

  return (
    <main className="page-wrap content-page">
      <section id="boards">
        <PageIntro
          eyebrow="Boards"
          title="Anonymous"
          description="Text-only discussion. Pick a board and join in."
          action={<span className="section-count">{boards.length} boards <span>·</span> {totalThreads} threads</span>}
        />
        {error ? <Notice>{error}</Notice> : null}
        {loading ? (
          <Loading label="Finding the boards…" />
        ) : boards.length ? (
          <div className="board-grid">
            {boards.map((board, index) => (
              <Link className="board-card" href={`/boards/${encodeURIComponent(board.slug)}`} key={board.id}>
                <div className={`board-symbol board-symbol-${index % 4}`} aria-hidden="true">
                  /{board.slug}/
                </div>
                <div className="board-card-main">
                  <h2>{board.name}</h2>
                  <p>{board.description || "Text discussion."}</p>
                </div>
                <div className="board-card-footer">
                  <span>{threadCounts[board.id] ?? 0} threads</span>
                  <span className="card-arrow" aria-hidden="true">→</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No boards"
            description="There aren’t any boards to show yet."
          />
        )}
      </section>
    </main>
  );
}
