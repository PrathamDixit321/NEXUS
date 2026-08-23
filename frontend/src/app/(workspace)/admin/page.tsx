"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";

type AuditLog = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  result: string | null;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

const ACTION_OPTIONS = [
  { label: "All Actions", value: "ALL" },
  { label: "Document Uploaded", value: "DOCUMENT_UPLOADED" },
  { label: "Document Viewed", value: "DOCUMENT_VIEWED" },
  { label: "Document Downloaded", value: "DOCUMENT_DOWNLOADED" },
  { label: "Permissions Changed", value: "PERMISSION_CHANGED" },
  { label: "Access Denied Alert", value: "PERMISSION_DENIED" },
  { label: "RAG Context Granted", value: "RAG_ACCESS_GRANTED" },
  { label: "RAG Context Denied", value: "RAG_ACCESS_DENIED" },
  { label: "Agent Tool Success", value: "AGENT_TOOL_ALLOWED" },
  { label: "Agent Tool Denied", value: "AGENT_TOOL_DENIED" },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Search & Filter State
  const [selectedAction, setSelectedAction] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const logsPerPage = 15;

  useEffect(() => {
    if (user?.role === "Admin" || user?.role === "CEO") {
      apiFetch("/api/v1/admin/audit-logs?limit=500")
        .then((res) => {
          if (!res.ok) throw new Error("Could not fetch system audit logs.");
          return res.json();
        })
        .then((data) => {
          setLogs(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [user]);

  // Authorization Check
  if (user?.role !== "Admin" && user?.role !== "CEO") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-rose-50 text-2xl text-rose-600 shadow-sm border border-rose-100">
          ⚠️
        </span>
        <h2 className="mt-6 text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          You do not have administrative privileges. Admin or Executive rights are required to view this area.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
        >
          Go back to Dashboard
        </Link>
      </div>
    );
  }

  // Filter logs locally based on selected filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesAction = selectedAction === "ALL" || log.action === selectedAction;
      const term = searchQuery.toLowerCase();
      const matchesSearch = 
        !searchQuery ||
        (log.user_email?.toLowerCase().includes(term) ?? false) ||
        (log.user_name?.toLowerCase().includes(term) ?? false) ||
        (log.details?.toLowerCase().includes(term) ?? false) ||
        (log.action.toLowerCase().includes(term)) ||
        (log.result?.toLowerCase().includes(term) ?? false);
      return matchesAction && matchesSearch;
    });
  }, [logs, selectedAction, searchQuery]);

  // Compute metrics from current logs state
  const metrics = useMemo(() => {
    const total = logs.length;
    const breaches = logs.filter((l) => l.action === "PERMISSION_DENIED" || l.result === "DENIED").length;
    const tools = logs.filter((l) => l.action.startsWith("AGENT_TOOL_") || l.action.startsWith("RAG_")).length;
    return { total, breaches, tools };
  }, [logs]);

  // Pagination logic
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * logsPerPage;
    return filteredLogs.slice(start, start + logsPerPage);
  }, [filteredLogs, currentPage]);

  const handlePrevPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const handleNextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPages));

  return (
    <section className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-indigo-600">Administration & Governance</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Compliance & Security Audits</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Monitor real-time workspace actions, document publication permissions changes, access blocks, and AI agent execution trace logs.
          </p>
        </div>
      </header>

      {/* Metrics Panel */}
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Audit Compliance Logs</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{metrics.total}</p>
          <p className="mt-2 text-xs text-slate-400">Total events processed</p>
        </article>
        <article className="rounded-xl border border-rose-200 bg-rose-50/20 p-5 shadow-sm">
          <p className="text-sm font-medium text-rose-700">Blocked Access Attempts</p>
          <p className="mt-2 text-3xl font-bold text-rose-950">{metrics.breaches}</p>
          <p className="mt-2 text-xs text-rose-500">Unauthorized actions intercepted</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">AI Chat & Tool Inquiries</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{metrics.tools}</p>
          <p className="mt-2 text-xs text-slate-400">RAG context & automation calls</p>
        </article>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-56">
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:bg-white"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search logs by operator, keywords or details..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-500">Retrieving security audits compliance database...</div>
        ) : error ? (
          <div className="py-20 text-center text-sm text-rose-600">Error: {error}</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-500">No matching security events logged.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Operator</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Resource Target</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">IP Address</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {paginatedLogs.map((log) => {
                  const isDenied = log.action === "PERMISSION_DENIED" || log.result === "DENIED";
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                        {new Intl.DateTimeFormat("en", {
                          dateStyle: "medium",
                          timeStyle: "medium",
                        }).format(new Date(log.created_at))}
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-800 text-xs">{log.user_name || "System"}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-40">{log.user_email || "service-account"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                          isDenied ? "bg-rose-50 text-rose-700 border-rose-100" :
                          log.action.startsWith("AGENT_TOOL_") ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                          log.action.startsWith("RAG_") ? "bg-sky-50 text-sky-700 border-sky-100" :
                          "bg-slate-50 text-slate-700 border-slate-100"
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs">
                        {log.resource_type ? (
                          <span className="font-semibold">
                            [{log.resource_type}] <span className="font-mono text-slate-400 text-[10px]">{log.resource_id?.slice(0, 8)}...</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          log.result === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          {log.result || "SUCCESS"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-mono">{log.ip_address || "127.0.0.1"}</td>
                      <td className="px-5 py-4 text-right">
                        <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {filteredLogs.length > logsPerPage && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Showing page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span> ({filteredLogs.length} events)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">Inspect Security Event</h3>
            
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[10px]">Action Trigger</span>
                  <span className="mt-1 font-bold text-slate-800 text-sm block">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[10px]">Result</span>
                  <span className={`mt-1 font-bold inline-block rounded-full px-2.5 py-0.5 text-[10px] ${
                    selectedLog.result === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  }`}>
                    {selectedLog.result || "SUCCESS"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[10px]">User Operator</span>
                  <span className="mt-1 text-slate-800 block font-medium">{selectedLog.user_name || "System account"}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[10px]">Operator Email</span>
                  <span className="mt-1 text-slate-800 block font-mono">{selectedLog.user_email || "service-account"}</span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[10px] text-xs">Event Details</span>
                <p className="mt-1.5 rounded-lg bg-slate-50 border border-slate-100 p-3 text-xs text-slate-700 leading-relaxed font-mono">
                  {selectedLog.details || "No details provided."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs border-t border-slate-100 pt-3">
                <div>
                  <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[10px]">Target Resource</span>
                  <span className="mt-1 text-slate-800 block">
                    {selectedLog.resource_type ? `${selectedLog.resource_type} (${selectedLog.resource_id})` : "None"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[10px]">Timestamp</span>
                  <span className="mt-1 text-slate-800 block">
                    {new Date(selectedLog.created_at).toISOString()}
                  </span>
                </div>
              </div>

              <div className="text-xs">
                <span className="font-semibold text-slate-400 block uppercase tracking-wider text-[10px]">User Agent</span>
                <span className="mt-1 text-slate-500 block font-mono text-[10px] bg-slate-50 border border-slate-100 p-2 rounded-lg truncate max-w-full" title={selectedLog.user_agent || ""}>
                  {selectedLog.user_agent || "N/A"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end border-t border-slate-100 pt-4">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
