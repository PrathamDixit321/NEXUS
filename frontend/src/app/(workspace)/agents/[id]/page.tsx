"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect, useRef, FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { AGENT_META } from "@/lib/agents-meta";

interface BoundDoc {
  id: string;
  name: string;
  collection: string;
  classification: string;
  size_bytes: number;
  created_at: string;
}

interface AgentDetail {
  id: string;
  name: string;
  description: string;
  collection_bind: string;
  status: string;
  allowed_tools: string[];
  system_persona: string;
  tool_security_matrix: Record<string, string[]>;
  bound_documents_count: number;
  bound_documents: BoundDoc[];
}

interface ToolExecution {
  tool_name: string;
  action_taken: string;
  status: string;
  timestamp: string;
}

interface Citation {
  document_name: string;
  document_id?: string;
  page_number: number | null;
  similarity: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolExecution[];
  citations?: Citation[];
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = (params?.id as string) || "";
  const { user } = useAuth();

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<"security" | "knowledge" | "persona">("security");
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch agent details on mount
  useEffect(() => {
    if (!agentId) return;

    let ignore = false;
    apiFetch(`/api/v1/agents/${agentId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? `Agent profile "${agentId}" not found in enterprise registry.`
              : "Failed to load agent profile."
          );
        }
        return res.json();
      })
      .then((data: AgentDetail) => {
        if (!ignore) {
          setAgent(data);
          setLoading(false);
          setMessages([
            {
              id: "init",
              role: "assistant",
              content: `Hello! I am your **${data.name}**.\n\nI have grounding access to the **${data.collection_bind}** collection (${data.bound_documents_count} bound files available) and role-governed execution authority over: ${data.allowed_tools.map((t) => `\`${t}\``).join(", ")}.\n\nTry running a query or select one of the suggested workflow prompts below.`,
            },
          ]);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Internal system error");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [agentId]);

  // Scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, running]);

  // Send message to agent
  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || running || !agent) return;

    const userMessage: Message = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setRunning(true);

    try {
      const res = await apiFetch(`/api/v1/agents/${agent.id}/run`, {
        method: "POST",
        body: JSON.stringify({ message: query }),
      });

      if (!res.ok) {
        throw new Error("Agent execution request returned an error.");
      }

      const data = await res.json();

      const assistantMessage: Message = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: data.response,
        tool_calls: data.tool_calls,
        citations: data.citations,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ Execution error: ${err instanceof Error ? err.message : "Internal execution error"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setRunning(false);
    }
  }

  function handleClearChat() {
    if (!agent) return;
    setMessages([
      {
        id: `reset-${Date.now()}`,
        role: "assistant",
        content: `Conversation reset. I am ready for new queries on the **${agent.collection_bind}** collection.`,
      },
    ]);
  }

  function handleCopyPersona() {
    if (!agent?.system_persona) return;
    navigator.clipboard.writeText(agent.system_persona);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }

  const meta = AGENT_META[agentId] || {
    icon: "🤖",
    category: "Autonomous Agent",
    color: "from-indigo-500/10 to-blue-500/10 border-indigo-200",
    badgeBg: "bg-indigo-50 border-indigo-200",
    badgeText: "text-indigo-700",
    samplePrompts: [],
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Loading agent profile &amp; security matrix...</p>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-6">
        <Link href="/agents" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition">
          ← All Agents
        </Link>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-xl font-bold">
            !
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-900">Agent Profile Unavailable</h2>
          <p className="mt-1 text-xs text-rose-700 max-w-md mx-auto">{error || "Agent not found"}</p>
          <div className="mt-6">
            <Link
              href="/agents"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              ← Return to Workforce Directory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* TOP BREADCRUMB & HEADER HERO */}
      <div className="flex flex-col gap-4">
        <div>
          <Link
            href="/agents"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition font-mono"
          >
            ← All AI Agents
          </Link>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-3xl shadow-inner">
              {meta.icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">{agent.name}</h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active &amp; Guarded
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${meta.badgeBg} ${meta.badgeText}`}>
                  {meta.category}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500 max-w-2xl leading-relaxed">{agent.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700 font-mono text-[11px]">
                  📚 Domain: {agent.collection_bind}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700 font-mono text-[11px]">
                  📑 {agent.bound_documents_count} Files Bound
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700 font-mono text-[11px]">
                  🛡️ {agent.allowed_tools.length} Guarded Tools
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:self-start">
            <button
              onClick={handleClearChat}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shadow-2xs"
            >
              Reset Session
            </button>
            <Link
              href="/documents"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              Manage Documents ↗
            </Link>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN SPLIT WORKSPACE */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* LEFT COLUMN: INTERACTIVE TEST CONSOLE & RUNNER */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden h-[760px]">
          {/* CONSOLE HEADER */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3.5 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                Interactive Execution Console
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              Caller Role: <strong className="text-slate-700">{user?.role || "Employee"}</strong>
            </span>
          </div>

          {/* QUICK ACTION PROMPTS */}
          {meta.samplePrompts.length > 0 && (
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/40 px-6 py-2 overflow-x-auto text-xs">
              <span className="font-semibold text-slate-400 whitespace-nowrap text-[11px]">Quick test:</span>
              {meta.samplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(prompt)}
                  disabled={running}
                  className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition shadow-2xs disabled:opacity-50"
                >
                  ⚡ {prompt}
                </button>
              ))}
            </div>
          )}

