"use client";

import { useEffect, useState, FormEvent } from "react";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";

type UserSession = {
  id: string;
  created_at: string;
  expires_at: string;
  is_revoked: boolean;
};

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "sessions" | "preferences">("profile");

  // Profile Form States
  const [prevUser, setPrevUser] = useState(user);
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [department, setDepartment] = useState(user?.department || "");
  const [companyName, setCompanyName] = useState(user?.company_name || "");
  const [savingProfile, setSavingProfile] = useState(false);

  if (user !== prevUser) {
    setPrevUser(user);
    setFullName(user?.full_name || "");
    setDepartment(user?.department || "");
    setCompanyName(user?.company_name || "");
  }

  // Security Form States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Sessions States
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  // AI & Workspace Preferences States
  const [aiModel, setAiModel] = useState("gpt-4o");
  const [groundingMode, setGroundingMode] = useState("hybrid");
  const [notifySecurity, setNotifySecurity] = useState(true);
  const [notifyWorkflows, setNotifyWorkflows] = useState(true);
  const [notifyReports, setNotifyReports] = useState(false);

  // Status & Feedback Messages
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [feedbackError, setFeedbackError] = useState("");

  // Load active sessions when sessions tab is selected
  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await apiFetch("/api/v1/auth/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    if (activeTab === "sessions") {
      apiFetch("/api/v1/auth/sessions")
        .then(async (res) => {
          if (!ignore && res.ok) {
            setSessions(await res.json());
          }
        })
        .catch((err) => {
          if (!ignore) console.error("Error fetching sessions:", err);
        });
    }
    return () => {
      ignore = true;
    };
  }, [activeTab]);

  // Handle Profile Update
  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedbackSuccess("");
    setFeedbackError("");

    try {
      const res = await apiFetch("/api/v1/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          full_name: fullName.trim(),
          department: department.trim() || null,
          company_name: companyName.trim() || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to update profile.");
      }

      await refreshProfile();
      setFeedbackSuccess("Profile identity updated successfully.");
      setTimeout(() => setFeedbackSuccess(""), 4000);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Error updating profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Password Change
  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setFeedbackError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setFeedbackError("New password must be at least 8 characters long.");
      return;
    }

    setSavingPassword(true);
    setFeedbackSuccess("");
    setFeedbackError("");

    try {
      const res = await apiFetch("/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Password update failed. Verify current credentials.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedbackSuccess("Password updated securely across all devices.");
      setTimeout(() => setFeedbackSuccess(""), 4000);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Error changing password.");
    } finally {
      setSavingPassword(false);
    }
  };

  // Handle Session Revoke
  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      const res = await apiFetch(`/api/v1/auth/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not revoke session.");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setFeedbackSuccess("Session revoked successfully.");
      setTimeout(() => setFeedbackSuccess(""), 4000);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : "Failed to revoke session.");
    } finally {
      setRevokingSessionId(null);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "NX";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 rounded-full">
              Personal Workspace
            </span>
            <span className="text-xs text-slate-400 font-medium">• Access Authority: {user?.role || "Employee"}</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Account & Workspace Settings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your corporate identity, security credentials, active sessions, and AI model configurations.
          </p>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {feedbackSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 flex items-center justify-between shadow-2xs">
          <span className="font-medium">✓ {feedbackSuccess}</span>
          <button onClick={() => setFeedbackSuccess("")} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}
      {feedbackError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center justify-between shadow-2xs">
          <span>⚠️ {feedbackError}</span>
          <button onClick={() => setFeedbackError("")} className="text-rose-600 hover:text-rose-900">✕</button>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === "profile"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>👤</span>
          <span>Profile & Identity</span>
        </button>

        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === "security"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>🔒</span>
          <span>Security & Password</span>
        </button>

        <button
          onClick={() => setActiveTab("sessions")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === "sessions"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>💻</span>
          <span>Active Sessions ({sessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
            activeTab === "preferences"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <span>⚙️</span>
          <span>AI & Preferences</span>
        </button>
      </div>

      {/* TAB 1: PROFILE & IDENTITY */}
      {activeTab === "profile" && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* USER CARD */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs flex flex-col items-center text-center">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                {getInitials(user?.full_name || "")}
              </div>
              <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[10px] text-white">
                ✓
              </span>
            </div>

            <h2 className="mt-4 text-base font-bold text-slate-900">{user?.full_name || "Nexus User"}</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{user?.email}</p>

            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-[11px] font-bold text-indigo-700">
                {user?.role || "Employee"} Authority
              </span>
              <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700">
                {user?.department || "Operations"}
              </span>
            </div>

            <div className="mt-6 w-full border-t border-slate-100 pt-4 text-left text-xs space-y-2.5 text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Company:</span>
                <span className="font-semibold text-slate-800">{user?.company_name || "NexusAI Inc."}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Account Status:</span>
                <span className="font-semibold text-emerald-600">Active & Verified</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">RBAC Enforcement:</span>
                <span className="font-semibold text-slate-800">Deterministic</span>
              </div>
            </div>
          </div>

          {/* EDIT FORM */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900">Profile Information</h2>
            <p className="text-xs text-slate-500 mt-1">
              Update your corporate display details. Your email and system role require administrative provisioning.
            </p>

            <form onSubmit={handleUpdateProfile} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Full Name</label>
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alice Walker"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Work Email (Readonly)</label>
                  <input
                    disabled
                    type="email"
                    value={user?.email || ""}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-500 cursor-not-allowed font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Engineering, HR, Finance"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Company / Organization</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. NexusAI Inc."
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300 transition shadow-sm active:scale-95"
                >
                  {savingProfile ? "Saving Changes..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: SECURITY & PASSWORD */}
      {activeTab === "security" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900">Change Account Password</h2>
            <p className="text-xs text-slate-500 mt-1">
              Ensure your new password uses at least 8 characters, numbers, and symbols.
            </p>

            <form onSubmit={handlePasswordChange} className="mt-6 space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Current Password</label>
                <input
                  required
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">New Password</label>
                <input
                  required
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Confirm New Password</label>
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingPassword || !currentPassword || !newPassword}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300 transition shadow-sm active:scale-95"
                >
                  {savingPassword ? "Updating Password..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Security Governance</h3>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-xs space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 text-sm">✓</span>
                <span className="font-semibold text-slate-800">Password Hashing:</span>
                <span className="text-slate-500 font-mono text-[10px]">bcrypt (12 rounds)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 text-sm">✓</span>
                <span className="font-semibold text-slate-800">JWT Token Expiry:</span>
                <span className="text-slate-500 font-mono text-[10px]">60 minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 text-sm">✓</span>
                <span className="font-semibold text-slate-800">Token Rotation:</span>
                <span className="text-slate-500 font-mono text-[10px]">Enforced on refresh</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 text-sm">✓</span>
                <span className="font-semibold text-slate-800">Audit Logging:</span>
                <span className="text-slate-500 font-mono text-[10px]">Real-time immutable</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE SESSIONS */}
      {activeTab === "sessions" && (
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Active Login Sessions</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review devices and tokens currently authorized to access your Nexus workspace.
              </p>
            </div>
            <button
              onClick={() => loadSessions()}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shadow-2xs"
            >
              🔄 Refresh Sessions
            </button>
          </div>

          {loadingSessions ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading active sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">No active sessions found.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5">Session ID</th>
                    <th className="px-4 py-2.5">Created At</th>
                    <th className="px-4 py-2.5">Expires At</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {s.id.slice(0, 12)}...
                        {idx === 0 && (
                          <span className="ml-2 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            Current Device
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(s.expires_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Active
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRevokeSession(s.id)}
                          disabled={revokingSessionId === s.id}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50"
                        >
                          {revokingSessionId === s.id ? "Revoking..." : "Revoke"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AI & PREFERENCES */}
      {activeTab === "preferences" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* AI ENGINE SELECTION */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">AI Reasoning & Provider</h2>
            <p className="text-xs text-slate-500">
              Select the primary LLM provider powering chat reasoning and autonomous agent tools.
            </p>

            <div className="space-y-3 pt-2">
              {[
                { id: "gpt-4o", name: "OpenAI GPT-4o", desc: "Highest intelligence & complex tool chaining (Default)" },
                { id: "gemini-1.5-pro", name: "Google Gemini 1.5 Pro", desc: "Long context retrieval & multi-modal processing" },
                { id: "ollama-llama-3", name: "Local Ollama Llama 3.3", desc: "Air-gapped on-premise execution (Zero cloud egress)" },
              ].map((provider) => (
                <label
                  key={provider.id}
                  onClick={() => setAiModel(provider.id)}
                  className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${
                    aiModel === provider.id
                      ? "border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="aiModel"
                    checked={aiModel === provider.id}
                    onChange={() => setAiModel(provider.id)}
                    className="mt-0.5 text-indigo-600"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">{provider.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{provider.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700">RAG Grounding Strategy</label>
              <select
                value={groundingMode}
                onChange={(e) => setGroundingMode(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-500"
              >
                <option value="hybrid">Hybrid (Dense Cosine + Sparse BM25 + RBAC Filter)</option>
                <option value="strict-rbac">Strict Role Scoped Only</option>
              </select>
            </div>
          </div>

          {/* NOTIFICATION PREFERENCES */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900">Workspace Notification Preferences</h2>
            <p className="text-xs text-slate-500">
              Configure real-time notifications for automated workflow triggers and security alerts.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div>
                  <p className="text-xs font-bold text-slate-900">Security Breach & Access Denied Alerts</p>
                  <p className="text-[11px] text-slate-500">Notify immediately when unauthorized documents are queried.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifySecurity}
                  onChange={(e) => setNotifySecurity(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div>
                  <p className="text-xs font-bold text-slate-900">Workflow Execution Failures</p>
                  <p className="text-[11px] text-slate-500">Alert if an inbound n8n or agent workflow drops out.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyWorkflows}
                  onChange={(e) => setNotifyWorkflows(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div>
                  <p className="text-xs font-bold text-slate-900">Weekly Executive Report Synthesis</p>
                  <p className="text-[11px] text-slate-500">Send Friday digest of workspace operations.</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyReports}
                  onChange={(e) => setNotifyReports(e.target.checked)}
                  className="h-4 w-4 rounded text-indigo-600"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => {
                  setFeedbackSuccess("Workspace preferences updated.");
                  setTimeout(() => setFeedbackSuccess(""), 4000);
                }}
                className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
