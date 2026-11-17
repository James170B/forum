import { Suspense } from "react";
import BoardView from "./board-view";

export default function BoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<div className="loading-state">Opening this board…</div>}>
      <BoardContent params={params} />
    </Suspense>
  );
}

async function BoardContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BoardView slug={slug} />;
}
