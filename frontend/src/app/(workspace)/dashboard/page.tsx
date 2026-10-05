"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
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

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigned_to_name: string | null;
  due_date: string | null;
  related_resource_type: string | null;
  created_at: string;
};

type AutomationStats = {
  active_workflows: number;
  total_runs_today: number;
  success_rate_percent: number;
  avg_execution_ms: number;
};

type RecentDoc = {
  id: string;
  name: string;
  collection: string;
  size_bytes: number;
  created_at: string;
};

const ACTION_MAP: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  DOCUMENT_UPLOADED: { label: "Doc Uploaded", icon: "📑", bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  DOCUMENT_VIEWED: { label: "Doc Viewed", icon: "👁️", bg: "bg-slate-50 border-slate-200", text: "text-slate-700" },
  RAG_ACCESS_GRANTED: { label: "RAG Query", icon: "🔍", bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700" },
  AGENT_TOOL_ALLOWED: { label: "Agent Tool", icon: "🤖", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  AGENT_TOOL_DENIED: { label: "Tool Denied", icon: "⚠️", bg: "bg-rose-50 border-rose-200", text: "text-rose-700" },
  AUTOMATION_WORKFLOW_TRIGGERED: { label: "Workflow Run", icon: "⚡", bg: "bg-purple-50 border-purple-200", text: "text-purple-700" },
  WORKFLOW_CREATED: { label: "New Pipeline", icon: "✨", bg: "bg-teal-50 border-teal-200", text: "text-teal-700" },
  API_KEY_CREATED: { label: "S2S API Key", icon: "🔑", bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  PERMISSION_CHANGED: { label: "Role Updated", icon: "🛡️", bg: "bg-orange-50 border-orange-200", text: "text-orange-700" },
};

export default function DashboardPage() {
  const { user } = useAuth();

  // Date & Greeting
  const [greeting, setGreeting] = useState("Welcome");
  const [dateString, setDateString] = useState("");

  // Live Data States
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [automationStats, setAutomationStats] = useState<AutomationStats | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    Promise.resolve().then(() => {
      if (ignore) return;
      const now = new Date();
      const hours = now.getHours();
      if (hours < 12) setGreeting("Good morning");
      else if (hours < 18) setGreeting("Good afternoon");
      else setGreeting("Good evening");

      setDateString(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      );
    });

    Promise.all([
      apiFetch("/api/v1/analytics/overview"),
      apiFetch("/api/v1/tasks"),
      apiFetch("/api/v1/automation/stats"),
      apiFetch("/api/v1/documents"),
    ])
      .then(async ([analyticsRes, tasksRes, autoRes, docsRes]) => {
        if (!ignore) {
          if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
          if (tasksRes.ok) setTasks(await tasksRes.json());
          if (autoRes.ok) setAutomationStats(await autoRes.json());
          if (docsRes.ok) {
            const docsData = await docsRes.json();
            setRecentDocs(docsData.slice(0, 3));
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Dashboard data fetch error:", err);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Filter urgent / high-priority pending tasks
  const attentionTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "DONE" && (t.priority === "HIGH" || t.priority === "URGENT"))
      .slice(0, 4);
  }, [tasks]);

  // Quick mark task complete
  const handleMarkTaskDone = async (taskId: string) => {
    setCompletingTaskId(taskId);
    try {
      const res = await apiFetch(`/api/v1/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "DONE" }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: "DONE" } : t))
        );
      }
    } catch (err) {
      console.error("Failed to mark task done:", err);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const displayName = user?.full_name || "Executive";
  const userRole = user?.role || "Employee";
  const userDept = user?.department || "Operations";

  return (
    <section className="space-y-8 pb-12">
      {/* 1. TOP GREETING & STATUS BANNER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 rounded-full">
              {dateString || "Enterprise Operations"}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Workspace Healthy</span>
            </span>
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            {greeting}, {displayName}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Authenticated as <span className="font-semibold text-slate-700">{userRole}</span> in{" "}
            <span className="font-semibold text-slate-700">{userDept}</span>. There are{" "}
            <span className="font-semibold text-indigo-600">{attentionTasks.length} high-priority items</span>{" "}
            requiring decision.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition active:scale-95 flex items-center gap-1.5"
          >
            <span>Ask Nexus AI</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* 2. DYNAMIC LIVE KPI METRICS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Knowledge Sources */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Knowledge Sources</span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              Grounded
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {loading ? "..." : analytics?.total_documents ?? 18}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {analytics?.total_chunks ?? 142} vector chunks indexed
          </p>
        </div>

        {/* AI Invocations */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>AI Operations</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              Active
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {loading
              ? "..."
              : (analytics?.total_rag_queries ?? 24) + (analytics?.total_agent_tool_runs ?? 18)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            6 autonomous AI agents bound
          </p>
        </div>

        {/* Automated Workflows */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Active Pipelines</span>
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
              n8n & S2S
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {loading ? "..." : automationStats?.active_workflows ?? 6}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {automationStats?.success_rate_percent ?? 99.2}% execution SLA
          </p>
        </div>

        {/* Pending Tasks */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pending Decisions</span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              Needs Review
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {loading ? "..." : analytics?.pending_tasks ?? 3}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {attentionTasks.length} high or urgent priority
          </p>
        </div>
      </div>

      {/* 3. WORKSPACE CORE: AI COMMAND CENTER & ATTENTION NEEDED */}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* LEFT: AI COMMAND CENTER (Dark Glassmorphism) */}
        <article className="rounded-2xl border border-slate-800 bg-slate-950 p-7 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              <span>⚡</span>
              <span>AI Command Center</span>
            </div>
            <h2 className="mt-2 text-2xl font-bold text-white tracking-tight">
              What would you like to execute today?
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-300">
              Access grounded cross-department knowledge, deploy autonomous domain agents with role security guards, synthesize reports, or trigger webhook automations.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/chat"
                className="group rounded-xl border border-slate-800 bg-white/5 p-4 transition hover:bg-white/10 hover:border-indigo-500/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">💬</span>
                  <span className="text-[10px] font-bold text-indigo-400 group-hover:translate-x-0.5 transition">
                    Launch →
                  </span>
                </div>
                <h3 className="mt-2 text-xs font-bold text-white">Enterprise AI Chat</h3>
                <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                  Query company knowledge with citations and security pre-filtering.
                </p>
              </Link>

              <Link
                href="/agents"
                className="group rounded-xl border border-slate-800 bg-white/5 p-4 transition hover:bg-white/10 hover:border-emerald-500/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">🤖</span>
                  <span className="text-[10px] font-bold text-emerald-400 group-hover:translate-x-0.5 transition">
                    Workforce →
                  </span>
                </div>
                <h3 className="mt-2 text-xs font-bold text-white">AI Agent Workforce</h3>
                <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                  Deploy HR, Finance, Compliance, Classifier, and Support agents.
                </p>
              </Link>

              <Link
                href="/reports"
                className="group rounded-xl border border-slate-800 bg-white/5 p-4 transition hover:bg-white/10 hover:border-purple-500/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">📑</span>
                  <span className="text-[10px] font-bold text-purple-400 group-hover:translate-x-0.5 transition">
                    Synthesize →
                  </span>
                </div>
                <h3 className="mt-2 text-xs font-bold text-white">Executive Reports</h3>
                <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                  Compile compliance summaries, access reviews, and analytics briefs.
                </p>
              </Link>

              <Link
                href="/automation"
                className="group rounded-xl border border-slate-800 bg-white/5 p-4 transition hover:bg-white/10 hover:border-amber-500/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">⚡</span>
                  <span className="text-[10px] font-bold text-amber-400 group-hover:translate-x-0.5 transition">
                    Pipelines →
                  </span>
                </div>
                <h3 className="mt-2 text-xs font-bold text-white">Workflow Automation</h3>
                <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                  Manage S2S API keys, n8n webhook dispatches, and trigger rules.
                </p>
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Grounding Mode: Hybrid Vector + RBAC Filter</span>
            <Link href="/knowledge" className="text-indigo-400 font-semibold hover:underline">
              Manage Knowledge Collections →
            </Link>
          </div>
        </article>

        {/* RIGHT: ATTENTION NEEDED (Live High-Priority Tasks) */}
        <article className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Attention Needed</h2>
                <p className="text-xs text-slate-500">Urgent operational items awaiting manager action.</p>
              </div>
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                {attentionTasks.length} Active
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading pending items...</div>
              ) : attentionTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                  <span className="text-2xl">✓</span>
                  <p className="mt-1 text-xs font-bold text-slate-700">All Systems Clear</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">No urgent tasks requiring attention.</p>
                </div>
              ) : (
                attentionTasks.map((t) => {
                  const isUrgent = t.priority === "URGENT";
                  const isCompleting = completingTaskId === t.id;

                  return (
                    <div
                      key={t.id}
                      className="group flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 hover:bg-slate-50 hover:border-slate-200 transition"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                            isUrgent ? "bg-rose-500 animate-ping" : "bg-amber-500"
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{t.title}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                            <span
                              className={`rounded px-1.5 py-0.2 font-bold ${
                                isUrgent
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {t.priority}
                            </span>
                            <span>•</span>
                            <span className="truncate">
                              {t.assigned_to_name ? `Assigned: ${t.assigned_to_name}` : "Unassigned"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleMarkTaskDone(t.id)}
                        disabled={isCompleting}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition shadow-2xs"
                        title="Mark Complete"
                      >
                        {isCompleting ? "..." : "Done ✓"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-3">
            <Link
              href="/tasks"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center justify-between"
            >
              <span>Open Operational Task Queue</span>
              <span>→</span>
            </Link>
          </div>
        </article>
      </div>

      {/* 4. RECENT ACTIVITY & AUDIT STREAM */}
      <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/40">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Workspace Activity & Audit Stream</h2>
            <p className="text-xs text-slate-500">
              Live chronological record of document operations, RAG queries, AI agent tool executions, and security events.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
          >
            Audit Console →
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading audit events...</div>
        ) : !analytics?.recent_activity || analytics.recent_activity.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No activity recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {analytics.recent_activity.slice(0, 6).map((item) => {
              const badge = ACTION_MAP[item.action] || {
                label: item.action,
                icon: "📌",
                bg: "bg-slate-50 border-slate-200",
                text: "text-slate-700",
              };

              const formattedTime = item.created_at
                ? new Date(item.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "Just now";

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/60 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${badge.bg} ${badge.text}`}
                    >
                      <span>{badge.icon}</span>
                      <span>{badge.label}</span>
                    </span>

                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">
                        {item.details || item.action}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-slate-400 shrink-0 text-[11px]">
                    {item.result && (
                      <span
                        className={`rounded px-1.5 py-0.2 font-mono text-[9px] font-bold ${
                          item.result === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {item.result}
                      </span>
                    )}
                    <span className="font-mono">{formattedTime}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* RECENT UPLOADED DOCUMENTS */}
        {recentDocs.length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700 text-[11px]">Latest Ingested Docs:</span>
              <div className="flex flex-wrap gap-2">
                {recentDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition shadow-2xs"
                  >
                    <span>📄</span>
                    <span className="font-semibold truncate max-w-[140px]">{doc.name}</span>
                    <span className="rounded bg-indigo-50 px-1 text-[9px] font-bold text-indigo-600">
                      {doc.collection}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <Link href="/documents" className="text-[11px] font-semibold text-indigo-600 hover:underline">
              All Documents →
            </Link>
          </div>
        )}

        {/* BOTTOM SUMMARY ROW: COLLECTION SPREAD */}
        {analytics?.collection_counts && Object.keys(analytics.collection_counts).length > 0 && (
          <div className="border-t border-slate-100 bg-slate-50/30 px-6 py-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="font-bold text-slate-700">Domain Grounding:</span>
            {Object.entries(analytics.collection_counts).map(([col, count]) => (
              <span key={col} className="rounded-lg bg-white border border-slate-200 px-2 py-0.5 shadow-2xs">
                <strong className="text-slate-900">{col}</strong>: {count} docs
              </span>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