          {/* CHAT STREAM */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/20">
            {messages.map((message) => {
              const isAssistant = message.role === "assistant";
              return (
                <div
                  key={message.id}
                  className={`flex flex-col gap-2 max-w-[88%] sm:max-w-xl ${
                    isAssistant ? "mr-auto" : "ml-auto items-end"
                  }`}
                >
                  <div
                    className={`rounded-2xl px-5 py-3.5 text-xs leading-relaxed shadow-sm ${
                      isAssistant
                        ? "bg-white text-slate-800 border border-slate-200/80"
                        : "bg-indigo-600 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {/* CITATIONS */}
                  {isAssistant && message.citations && message.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {message.citations.map((citation, idx) => (
                        <Link
                          key={idx}
                          href={citation.document_id ? `/documents/${citation.document_id}` : "/documents"}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] text-slate-500 hover:border-indigo-500 hover:text-indigo-600 transition shadow-2xs"
                        >
                          📄 {citation.document_name} {citation.page_number && `(p. ${citation.page_number})`}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* TOOL CALLS TELEMETRY LOG */}
                  {isAssistant && message.tool_calls && message.tool_calls.length > 0 && (
                    <div className="mt-1 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-slate-300 shadow-inner w-full">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          🛡️ Tool Security &amp; Execution Telemetry
                        </span>
                        <span className="text-[9px] text-slate-500">audited in database</span>
                      </div>
                      <div className="space-y-3">
                        {message.tool_calls.map((tool, idx) => {
                          const isDenied = tool.status === "DENIED";
                          return (
                            <div key={idx} className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className={isDenied ? "text-rose-400" : "text-emerald-400 font-bold"}>
                                  {isDenied ? "⚠️" : "✓"}
                                </span>
                                <span className="font-bold text-slate-100">{tool.tool_name}</span>
                                <span
                                  className={`rounded border px-1.5 py-0.2 text-[9px] font-bold ${
                                    isDenied
                                      ? "bg-rose-950/80 border-rose-800 text-rose-300"
                                      : "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                                  }`}
                                >
                                  {tool.status}
                                </span>
                              </div>
                              <p className={isDenied ? "text-rose-300/90 pl-5 text-[11px]" : "text-slate-300 pl-5 text-[11px]"}>
                                {tool.action_taken}
                              </p>
                              <p className="text-[9px] text-slate-500 pl-5">{tool.timestamp}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {running && (
              <div className="flex flex-col gap-2 max-w-[88%] sm:max-w-xl">
                <div className="rounded-2xl px-5 py-4 text-xs bg-white text-slate-500 border border-slate-200 shadow-sm flex items-center gap-3">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-600 [animation-delay:0.4s]" />
                  </span>
                  <span className="text-xs text-slate-600 font-medium">
                    Verifying role security clearance and retrieving {agent.collection_bind} context...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT FORM */}
          <form onSubmit={handleSend} className="border-t border-slate-200 p-4 bg-white">
            <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500 transition">
              <input
                required
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={running}
                className="min-w-0 flex-1 px-3 text-xs bg-transparent outline-none disabled:cursor-not-allowed text-slate-900 placeholder:text-slate-400"
                placeholder={`Query ${agent.name} or invoke guarded tools...`}
              />
              <button
                type="submit"
                disabled={running || !input.trim()}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition shadow-sm active:scale-95"
              >
                Send Query
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: SPECS, KNOWLEDGE SCOPE & ROLE GUARD MATRIX */}
        <div className="lg:col-span-5 space-y-6">
          {/* TAB SELECTOR */}
          <div className="flex rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs">
            <button
              onClick={() => setActiveTab("security")}
              className={`flex-1 rounded-lg py-2 font-semibold transition ${
                activeTab === "security"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🛡️ Security Matrix
            </button>
            <button
              onClick={() => setActiveTab("knowledge")}
              className={`flex-1 rounded-lg py-2 font-semibold transition ${
                activeTab === "knowledge"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📑 Knowledge ({agent.bound_documents_count})
            </button>
            <button
              onClick={() => setActiveTab("persona")}
              className={`flex-1 rounded-lg py-2 font-semibold transition ${
                activeTab === "persona"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🧠 System Persona
            </button>
          </div>

          {/* TAB 1: SECURITY MATRIX */}
          {activeTab === "security" && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Guarded Capabilities Matrix</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Tool execution requests are verified at runtime against caller role permissions.
                </p>
              </div>

              <div className="space-y-3">
                {agent.allowed_tools.map((tool) => {
                  const allowedRoles = agent.tool_security_matrix[tool] || [];
                  const userRole = user?.role || "Employee";
                  const isUserAuthorized = allowedRoles.includes(userRole);

                  return (
                    <div
                      key={tool}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">⚙️</span>
                          <span className="font-mono text-xs font-bold text-slate-900">{tool}</span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                            isUserAuthorized
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {isUserAuthorized ? `✓ You are authorized` : `⚠️ Restricted for ${userRole}`}
                        </span>
                      </div>

                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Authorized Roles:
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {allowedRoles.map((role) => {
                            const isMatch = role === userRole;
                            return (
                              <span
                                key={role}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium border ${
                                  isMatch
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold"
                                    : "bg-white text-slate-600 border-slate-200"
                                }`}
                              >
                                {role}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-800">
                <p className="font-semibold">⚠️ Audit Log Policy</p>
                <p className="mt-1 text-[11px] text-amber-700 leading-relaxed">
                  Both permitted and blocked tool executions emit immutable events recorded to the security audit trail.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: BOUND KNOWLEDGE COLLECTION */}
          {activeTab === "knowledge" && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Bound Knowledge Scope</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Collection: <span className="font-semibold text-slate-800">{agent.collection_bind}</span>
                  </p>
                </div>
                <Link
                  href="/documents"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  Upload File +
                </Link>
              </div>

              {agent.bound_documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                  <p className="text-2xl">📚</p>
                  <p className="mt-2 text-xs font-semibold text-slate-700">No documents bound yet</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Upload documents to the <strong>{agent.collection_bind}</strong> collection to ground this agent.
                  </p>
                  <Link
                    href="/documents"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    Go to Documents →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {agent.bound_documents.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className="group flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/40 p-3 hover:border-indigo-300 hover:bg-indigo-50/20 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg">📄</span>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition">
                            {doc.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatBytes(doc.size_bytes)} • {doc.collection}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-600">
                        {doc.classification}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SYSTEM PERSONA */}
          {activeTab === "persona" && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Agent Persona &amp; Directives</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    System prompt configuring reasoning boundaries and output formatting.
                  </p>
                </div>
                <button
                  onClick={handleCopyPersona}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition shadow-2xs"
                >
                  {copiedPrompt ? "✓ Copied" : "Copy Prompt"}
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs font-mono text-slate-200 leading-relaxed shadow-inner max-h-[360px] overflow-y-auto whitespace-pre-wrap">
                {agent.system_persona}
              </div>

              <div className="space-y-2 text-xs text-slate-500">
                <p className="font-semibold text-slate-700">Governance Directives:</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Responses strictly grounded in bound vector chunks.</li>
                  <li>Caller authorization verified before automated tool execution.</li>
                  <li>Simulated tool triggers and refusals summarized in telemetry logs.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
