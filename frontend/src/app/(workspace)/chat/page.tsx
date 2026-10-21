"use client";

import Link from "next/link";
import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from "react";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { MarkdownContent } from "@/components/markdown-content";

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
  citations?: Citation[];
  created_at?: string;
}

interface ChatSession {
  id: string;
  title: string;
  collection: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

const DOMAIN_COLLECTIONS = [
  { id: "ALL", label: "All Knowledge Domains", icon: "🌐", desc: "Cross-department index" },
  { id: "General", label: "General Knowledge", icon: "🏢", desc: "Company handbooks & announcements" },
  { id: "HR", label: "People & HR Policies", icon: "👥", desc: "Benefits, leaves & payroll guidelines" },
  { id: "Finance", label: "Finance & Accounting", icon: "📊", desc: "Ledgers, invoices & budgets" },
  { id: "Engineering", label: "Engineering & IT", icon: "⚙️", desc: "Architecture & API specifications" },
  { id: "Support", label: "Customer Support", icon: "🛠️", desc: "Ticket triage & customer playbooks" },
  { id: "Security", label: "Security & Compliance", icon: "🛡️", desc: "SOC2, ISO & access control audits" },
];

const STARTER_PROMPTS = [
  {
    icon: "👥",
    title: "HR Leave Policy",
    prompt: "What is the policy for annual vacation leave carryover and parental leave?",
    domain: "HR",
  },
  {
    icon: "📊",
    title: "Financial Ledger Summary",
    prompt: "Summarize our quarterly cloud infrastructure spending and ledger balance.",
    domain: "Finance",
  },
  {
    icon: "🛡️",
    title: "Security & MFA Standards",
    prompt: "What are the mandatory requirements for admin multi-factor authentication (MFA)?",
    domain: "Security",
  },
  {
    icon: "⚙️",
    title: "Workflow Automation Setup",
    prompt: "How do I configure S2S API keys and webhooks for external n8n workflows?",
    domain: "Engineering",
  },
];

let messageSequence = 0;
function nextMessageId(prefix: string): string {
  messageSequence += 1;
  return `${prefix}-${messageSequence}`;
}

export default function ChatPage() {
  const { user } = useAuth();

  // Sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Active chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string>("ALL");

  // Editing session title
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState("");

  // Copy feedback state
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load user sessions on mount
  useEffect(() => {
    let ignore = false;

    apiFetch("/api/v1/chat/sessions")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load chat sessions");
        return res.json();
      })
      .then((data: ChatSession[]) => {
        if (!ignore) {
          setSessions(data);
          setLoadingSessions(false);
          // If sessions exist, auto-select the latest one
          if (data.length > 0) {
            setActiveSessionId(data[0].id);
          }
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Failed to fetch sessions:", err);
          setLoadingSessions(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // When active session changes, load its message history
  useEffect(() => {
    if (!activeSessionId) return;

    let ignore = false;
    apiFetch(`/api/v1/chat/sessions/${activeSessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load session details");
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setMessages(
            data.messages.map((m: { id: string; role: "user" | "assistant"; content: string; citations: Citation[]; created_at: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              citations: m.citations,
              created_at: m.created_at,
            }))
          );
          if (data.collection) {
            setSelectedDomain(data.collection);
          }
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Failed to load session messages:", err);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeSessionId]);

  // Auto-scroll to bottom of message list
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Create a new session
  async function handleCreateSession(customDomain?: string) {
    try {
      const targetDomain = customDomain || (selectedDomain === "ALL" ? null : selectedDomain);
      const res = await apiFetch("/api/v1/chat/sessions", {
        method: "POST",
        body: JSON.stringify({
          title: "New Conversation",
          collection: targetDomain,
        }),
      });

      if (!res.ok) throw new Error("Failed to initialize conversation");
      const newSession = await res.json();

      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setMessages([]);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } catch (err) {
      console.error("Error creating session:", err);
    }
  }

  // Delete a session
  async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await apiFetch(`/api/v1/chat/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete conversation");

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  }

  // Start editing title
  function handleStartRename(s: ChatSession, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingSessionId(s.id);
    setEditTitleInput(s.title);
  }

  // Save renamed session title
  async function handleSaveRename(sessionId: string, e?: React.FormEvent) {
    if (e) e.preventDefault();
    const newTitle = editTitleInput.trim();
    if (!newTitle) {
      setEditingSessionId(null);
      return;
    }

    try {
      const res = await apiFetch(`/api/v1/chat/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
        );
      }
    } catch (err) {
      console.error("Failed to rename session:", err);
    } finally {
      setEditingSessionId(null);
    }
  }

  // Send message
  async function handleSend(textToSend?: string) {
    const query = (textToSend !== undefined ? textToSend : input).trim();
    if (!query || loading) return;

    let currentSessionId = activeSessionId;

    // If no active session exists, initialize one first
    if (!currentSessionId) {
      try {
        const res = await apiFetch("/api/v1/chat/sessions", {
          method: "POST",
          body: JSON.stringify({
            title: query.slice(0, 36) + (query.length > 36 ? "..." : ""),
            collection: selectedDomain === "ALL" ? null : selectedDomain,
          }),
        });
        if (res.ok) {
          const newSession = await res.json();
          setSessions((prev) => [newSession, ...prev]);
          setActiveSessionId(newSession.id);
          currentSessionId = newSession.id;
        }
      } catch (err) {
        console.error("Failed to auto-create session:", err);
      }
    }

    const tempUserMsgId = nextMessageId("usr");
    const userMessage: Message = {
      id: tempUserMsgId,
      role: "user",
      content: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/v1/chat", {
        method: "POST",
        body: JSON.stringify({
          message: query,
          collection: selectedDomain === "ALL" ? null : selectedDomain,
          session_id: currentSessionId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to receive response from Nexus RAG assistant");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: data.message_id || nextMessageId("asst"),
        role: "assistant",
        content: data.response,
        citations: data.citations,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update session title in list if this was the first message
      if (currentSessionId) {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === currentSessionId && (s.title === "New Conversation" || s.title === "Untitled Conversation")) {
              const shortened = query.length > 36 ? query.slice(0, 34) + "..." : query;
              return { ...s, title: shortened, updated_at: new Date().toISOString() };
            }
            return s;
          })
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: nextMessageId("err"),
        role: "assistant",
        content: "⚠️ An error occurred while retrieving authorized knowledge contexts. Please verify the API service is online and try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    handleSend();
  }

  function handleCopyMessage(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  }

  function handleExportChat() {
    const displayedMessages = activeSessionId ? messages : [];
    if (displayedMessages.length === 0) return;
    const activeSession = sessions.find((s) => s.id === activeSessionId);
    const title = activeSession?.title || "Nexus AI Chat Export";
    let markdown = `# ${title}\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;

    displayedMessages.forEach((m) => {
      const sender = m.role === "user" ? "### User" : "### Nexus AI Assistant";
      markdown += `${sender}\n\n${m.content}\n\n`;
      if (m.citations && m.citations.length > 0) {
        markdown += `**Citations:**\n`;
        m.citations.forEach((c) => {
          markdown += `- ${c.document_name} ${c.page_number ? `(p. ${c.page_number})` : ""} [Score: ${Math.round(c.similarity * 100)}%]\n`;
        });
        markdown += `\n`;
      }
      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeDomainMeta = DOMAIN_COLLECTIONS.find((d) => d.id === selectedDomain) || DOMAIN_COLLECTIONS[0];
  const displayedMessages = activeSessionId ? messages : [];

  return (
    <div className="flex h-[calc(100vh-8.5rem)] rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
      {/* LEFT SESSIONS SIDEBAR */}
      <aside
        className={`${
          sidebarOpen ? "w-72 sm:w-80" : "w-0 hidden"
        } transition-all duration-300 shrink-0 flex flex-col border-r border-slate-200 bg-slate-50/70`}
      >
        {/* SIDEBAR HEADER & NEW CHAT BUTTON */}
        <div className="p-4 border-b border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 font-mono">
              Chat Threads
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Synced
            </span>
          </div>

          <button
            onClick={() => handleCreateSession()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 px-3 text-xs font-semibold text-white shadow-sm hover:bg-indigo-600 transition active:scale-98"
          >
            <span>+</span>
            <span>New Conversation</span>
          </button>
        </div>

        {/* DOMAIN SCOPE SELECTOR */}
        <div className="px-4 py-2.5 border-b border-slate-200/60 bg-white/60">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Grounding Scope
          </label>
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {DOMAIN_COLLECTIONS.map((dom) => (
              <option key={dom.id} value={dom.id}>
                {dom.icon} {dom.label}
              </option>
            ))}
          </select>
        </div>

        {/* SESSIONS LIST */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {loadingSessions ? (
            <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              <span>Loading threads...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 px-4">
              <p className="text-xl mb-1">💬</p>
              <p className="font-semibold text-slate-600">No conversations yet</p>
              <p className="text-[11px] mt-1">Start a new thread to ask questions across company knowledge.</p>
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === activeSessionId;
              const isEditing = s.id === editingSessionId;

              return (
                <div
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`group relative flex items-center justify-between rounded-xl p-2.5 text-xs cursor-pointer transition ${
                    isActive
                      ? "bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/90"
                      : "text-slate-600 hover:bg-white/80 hover:text-slate-900 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-sm shrink-0">
                      {s.collection === "HR"
                        ? "👥"
                        : s.collection === "Finance"
                        ? "📊"
                        : s.collection === "Security"
                        ? "🛡️"
                        : s.collection === "Engineering"
                        ? "⚙️"
                        : "💬"}
                    </span>

                    {isEditing ? (
                      <form
                        onSubmit={(e) => handleSaveRename(s.id, e)}
                        className="flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          value={editTitleInput}
                          onChange={(e) => setEditTitleInput(e.target.value)}
                          onBlur={() => handleSaveRename(s.id)}
                          className="w-full text-xs bg-white border border-indigo-500 rounded px-1.5 py-0.5 outline-none"
                        />
                      </form>
                    ) : (
                      <div className="truncate">
                        <p className="truncate text-xs">{s.title}</p>
                        <p className="text-[10px] text-slate-400 font-normal">
                          {s.collection || "All Domains"}
                        </p>
                      </div>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-1">
                      <button
                        title="Rename"
                        onClick={(e) => handleStartRename(s, e)}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition rounded"
                      >
                        ✏️
                      </button>
                      <button
                        title="Delete conversation"
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition rounded"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="p-3 border-t border-slate-200/80 bg-white/40 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="font-mono text-[10px] text-slate-400">RAG Engine: Hybrid</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 font-mono">
            {user?.role || "Employee"}
          </span>
        </div>
      </aside>

      {/* MAIN CHAT WORKSPACE */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {/* TOP WORKSPACE HEADER */}
        <header className="flex items-center justify-between border-b border-slate-100 px-6 py-3.5 bg-slate-50/50">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 transition shadow-2xs"
              title={sidebarOpen ? "Hide chat threads" : "Show chat threads"}
            >
              {sidebarOpen ? "◀" : "▶"}
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 truncate">
                  {activeSession?.title || "New Enterprise Conversation"}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.2 text-[10px] font-semibold text-indigo-700">
                  {activeDomainMeta.icon} {activeDomainMeta.id}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Role-authorized context search • Grounded strictly in company documents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {displayedMessages.length > 0 && (
              <button
                onClick={handleExportChat}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition shadow-2xs flex items-center gap-1"
                title="Export conversation as markdown file"
              >
                <span>📥</span>
                <span>Export MD</span>
              </button>
            )}

            <Link
              href="/documents"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              Document Hub ↗
            </Link>
          </div>
        </header>

        {/* CHAT MESSAGES STREAM */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20">
          {displayedMessages.length === 0 ? (
            /* EMPTY STATE & STARTER CARDS */
            <div className="max-w-2xl mx-auto py-10 space-y-8">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-200 text-3xl shadow-sm">
                  ✨
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Nexus Enterprise AI Chat
                </h2>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Ask grounded questions across company documents, policies, engineering guides, and financial records.
                </p>
              </div>

              {/* STARTER PROMPTS GRID */}
              <div className="grid gap-3 sm:grid-cols-2">
                {STARTER_PROMPTS.map((starter, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedDomain(starter.domain);
                      handleSend(starter.prompt);
                    }}
                    className="flex flex-col text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-indigo-400 hover:shadow-md hover:bg-indigo-50/10 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">{starter.icon}</span>
                      <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-slate-600">
                        {starter.domain}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">
                      {starter.title}
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                      {starter.prompt}
                    </p>
                  </button>
                ))}
              </div>

              {/* SECURITY ASSURANCE BANNER */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-600 flex items-start gap-3">
                <span className="text-lg">🛡️</span>
                <div>
                  <p className="font-semibold text-slate-800">RBAC / ABAC Cryptographic Guard Active</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">
                    Queries are evaluated under your role (<strong>{user?.role || "Employee"}</strong>). Documents classified above your clearance level are excluded prior to vector similarity calculation.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* CONVERSATION MESSAGE LIST */
            displayedMessages.map((message) => {
              const isAssistant = message.role === "assistant";

              return (
                <div
                  key={message.id}
                  className={`flex flex-col gap-2 max-w-[90%] sm:max-w-2xl ${
                    isAssistant ? "mr-auto" : "ml-auto items-end"
                  }`}
                >
                  <div
                    className={`rounded-2xl px-5 py-4 text-xs leading-relaxed shadow-sm transition ${
                      isAssistant
                        ? "bg-white text-slate-800 border border-slate-200/80"
                        : "bg-indigo-600 text-white font-medium"
                    }`}
                  >
                    {/* MESSAGE SENDER BADGE & COPY */}
                    <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100/80 text-[10px] font-bold uppercase tracking-wider font-mono">
                      <span className={isAssistant ? "text-indigo-600 flex items-center gap-1" : "text-indigo-200"}>
                        {isAssistant ? "⚡ Nexus AI Assistant" : "You"}
                      </span>
                      {isAssistant && (
                        <button
                          onClick={() => handleCopyMessage(message.id, message.content)}
                          className="text-[10px] lowercase text-slate-400 hover:text-slate-700 transition"
                        >
                          {copiedMsgId === message.id ? "✓ Copied" : "Copy"}
                        </button>
                      )}
                    </div>

                    {/* CONTENT BODY */}
                    {isAssistant ? (
                      <MarkdownContent content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>

                  {/* CITATIONS BAR */}
                  {isAssistant && message.citations && message.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {message.citations.map((citation, idx) => (
                        <Link
                          key={idx}
                          href={citation.document_id ? `/documents/${citation.document_id}` : "/documents"}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition shadow-2xs group"
                        >
                          <span className="text-slate-400 group-hover:text-indigo-500">📄</span>
                          <span className="font-semibold truncate max-w-[140px]">
                            {citation.document_name}
                          </span>
                          {citation.page_number && (
                            <span className="text-slate-400 font-mono text-[9px]">
                              p.{citation.page_number}
                            </span>
                          )}
                          <span className="rounded bg-slate-100 px-1 py-0.2 font-mono text-[9px] font-bold text-slate-500">
                            {Math.round(citation.similarity * 100)}%
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* LOADING SPINNER */}
          {loading && (
            <div className="flex flex-col gap-2 max-w-[90%] sm:max-w-2xl mr-auto">
              <div className="rounded-2xl px-5 py-4 text-xs bg-white text-slate-600 border border-slate-200 shadow-sm flex items-center gap-3">
                <span className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:0.2s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-600 [animation-delay:0.4s]" />
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Querying vector database across <strong>{activeDomainMeta.label}</strong> and checking RBAC permissions...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* BOTTOM INPUT DOCK */}
        <div className="border-t border-slate-200 p-4 bg-white">
          <form
            onSubmit={handleFormSubmit}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition shadow-xs"
          >
            <div className="flex items-center gap-2 px-2 pb-1.5 border-b border-slate-200/50 text-[10px] font-mono text-slate-400">
              <span>Domain Scope:</span>
              <span className="font-bold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                {activeDomainMeta.icon} {activeDomainMeta.label}
              </span>
            </div>

            <div className="flex items-end gap-2 pt-2">
              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Ask anything grounded in company documents (Shift+Enter for new line)..."
                className="min-w-0 flex-1 px-2.5 text-xs bg-transparent outline-none resize-none disabled:cursor-not-allowed text-slate-900 placeholder:text-slate-400 leading-relaxed"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition active:scale-95 flex items-center gap-1.5"
              >
                <span>Send</span>
                <span>→</span>
              </button>
            </div>
          </form>

          <p className="mt-2 text-center text-[10px] text-slate-400">
            Nexus AI answers are strictly grounded in indexed company sources. All queries and access permissions are audited.
          </p>
        </div>
      </main>
    </div>
  );
}
