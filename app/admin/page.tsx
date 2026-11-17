"use client";

import { useEffect, useState } from "react";
import { Author, EmptyState, Loading, Notice, PageIntro } from "@/app/components";
import { useAuth } from "@/app/providers";
import {
  friendlyError,
  getSupabaseClient,
  type Profile,
  type Report,
} from "@/lib/supabase";

type ReportItem = Report & {
  reporter?: Profile;
  targetSummary: string;
};

const TABLE_BY_TYPE: Record<string, string> = {
  thread: "threads",
  post: "posts",
  message: "messages",
};

export default function AdminPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (profile?.role !== "admin" && profile?.role !== "mod")) return;

    let active = true;
    async function loadReports() {
      setLoading(true);
      setError(null);
      try {
        const client = getSupabaseClient();
        const { data: reportData, error: reportError } = await client
          .from("reports")
          .select("id, reporter_id, target_type, target_id, reason, resolved")
          .eq("resolved", false);
        if (reportError) throw reportError;
        const list = (reportData ?? []) as Report[];
        const reporterIds = [...new Set(list.map((report) => report.reporter_id))];
        const targetTypes = [...new Set(list.map((report) => report.target_type))];
        const [profileResult, ...targetResults] = await Promise.all([
          reporterIds.length
            ? client.from("profiles").select("id, username, bio, avatar_url, accent_color, role, banned").in("id", reporterIds)
            : Promise.resolve({ data: [], error: null }),
          ...targetTypes.map((type) => {
            const ids = list.filter((report) => report.target_type === type).map((report) => report.target_id);
            if (!ids.length) return Promise.resolve({ data: [], error: null });
            if (type === "thread") return client.from("threads").select("id, title, body").in("id", ids);
            if (type === "post") return client.from("posts").select("id, body").in("id", ids);
            if (type === "message") return client.from("messages").select("id, body").in("id", ids);
            return Promise.resolve({ data: [], error: null });
          }),
        ]);
        if (profileResult.error) throw profileResult.error;
        targetResults.forEach((result) => {
          if (result.error) throw result.error;
        });
        const reporterMap = Object.fromEntries(
          ((profileResult.data ?? []) as Profile[]).map((reporter) => [reporter.id, reporter]),
        );
        const targetMap: Record<string, { title?: string; body?: string }> = {};
        targetResults.forEach((result, index) => {
          for (const target of result.data ?? []) {
            targetMap[`${targetTypes[index]}:${target.id}`] = target;
          }
        });
        const enriched = list.map((report) => {
          const target = targetMap[`${report.target_type}:${report.target_id}`];
          return {
            ...report,
            reporter: reporterMap[report.reporter_id],
            targetSummary: target
              ? target.title
                ? `${target.title}\n${target.body ?? ""}`
                : target.body ?? "(empty content)"
              : "The reported content is no longer available.",
          };
        });
        if (active) setReports(enriched);
      } catch (loadError) {
        if (active) setError(friendlyError(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadReports();
    return () => {
      active = false;
    };
  }, [authLoading, profile?.role, user]);

  const canModerate = profile?.role === "admin" || profile?.role === "mod";

  async function resolveReport(report: ReportItem) {
    setBusyId(report.id);
    setError(null);
    try {
      const { error: updateError } = await getSupabaseClient()
        .from("reports")
        .update({ resolved: true })
        .eq("id", report.id)
        .select("id")
        .single();
      if (updateError) throw updateError;
      setReports((current) => current.filter((item) => item.id !== report.id));
    } catch (resolveError) {
      setError(friendlyError(resolveError));
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTarget(report: ReportItem) {
    const table = TABLE_BY_TYPE[report.target_type];
    if (!table) {
      setError(`This report has an unsupported target type: ${report.target_type}.`);
      return;
    }
    if (!window.confirm("Delete this content? This action can’t be undone.")) return;
    setBusyId(report.id);
    setError(null);
    try {
      const { data: deleted, error: deleteError } = await getSupabaseClient()
        .from(table)
        .delete()
        .eq("id", report.target_id)
        .select("id")
        .maybeSingle();
      if (deleteError) throw deleteError;
      if (!deleted) throw new Error("The content was not found or could not be deleted.");
      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? { ...item, targetSummary: "Content deleted. Resolve this report to clear it from the queue." }
            : item,
        ),
      );
    } catch (deleteError) {
      setError(friendlyError(deleteError));
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading || (loading && (canModerate || (user !== null && profile === null)))) {
    return <main className="page-wrap content-page"><div className="content-medium"><Loading label="Loading the moderation queue…" /></div></main>;
  }

  if (!user || !canModerate) {
    return (
      <main className="page-wrap content-page">
        <div className="content-medium">
          <PageIntro eyebrow="The commons / staff" title="Moderation." />
          <div className="access-denied">
            <h2>This room is for moderators.</h2>
            <p>You need an admin or moderator account to review reports.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-wrap content-page">
      <div className="content-medium">
        <PageIntro
          eyebrow="The commons / staff"
          title="Moderation queue."
          description="Review reports and keep the conversation useful for everyone."
          action={<span className="section-count">{reports.length} unresolved</span>}
        />
        {error ? <Notice>{error}</Notice> : null}
        {reports.length ? (
          <div className="moderation-list">
            {reports.map((report) => (
              <article className="report-card" key={report.id}>
                <div>
                  <div className="post-meta">
                    <span className="eyebrow">{report.target_type}</span>
                    <span className="meta-dot">·</span>
                    <span>Reported by</span>
                    <Author userId={report.reporter_id} profile={report.reporter} />
                  </div>
                  <p className="report-detail">{report.targetSummary}</p>
                  <p className="report-reason"><strong>Reason:</strong> {report.reason}</p>
                  <p className="report-reason">Target ID: {report.target_id}</p>
                </div>
                <div className="moderation-actions">
                  <button className="button button-quiet button-small" disabled={busyId === report.id} onClick={() => void resolveReport(report)}>
                    {busyId === report.id ? "Working…" : "Mark resolved"}
                  </button>
                  <button className="button button-danger button-small" disabled={busyId === report.id} onClick={() => void deleteTarget(report)}>
                    Delete content
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="All caught up" description="There are no unresolved reports right now." />
        )}
      </div>
    </main>
  );
}
