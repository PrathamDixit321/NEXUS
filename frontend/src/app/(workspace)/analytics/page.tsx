"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type AnalyticsData = {
  total_documents: number;
  total_storage_bytes: number;
  total_chunks: number;
  total_audit_events: number;
  total_security_breaches: number;
  total_rag_queries: number;
  total_agent_tool_runs: number;
  total_tasks: number;
  pending_tasks: number;
  completed_tasks: number;
  total_reports: number;
  published_reports: number;
  classification_counts: Record<string, number>;
  collection_counts: Record<string, number>;
  recent_activity: Array<{
    id: string;
    action: string;
    user_id: string | null;
    result: string | null;
    details: string | null;
    created_at: string | null;
  }>;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  const loadAnalytics = async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch("/api/v1/analytics/overview");
      if (!res.ok) throw new Error("Failed to load analytics overview.");
      const json = await res.json();
      setData(json);
      setLastRefreshed(new Intl.DateTimeFormat("en", { timeStyle: "medium" }).format(new Date()));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retrieve analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    apiFetch("/api/v1/analytics/overview")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load analytics overview.");
        return res.json();
      })
      .then((json) => {
        if (!ignore) {
          setData(json);
          setLastRefreshed(new Intl.DateTimeFormat("en", { timeStyle: "medium" }).format(new Date()));
          setError("");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to retrieve analytics.");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 KB";
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-indigo-600">Intelligence & Performance</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Workspace Analytics</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Real-time telemetry measuring knowledge ingestion, role-based access security, AI agent throughput, and operational workflow health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-slate-400">
              Updated at {lastRefreshed}
            </span>
          )}
          <button
            onClick={loadAnalytics}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
          >
            <span className={`inline-block ${refreshing ? "animate-spin" : ""}`}>🔄</span>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-slate-500">
            <span className="animate-spin text-xl">🌀</span>
            <span className="text-sm font-medium">Aggregating workspace telemetry...</span>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Top KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Knowledge Base</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600 text-sm">📚</span>
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">{data.total_documents}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{formatBytes(data.total_storage_bytes)} stored</span>
                <span className="font-medium text-indigo-600">{data.total_chunks} chunks indexed</span>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Security & Audits</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 text-sm">🛡️</span>
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">{data.total_audit_events}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Access blocks:</span>
                <span className={`font-semibold ${data.total_security_breaches > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {data.total_security_breaches} unauthorized
                </span>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">AI Intelligence</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-600 text-sm">✨</span>
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">{data.total_rag_queries + data.total_agent_tool_runs}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{data.total_rag_queries} RAG searches</span>
                <span className="font-medium text-violet-600">{data.total_agent_tool_runs} tool calls</span>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Work Operations</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600 text-sm">📋</span>
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">{data.total_tasks}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span className="text-amber-600 font-medium">{data.pending_tasks} open</span>
                <span className="text-emerald-600 font-medium">{data.completed_tasks} completed</span>
              </div>
            </article>
          </div>

          {/* Breakdowns Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Classification Matrix */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Document Clearances Distribution</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Confidentiality levels governing enterprise access.</p>
                </div>
                <span className="text-xs font-semibold rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                  {data.total_documents} total files
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {Object.entries(data.classification_counts).map(([label, count]) => {
                  const pct = data.total_documents > 0 ? Math.round((count / data.total_documents) * 100) : 0;
                  const colorMap: Record<string, { bg: string; bar: string; text: string }> = {
                    PUBLIC: { bg: "bg-emerald-50", bar: "bg-emerald-500", text: "text-emerald-700" },
                    INTERNAL: { bg: "bg-indigo-50", bar: "bg-indigo-500", text: "text-indigo-700" },
                    CONFIDENTIAL: { bg: "bg-amber-50", bar: "bg-amber-500", text: "text-amber-700" },
                    RESTRICTED: { bg: "bg-rose-50", bar: "bg-rose-500", text: "text-rose-700" },
                  };
                  const colors = colorMap[label] || colorMap.INTERNAL;

                  return (
                    <div key={label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-semibold px-2 py-0.5 rounded-md ${colors.bg} ${colors.text}`}>
                          {label}
                        </span>
                        <span className="text-slate-600 font-medium">{count} files ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Department Collections */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Knowledge by Collection</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Scoped partitions bound to department workflows.</p>
                </div>
                <span className="text-xs font-semibold rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                  {Object.keys(data.collection_counts).length} domains
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {Object.entries(data.collection_counts).map(([colName, cnt]) => (
                  <div key={colName} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 hover:bg-slate-50 transition">
                    <p className="text-xs font-medium text-slate-500">{colName}</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{cnt}</p>
                    <p className="text-[11px] text-slate-400">Indexed documents</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Live Activity Stream */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Live Workspace Activity</h2>
                <p className="mt-0.5 text-xs text-slate-500">Recent auditable events across users, RAG queries, and security checks.</p>
              </div>
              <span className="text-xs text-slate-400">Last 10 events</span>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="pb-3">Action</th>
                    <th className="pb-3">Result</th>
                    <th className="pb-3">Details</th>
                    <th className="pb-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {data.recent_activity.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">No activity events recorded yet.</td>
                    </tr>
                  ) : (
                    data.recent_activity.map((act) => {
                      const isDenied = act.result === "DENIED" || act.action === "PERMISSION_DENIED";
                      return (
                        <tr key={act.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 font-semibold text-slate-800">
                            {act.action}
                          </td>
                          <td className="py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                isDenied
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {act.result || "SUCCESS"}
                            </span>
                          </td>
                          <td className="py-3 max-w-md truncate text-slate-500" title={act.details || ""}>
                            {act.details || "—"}
                          </td>
                          <td className="py-3 text-right text-slate-400 whitespace-nowrap">
                            {act.created_at ? new Date(act.created_at).toLocaleTimeString() : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
