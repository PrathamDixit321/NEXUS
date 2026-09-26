"use client";

import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  due_date: string | null;
  related_resource_type: string | null;
  created_at: string;
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  // Filters
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Task Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [creating, setCreating] = useState(false);

  const fetchTasks = async () => {
    try {
      const res = await apiFetch("/api/v1/tasks");
      if (!res.ok) throw new Error("Could not load tasks.");
      const data = await res.json();
      setTasks(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    apiFetch("/api/v1/tasks")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load tasks.");
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setTasks(data);
          setError("");
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load tasks.");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleUpdateStatus = async (taskId: string, newStatus: Task["status"]) => {
    try {
      const res = await apiFetch(`/api/v1/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
        );
      }
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await apiFetch(`/api/v1/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
      }
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      setCreating(true);
      const res = await apiFetch("/api/v1/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          priority: newPriority,
          status: "TODO",
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTasks((prev) => [created, ...prev]);
        setNewTitle("");
        setNewDescription("");
        setNewPriority("MEDIUM");
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setCreating(false);
    }
  };

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesPriority = filterPriority === "ALL" || t.priority === filterPriority;
      const term = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        t.title.toLowerCase().includes(term) ||
        (t.description?.toLowerCase().includes(term) ?? false) ||
        (t.assigned_to_name?.toLowerCase().includes(term) ?? false);
      return matchesPriority && matchesSearch;
    });
  }, [tasks, filterPriority, searchQuery]);

  const metrics = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === "TODO").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const completed = tasks.filter((t) => t.status === "DONE").length;
    return { total, todo, inProgress, completed };
  }, [tasks]);

  const priorityBadge = (p: Task["priority"]) => {
    const config = {
      URGENT: "bg-rose-50 text-rose-700 border-rose-200",
      HIGH: "bg-amber-50 text-amber-700 border-amber-200",
      MEDIUM: "bg-blue-50 text-blue-700 border-blue-200",
      LOW: "bg-slate-50 text-slate-600 border-slate-200",
    }[p] || "bg-slate-50 text-slate-600 border-slate-200";

    return (
      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${config}`}>
        {p}
      </span>
    );
  };

  const columns: Array<{ title: string; status: Task["status"]; icon: string }> = [
    { title: "To Do", status: "TODO", icon: "📌" },
    { title: "In Progress", status: "IN_PROGRESS", icon: "⚡" },
    { title: "Completed", status: "DONE", icon: "✅" },
  ];

  return (
    <section className="space-y-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-indigo-600">Work Management</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Operational Tasks</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Track document reviews, permission validations, workflow approvals, and AI agent follow-ups in an organized queue.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTasks}
            title="Refresh tasks queue"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition active:scale-95"
          >
            🔄 Refresh
          </button>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setViewMode("board")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                viewMode === "board" ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                viewMode === "list" ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              List
            </button>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition active:scale-95"
          >
            <span>+</span> New Task
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Total Tasks</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-amber-500">To Do</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.todo}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-blue-500">In Progress</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.inProgress}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-emerald-500">Completed</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.completed}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search tasks by title, description, or owner..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-3 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-500">Priority:</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-lg border border-slate-200 py-1.5 px-3 text-xs text-slate-700 bg-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
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
            <span className="animate-spin text-lg">🌀</span> Loading task queue...
          </div>
        </div>
      ) : viewMode === "board" ? (
        /* Kanban Board View */
        <div className="grid gap-6 md:grid-cols-3">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="flex flex-col rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 min-h-[400px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span>{col.icon}</span>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">{col.title}</h2>
                  </div>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {colTasks.length}
                  </span>
                </div>

                <div className="mt-4 flex-1 space-y-3">
                  {colTasks.length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                      No tasks in this column
                    </div>
                  ) : (
                    colTasks.map((t) => (
                      <div
                        key={t.id}
                        className="group relative rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm hover:shadow transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-xs font-semibold text-slate-900 leading-snug">{t.title}</h3>
                          {priorityBadge(t.priority)}
                        </div>
                        {t.description && (
                          <p className="mt-2 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {t.description}
                          </p>
                        )}
                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[10px] text-slate-400">
                          <span className="truncate max-w-[120px]">
                            👤 {t.assigned_to_name || "Unassigned"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {col.status !== "DONE" && (
                              <button
                                onClick={() =>
                                  handleUpdateStatus(
                                    t.id,
                                    col.status === "TODO" ? "IN_PROGRESS" : "DONE"
                                  )
                                }
                                title="Advance task status"
                                className="rounded bg-indigo-50 px-2 py-1 font-semibold text-indigo-600 hover:bg-indigo-100 transition"
                              >
                                {col.status === "TODO" ? "Start →" : "Finish ✓"}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteTask(t.id)}
                              title="Delete task"
                              className="text-slate-300 hover:text-rose-600 transition p-1"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-slate-400 uppercase font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">Task</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Assigned To</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No tasks match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{t.title}</p>
                      {t.description && <p className="text-[11px] text-slate-400 truncate max-w-xs">{t.description}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={t.status}
                        onChange={(e) => handleUpdateStatus(t.id, e.target.value as Task["status"])}
                        className="rounded border border-slate-200 bg-white py-1 px-2 text-[11px] font-medium text-slate-700 focus:outline-none"
                      >
                        <option value="TODO">To Do</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="DONE">Completed</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">{priorityBadge(t.priority)}</td>
                    <td className="py-3 px-4 text-slate-500">{t.assigned_to_name || "Unassigned"}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        className="rounded px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Create New Operational Task</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Audit Q3 Finance Spreadsheets"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700">Description</label>
                <textarea
                  rows={3}
                  placeholder="Provide context, workflow requirements, or compliance goals..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700">Priority Level</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 py-2 px-3 text-xs text-slate-900 bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
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
                  disabled={creating || !newTitle.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
