import { Suspense } from "react";
import ThreadView from "./thread-view";

export default function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="loading-state">Opening the conversation…</div>}>
      <ThreadContent params={params} />
    </Suspense>
  );
}

async function ThreadContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ThreadView id={id} />;
}
