"use client";

import { useEffect, useState, useMemo, FormEvent } from "react";
import { apiFetch } from "@/lib/api";

type Workflow = {
  id: string;
  title: string;
  description: string | null;
  trigger_type: string;
  webhook_slug: string | null;
  status: string;
  action_type: string;
  action_target: string | null;
  action_payload: string | null;
  total_runs: number;
  last_run_at: string | null;
  created_by_name: string | null;
  created_at: string;
};

type WorkflowRun = {
  id: string;
  workflow_id: string;
  workflow_title: string | null;
  status: string;
  triggered_by: string;
  trigger_source: string;
  execution_duration_ms: number;
  payload_summary: string | null;
  logs: string | null;
  created_at: string;
};

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  role: string;
  is_active: boolean;
  last_used_at: string | null;
  created_by_name: string | null;
  created_at: string;
};

type AutomationStats = {
  active_workflows: number;
  total_runs_today: number;
  success_rate_percent: number;
  avg_execution_ms: number;
};

const TRIGGER_BADGES: Record<string, { label: string; icon: string; bg: string; text: string }> = {
  WEBHOOK: { label: "Webhook Event", icon: "⚡", bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  SCHEDULE: { label: "Scheduled Cron", icon: "⏱️", bg: "bg-purple-50 border-purple-200", text: "text-purple-700" },
  DOCUMENT_UPLOAD: { label: "Doc Ingestion", icon: "📑", bg: "bg-amber-50 border-amber-200", text: "text-amber-700" },
  AGENT_ACTION: { label: "AI Agent Event", icon: "🤖", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  MANUAL: { label: "Manual Trigger", icon: "👆", bg: "bg-slate-50 border-slate-200", text: "text-slate-700" },
};

const ACTION_LABELS: Record<string, string> = {
  EXECUTE_AGENT_TASK: "Execute AI Agent Tool",
  TRIGGER_N8N: "Dispatch n8n Webhook",
  NOTIFY_MANAGER: "Notify Security / Manager Task",
  GENERATE_REPORT: "Synthesize Executive Report",
  SYNC_EXTERNAL_CRM: "Synchronize External Database",
};

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState<"workflows" | "runs" | "integrations">("workflows");

  // Data states
  const [stats, setStats] = useState<AutomationStats>({
    active_workflows: 6,
    total_runs_today: 312,
    success_rate_percent: 99.2,
    avg_execution_ms: 54,
  });
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTrigger, setFilterTrigger] = useState("ALL");

  // Running action indicators
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTriggerType, setNewTriggerType] = useState("WEBHOOK");
  const [newActionType, setNewActionType] = useState("EXECUTE_AGENT_TASK");
  const [newActionTarget, setNewActionTarget] = useState("support-triage");
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);

  // New API Key Modal
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRole, setNewKeyRole] = useState("Admin");
  const [createdKeyToken, setCreatedKeyToken] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Inspect Run Modal
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);

  const loadData = async () => {
    try {
      const [statsRes, wfRes, runsRes, keysRes] = await Promise.all([
        apiFetch("/api/v1/automation/stats"),
        apiFetch("/api/v1/automation/workflows"),
        apiFetch("/api/v1/automation/runs?limit=30"),
        apiFetch("/api/v1/automation/api-keys"),
      ]);

      if (statsRes.ok) {
        const sData = await statsRes.json();
        setStats(sData);
      }
      if (wfRes.ok) {
        const wfData = await wfRes.json();
        setWorkflows(wfData);
      }
      if (runsRes.ok) {
        const rData = await runsRes.json();
        setRuns(rData);
      }
      if (keysRes.ok) {
        const kData = await keysRes.json();
        setApiKeys(kData);
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    Promise.all([
      apiFetch("/api/v1/automation/stats"),
      apiFetch("/api/v1/automation/workflows"),
      apiFetch("/api/v1/automation/runs?limit=30"),
      apiFetch("/api/v1/automation/api-keys"),
    ])
      .then(async ([statsRes, wfRes, runsRes, keysRes]) => {
        if (!ignore) {
          if (statsRes.ok) setStats(await statsRes.json());
          if (wfRes.ok) setWorkflows(await wfRes.json());
          if (runsRes.ok) setRuns(await runsRes.json());
          if (keysRes.ok) setApiKeys(await keysRes.json());
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load automation data.");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Filtered workflows
  const filteredWorkflows = useMemo(() => {
    return workflows.filter((wf) => {
      const matchesSearch =
        wf.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (wf.description && wf.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (wf.action_target && wf.action_target.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesTrigger = filterTrigger === "ALL" || wf.trigger_type === filterTrigger;
      return matchesSearch && matchesTrigger;
    });
  }, [workflows, searchQuery, filterTrigger]);

  // Toggle active/paused status
  const handleToggleStatus = async (wf: Workflow) => {
    const nextStatus = wf.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await apiFetch(`/api/v1/automation/workflows/${wf.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to toggle status.");
      const updated = await res.json();
      setWorkflows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setActionSuccess(`Workflow "${wf.title}" is now ${nextStatus}.`);
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  // Trigger manual test run
  const handleTriggerRun = async (wf: Workflow) => {
    setTriggeringId(wf.id);
    try {
      const res = await apiFetch(`/api/v1/automation/workflows/${wf.id}/run`, {
        method: "POST",
        body: JSON.stringify({ payload: { source: "UI Console Instant Action" } }),
      });
      if (!res.ok) throw new Error("Execution failed.");
      const newRun: WorkflowRun = await res.json();
      setRuns((prev) => [newRun, ...prev]);
      setWorkflows((prev) =>
        prev.map((item) =>
          item.id === wf.id ? { ...item, total_runs: item.total_runs + 1, last_run_at: newRun.created_at } : item
        )
      );
      setActionSuccess(`✓ Executed "${wf.title}" in ${newRun.execution_duration_ms}ms.`);
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute workflow.");
    } finally {
      setTriggeringId(null);
    }
  };

  // Create workflow submit
  const handleCreateWorkflow = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreatingWorkflow(true);

    try {
      const res = await apiFetch("/api/v1/automation/workflows", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          trigger_type: newTriggerType,
          status: "ACTIVE",
          action_type: newActionType,
          action_target: newActionTarget.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Could not create workflow.");
      const created: Workflow = await res.json();
      setWorkflows((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
      setNewTitle("");
      setNewDescription("");
      setActionSuccess(`✓ Workflow pipeline "${created.title}" provisioned.`);
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation failed.");
    } finally {
      setCreatingWorkflow(false);
    }
  };

  // Create API key submit
  const handleCreateApiKey = async (e: FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setGeneratingKey(true);

    try {
      const res = await apiFetch("/api/v1/automation/api-keys", {
        method: "POST",
        body: JSON.stringify({
          name: newKeyName.trim(),
          role: newKeyRole,
        }),
      });

      if (!res.ok) throw new Error("Could not generate integration key.");
      const data = await res.json();
      setCreatedKeyToken(data.token);
      setApiKeys((prev) => [
        {
          id: data.id,
          name: data.name,
          key_prefix: data.key_prefix,
          role: data.role,
          is_active: data.is_active,
          last_used_at: null,
          created_by_name: data.created_by_name,
          created_at: data.created_at,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API Key.");
    } finally {
      setGeneratingKey(false);
    }
  };

  // Revoke API key
  const handleRevokeKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to revoke API Key "${keyName}"? Any external services using it will lose access.`)) {
      return;
    }
    try {
      const res = await apiFetch(`/api/v1/automation/api-keys/${keyId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke key.");
      setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
      setActionSuccess(`API Key "${keyName}" revoked.`);
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revocation failed.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 rounded-full">
              Enterprise Workflows
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-slate-500 font-medium">Orchestration Engine Online</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Workflow Automation Hub
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Orchestrate event-driven business logic, S2S webhook endpoints, n8n integrations, and autonomous AI Agent pipelines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => loadData()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5"
          >
            <span>🔄</span> Refresh
          </button>
          <button
            onClick={() => {
              setCreatedKeyToken(null);
              setNewKeyName("");
              setIsKeyModalOpen(true);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs flex items-center gap-1.5"
          >
            <span>🔑</span> S2S API Keys
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm active:scale-95 flex items-center gap-1.5"
          >
            <span>+</span> New Workflow
          </button>
        </div>
      </div>

      {/* SUCCESS / ERROR NOTICES */}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-800 flex items-center justify-between animate-fade-in shadow-xs">
          <span className="font-medium">{actionSuccess}</span>
          <button onClick={() => setActionSuccess("")} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-rose-600 hover:text-rose-900">✕</button>
        </div>
      )}

      {/* METRICS ROW */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Active Pipelines</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Healthy</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.active_workflows}</p>
          <p className="mt-1 text-xs text-slate-500">Autonomous workflow triggers</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Executions Today</span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">+18% MoM</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.total_runs_today}</p>
          <p className="mt-1 text-xs text-slate-500">Dispatched across all sources</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Success Rate</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Above SLA</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.success_rate_percent}%</p>
          <p className="mt-1 text-xs text-slate-500">Zero critical dropouts</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:border-slate-300">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Avg Latency</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Real-time</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.avg_execution_ms} ms</p>
          <p className="mt-1 text-xs text-slate-500">Fast asynchronous dispatch</p>
        </div>
      </div>

      {/* TABS HEADER */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("workflows")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === "workflows"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>⚡</span>
          <span>Pipelines & Workflows ({workflows.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("runs")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === "runs"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>📋</span>
          <span>Execution Traces ({runs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("integrations")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === "integrations"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>🔗</span>
          <span>n8n & S2S Webhooks ({apiKeys.length})</span>
        </button>
      </div>

      {/* TAB 1: WORKFLOWS */}
      {activeTab === "workflows" && (
        <div className="space-y-4">
          {/* SEARCH & FILTERS */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pipelines by title, target agent, or keywords..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 pl-9 text-xs outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition"
              />
              <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-slate-400 font-medium whitespace-nowrap text-[11px]">Trigger:</span>
              {["ALL", "WEBHOOK", "SCHEDULE", "DOCUMENT_UPLOAD", "AGENT_ACTION"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterTrigger(type)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition whitespace-nowrap ${
                    filterTrigger === type
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {type === "ALL" ? "All Triggers" : TRIGGER_BADGES[type]?.label || type}
                </button>
              ))}
            </div>
          </div>

          {/* WORKFLOW CARDS GRID */}
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <span className="ml-3 text-xs text-slate-500 font-medium">Syncing automation workforce...</span>
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <span className="text-3xl">⚡</span>
              <p className="mt-2 text-sm font-bold text-slate-700">No matching workflows found</p>
              <p className="mt-1 text-xs text-slate-400">Try changing your search keywords or filter settings.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredWorkflows.map((wf) => {
                const triggerBadge = TRIGGER_BADGES[wf.trigger_type] || TRIGGER_BADGES.WEBHOOK;
                const isPaused = wf.status === "PAUSED";
                const isTriggering = triggeringId === wf.id;

                return (
                  <div
                    key={wf.id}
                    className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-md ${
                      isPaused ? "border-slate-200 opacity-75" : "border-slate-200/90"
                    }`}
                  >
                    <div>
                      {/* CARD TOP META */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${triggerBadge.bg} ${triggerBadge.text}`}
                        >
                          <span>{triggerBadge.icon}</span>
                          <span>{triggerBadge.label}</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isPaused
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {wf.status}
                          </span>
                        </div>
                      </div>

                      {/* TITLE & DESCRIPTION */}
                      <h3 className="mt-3 text-sm font-bold text-slate-900 line-clamp-1">{wf.title}</h3>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {wf.description || "Automated event pipeline."}
                      </p>

                      {/* ACTION TARGET BADGE */}
                      <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-xs">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Action Trigger
                        </div>
                        <div className="mt-0.5 font-bold text-slate-800 text-[11px] truncate">
                          {ACTION_LABELS[wf.action_type] || wf.action_type}
                        </div>
                        {wf.action_target && (
                          <div className="mt-1 text-[10px] text-indigo-600 font-mono truncate">
                            Target: {wf.action_target}
                          </div>
                        )}
                      </div>

                      {/* WEBHOOK SLUG COPY */}
                      {wf.webhook_slug && (
                        <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200/70 bg-slate-50/50 px-2 py-1 text-[10px] text-slate-500">
                          <span className="font-mono truncate">{wf.webhook_slug}</span>
                          <button
                            onClick={() => copyToClipboard(wf.webhook_slug || "")}
                            className="ml-2 font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            Copy
                          </button>
                        </div>
                      )}
                    </div>

                    {/* CARD FOOTER */}
                    <div className="mt-5 border-t border-slate-100 pt-4 flex items-center justify-between">
                      <div className="text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-700">{wf.total_runs}</span> runs
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(wf)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition"
                        >
                          {isPaused ? "Resume" : "Pause"}
                        </button>

                        <button
                          onClick={() => handleTriggerRun(wf)}
                          disabled={isTriggering}
                          className="rounded-lg bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300 transition active:scale-95 shadow-2xs"
                        >
                          {isTriggering ? "Running..." : "Trigger"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXECUTION LOGS */}
      {activeTab === "runs" && (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Workflow Traces</h2>
              <p className="text-xs text-slate-500">Audit trail of automated and manual pipeline dispatches.</p>
            </div>
            <button
              onClick={() => loadData()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Sync Traces
            </button>
          </div>

          {runs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">No execution traces recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Pipeline</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Triggered By</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {runs.map((r) => {
                    const isSuccess = r.status === "SUCCESS";
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isSuccess
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {isSuccess ? "✓ SUCCESS" : "✕ FAILED"}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-bold text-slate-900">{r.workflow_title}</td>
                        <td className="px-5 py-3">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                            {r.trigger_source}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{r.triggered_by}</td>
                        <td className="px-5 py-3 font-mono text-slate-600">{r.execution_duration_ms} ms</td>
                        <td className="px-5 py-3 text-slate-400">
                          {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setSelectedRun(r)}
                            className="font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            Inspect →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INTEGRATIONS & API KEYS */}
      {activeTab === "integrations" && (
        <div className="space-y-6">
          {/* API KEYS SECTION */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Server-to-Server (S2S) API Keys</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Authenticate outbound n8n HTTP Request nodes, Zapier triggers, and automated bash scripts into NexusAI.
                </p>
              </div>
              <button
                onClick={() => {
                  setCreatedKeyToken(null);
                  setNewKeyName("");
                  setIsKeyModalOpen(true);
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
              >
                + Generate Integration Key
              </button>
            </div>

            {apiKeys.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                No active S2S API keys configured.
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Key Prefix</th>
                      <th className="px-4 py-2.5">Role Authority</th>
                      <th className="px-4 py-2.5">Created By</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {apiKeys.map((k) => (
                      <tr key={k.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-bold text-slate-900">{k.name}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{k.key_prefix}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            {k.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{k.created_by_name || "Admin"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRevokeKey(k.id, k.name)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CODE / N8N CONFIG GUIDE */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-900 p-6 text-white shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛠️</span>
              <h3 className="text-sm font-bold">n8n & Webhook Ingestion Configuration</h3>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              In n8n or your webhook provider, configure an HTTP Request Node sending JSON to your pipeline slug:
            </p>

            <div className="mt-4 rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-300 border border-slate-800 leading-relaxed overflow-x-auto">
              <span className="text-emerald-400 font-bold">curl</span> -X POST http://localhost:8000/api/v1/automation/webhooks/
              <span className="text-indigo-400">whk_support_email_triage</span> \<br />
              &nbsp;&nbsp;-H <span className="text-amber-300">&quot;Content-Type: application/json&quot;</span> \<br />
              &nbsp;&nbsp;-H <span className="text-amber-300">&quot;X-API-Key: nx_live_...&quot;</span> \<br />
              &nbsp;&nbsp;-d <span className="text-indigo-200">&apos;&#123;&quot;event&quot;: &quot;customer_ticket&quot;, &quot;severity&quot;: &quot;P1&quot;, &quot;content&quot;: &quot;Critical service degradation&quot;&#125;&apos;</span>
            </div>
          </div>
        </div>
      )}

      {/* CREATE WORKFLOW MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Create Workflow Pipeline</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleCreateWorkflow} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Pipeline Title</label>
                <input
                  required
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Automatic HR Policy Verification"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Briefly state what this automated pipeline does..."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Trigger Source</label>
                  <select
                    value={newTriggerType}
                    onChange={(e) => setNewTriggerType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="WEBHOOK">Webhook Event</option>
                    <option value="SCHEDULE">Scheduled Cron</option>
                    <option value="DOCUMENT_UPLOAD">Document Ingestion</option>
                    <option value="AGENT_ACTION">AI Agent Trigger</option>
                    <option value="MANUAL">Manual On-Demand</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Action Type</label>
                  <select
                    value={newActionType}
                    onChange={(e) => setNewActionType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="EXECUTE_AGENT_TASK">Execute AI Agent</option>
                    <option value="TRIGGER_N8N">Dispatch n8n Webhook</option>
                    <option value="NOTIFY_MANAGER">Notify Manager / Task</option>
                    <option value="GENERATE_REPORT">Synthesize Report</option>
                    <option value="SYNC_EXTERNAL_CRM">Sync External CRM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Target (Agent ID or Webhook URL)
                </label>
                <input
                  type="text"
                  value={newActionTarget}
                  onChange={(e) => setNewActionTarget(e.target.value)}
                  placeholder="e.g. support-triage, executive-ops, or https://n8n.internal..."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingWorkflow || !newTitle.trim()}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300 transition"
                >
                  {creatingWorkflow ? "Provisioning..." : "Create Pipeline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE API KEY MODAL */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {createdKeyToken ? "API Key Generated" : "New S2S Integration Key"}
              </h2>
              <button onClick={() => setIsKeyModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {createdKeyToken ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 leading-relaxed">
                  ⚠️ <strong>Important:</strong> Copy your token now. It will not be shown again.
                </div>
                <div className="rounded-xl bg-slate-900 p-3 text-xs font-mono text-emerald-400 break-all border border-slate-800 flex items-center justify-between gap-2">
                  <span>{createdKeyToken}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(createdKeyToken)}
                  className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                >
                  {copiedToken ? "✓ Copied to Clipboard" : "Copy Token"}
                </button>
                <div className="text-right">
                  <button
                    onClick={() => setIsKeyModalOpen(false)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateApiKey} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Integration Name</label>
                  <input
                    required
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. n8n Production Webhook"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Authority Role</label>
                  <select
                    value={newKeyRole}
                    onChange={(e) => setNewKeyRole(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  >
                    <option value="Admin">Admin (Full Access)</option>
                    <option value="Manager">Manager (Department Scope)</option>
                    <option value="Employee">Employee (Basic Access)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsKeyModalOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generatingKey || !newKeyName.trim()}
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300"
                  >
                    {generatingKey ? "Generating..." : "Generate Key"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* INSPECT RUN LOGS MODAL */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">{selectedRun.workflow_title}</h2>
                <p className="text-xs text-slate-500">
                  Triggered by {selectedRun.triggered_by} ({selectedRun.trigger_source}) • {selectedRun.execution_duration_ms} ms
                </p>
              </div>
              <button onClick={() => setSelectedRun(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="my-4 flex-1 overflow-y-auto space-y-3 text-xs">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payload Summary</div>
                <pre className="mt-1 rounded-xl bg-slate-50 border border-slate-200 p-3 font-mono text-[11px] text-slate-800 overflow-x-auto whitespace-pre-wrap">
                  {selectedRun.payload_summary || "{}"}
                </pre>
              </div>

              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Execution Log Stream</div>
                <pre className="mt-1 rounded-xl bg-slate-900 p-3.5 font-mono text-[11px] text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {selectedRun.logs || "No detailed logs provided."}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedRun(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
