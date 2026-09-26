"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";

type Report = {
  id: string;
  title: string;
  description: string | null;
  report_type: "EXECUTIVE_SUMMARY" | "COMPLIANCE_AUDIT" | "ACCESS_CONTROL" | "KNOWLEDGE_USAGE";
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  generated_by_name: string | null;
  content: string | null;
  created_at: string;
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Inspect Drawer State
  const [activeReport, setActiveReport] = useState<Report | null>(null);

  // Generate Report Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [genType, setGenType] = useState<Report["report_type"]>("COMPLIANCE_AUDIT");
  const [genNotes, setGenNotes] = useState("");
  const [generating, setGenerating] = useState(false);

  const fetchReports = async () => {
    try {
      const res = await apiFetch("/api/v1/reports");
      if (!res.ok) throw new Error("Could not load reports.");
      const data = await res.json();
      setReports(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    apiFetch("/api/v1/reports")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load reports.");
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setReports(data);
          setError("");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load reports.");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGenerating(true);
      const res = await apiFetch("/api/v1/reports/generate", {
        method: "POST",
        body: JSON.stringify({
          report_type: genType,
          custom_notes: genNotes.trim() || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setReports((prev) => [created, ...prev]);
        setIsModalOpen(false);
        setGenNotes("");
        setActiveReport(created); // Automatically open the newly generated report
      }
    } catch (err) {
      console.error("Failed to generate report:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      const res = await apiFetch(`/api/v1/reports/${reportId}`, { method: "DELETE" });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
        if (activeReport?.id === reportId) setActiveReport(null);
      }
    } catch (err) {
      console.error("Failed to delete report:", err);
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchesType = filterType === "ALL" || r.report_type === filterType;
      const term = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        r.title.toLowerCase().includes(term) ||
        (r.description?.toLowerCase().includes(term) ?? false);
      return matchesType && matchesSearch;
    });
  }, [reports, filterType, searchQuery]);

  const metrics = useMemo(() => {
    const total = reports.length;
    const compliance = reports.filter((r) => r.report_type === "COMPLIANCE_AUDIT").length;
    const executive = reports.filter((r) => r.report_type === "EXECUTIVE_SUMMARY").length;
    const knowledge = reports.filter((r) => r.report_type === "KNOWLEDGE_USAGE").length;
    return { total, compliance, executive, knowledge };
  }, [reports]);

  const typeBadge = (t: Report["report_type"]) => {
    const map = {
      COMPLIANCE_AUDIT: { label: "Compliance Audit", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      EXECUTIVE_SUMMARY: { label: "Executive Summary", bg: "bg-indigo-50 text-indigo-700 border-indigo-200" },
      KNOWLEDGE_USAGE: { label: "Knowledge Usage", bg: "bg-violet-50 text-violet-700 border-violet-200" },
      ACCESS_CONTROL: { label: "Access Control", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    }[t] || { label: t, bg: "bg-slate-50 text-slate-700 border-slate-200" };

    return (
      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${map.bg}`}>
        {map.label}
      </span>
    );
  };

  const parsedContent = useMemo(() => {
    if (!activeReport?.content) return null;
    try {
      return JSON.parse(activeReport.content);
    } catch {
      return null;
    }
  }, [activeReport]);

  return (
    <section className="space-y-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-indigo-600">Enterprise Reporting</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Intelligence & Audit Reports</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Synthesize real-time operational data into executive summaries, security clearance evaluations, and knowledge telemetry briefs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchReports}
            title="Refresh reports archive"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition active:scale-95"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition active:scale-95"
          >
            <span>⚡</span> Generate Live Report
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Total Reports</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-emerald-600">Compliance Audits</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.compliance}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-indigo-600">Executive Summaries</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.executive}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-violet-600">Knowledge Reviews</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.knowledge}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search reports by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-3 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500">Type:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-200 py-1.5 px-3 text-xs text-slate-700 bg-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="COMPLIANCE_AUDIT">Compliance Audit</option>
            <option value="EXECUTIVE_SUMMARY">Executive Summary</option>
            <option value="KNOWLEDGE_USAGE">Knowledge Usage</option>
            <option value="ACCESS_CONTROL">Access Control</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-slate-500 text-sm">
            <span className="animate-spin text-lg">🌀</span> Loading reports archive...
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredReports.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs">
              No reports match your filters. Click &quot;Generate Live Report&quot; to synthesize a new briefing.
            </div>
          ) : (
            filteredReports.map((r) => (
              <div
                key={r.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    {typeBadge(r.report_type)}
                    <span className="text-[10px] font-medium text-slate-400">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-900 leading-snug">{r.title}</h3>
                  {r.description && (
                    <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-3">{r.description}</p>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
                  <span className="text-slate-400 truncate max-w-[120px]">
                    👤 {r.generated_by_name || "NexusAI Engine"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveReport(r)}
                      className="rounded-md bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-600 hover:bg-indigo-100 transition"
                    >
                      View Report
                    </button>
                    <button
                      onClick={() => handleDeleteReport(r.id)}
                      className="p-1 text-slate-300 hover:text-rose-600 transition"
                      title="Delete Report"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Inspect Report Modal / Drawer */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  {typeBadge(activeReport.report_type)}
                  <span className="text-xs text-slate-400">
                    Generated {new Date(activeReport.created_at).toLocaleString()}
                  </span>
                </div>
                <h2 className="mt-1 text-lg font-bold text-slate-900">{activeReport.title}</h2>
              </div>
              <button
                onClick={() => setActiveReport(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-5 text-xs text-slate-600 leading-relaxed">
              {activeReport.description && (
                <p className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-700 italic">
                  {activeReport.description}
                </p>
              )}

              {parsedContent ? (
                <>
                  {parsedContent.executive_summary && (
                    <div className="space-y-1">
                      <h4 className="font-bold uppercase tracking-wider text-slate-900 text-[11px]">Executive Summary</h4>
                      <p className="text-slate-700">{parsedContent.executive_summary}</p>
                    </div>
                  )}

                  {parsedContent.key_metrics && (
                    <div className="space-y-2">
                      <h4 className="font-bold uppercase tracking-wider text-slate-900 text-[11px]">Telemetry Metrics</h4>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {Object.entries(parsedContent.key_metrics).map(([k, v]) => (
                          <div key={k} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                            <p className="text-[10px] uppercase font-semibold text-slate-400 truncate">{k.replaceAll("_", " ")}</p>
                            <p className="mt-1 text-base font-bold text-indigo-600">{String(v)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {parsedContent.findings && Array.isArray(parsedContent.findings) && (
                    <div className="space-y-1.5">
                      <h4 className="font-bold uppercase tracking-wider text-slate-900 text-[11px]">Key Findings</h4>
                      <ul className="list-disc pl-4 space-y-1 text-slate-700">
                        {parsedContent.findings.map((f: string, idx: number) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {parsedContent.recommendations && Array.isArray(parsedContent.recommendations) && (
                    <div className="space-y-1.5">
                      <h4 className="font-bold uppercase tracking-wider text-slate-900 text-[11px]">Strategic Recommendations</h4>
                      <ul className="list-disc pl-4 space-y-1 text-emerald-700">
                        {parsedContent.recommendations.map((r: string, idx: number) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl text-slate-500 whitespace-pre-wrap font-mono text-[11px]">
                  {activeReport.content || "No structured content payload recorded."}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <button
                onClick={() => setActiveReport(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Close Briefing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Synthesize Operational Report</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateReport} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700">Select Report Type</label>
                <select
                  value={genType}
                  onChange={(e) => setGenType(e.target.value as Report["report_type"])}
                  className="mt-1 w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="COMPLIANCE_AUDIT">Compliance & Security Audit</option>
                  <option value="EXECUTIVE_SUMMARY">Executive Operations Summary</option>
                  <option value="KNOWLEDGE_USAGE">Knowledge Intelligence Review</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700">Custom Executive Notes (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Include specific goals, quarterly milestones, or team focal points..."
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {generating ? "Synthesizing..." : "Generate Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
