"use client";

import Link from "next/link";
import { useState, useEffect, useRef, FormEvent } from "react";
import { apiFetch } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  description: string;
  collection_bind: string;
  status: string;
  allowed_tools: string[];
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

const AGENT_META: Record<string, { icon: string; category: string; color: string; samplePrompts: string[] }> = {
  "hr-policy": {
    icon: "👥",
    category: "People Operations",
    color: "from-blue-500/10 to-indigo-500/10 border-indigo-200",
    samplePrompts: [
      "I want to submit a leave request for next week, notify HR.",
      "What is the company vacation and sick leave policy?",
    ],
  },
  "finance-analyst": {
    icon: "📊",
    category: "Finance & Accounting",
    color: "from-emerald-500/10 to-teal-500/10 border-emerald-200",
    samplePrompts: [
      "Please calculate the total sum of this quarter's expenses.",
      "Export Q3 financial statements ledger to Excel.",
    ],
  },
  "support-triage": {
    icon: "🛠️",
    category: "Customer Support & IT",
    color: "from-amber-500/10 to-orange-500/10 border-amber-200",
    samplePrompts: [
      "Escalate critical database outage to on-call engineering.",
      "Create high priority Jira bug ticket for API latency spike.",
    ],
  },
  "compliance-officer": {
    icon: "🛡️",
    category: "Information Security",
    color: "from-rose-500/10 to-pink-500/10 border-rose-200",
    samplePrompts: [
      "Scan the enterprise access matrix and check for unclassified documents.",
      "Flag security breach incident for blocked unauthorized access attempt.",
      "Revoke unauthorized grant on restricted confidential files.",
    ],
  },
  "document-classifier": {
    icon: "📑",
    category: "Data Ingestion & Privacy",
    color: "from-cyan-500/10 to-sky-500/10 border-cyan-200",
    samplePrompts: [
      "Scan text for sensitive PII leaks like social security and card numbers.",
      "Auto classify document tier based on sensitivity guidelines.",
      "Assign collection bind and set department inheritance policy.",
    ],
  },
  "executive-ops": {
    icon: "⚡",
    category: "Executive Strategy",
    color: "from-violet-500/10 to-purple-500/10 border-violet-200",
    samplePrompts: [
      "Generate executive report summary of cross-department operations.",
      "Create high-priority operational task to resolve workflow bottleneck.",
      "Broadcast executive brief to board and leadership dashboard.",
    ],
  },
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingAgents, setFetchingAgents] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch agent profiles on load
  useEffect(() => {
    let ignore = false;
    apiFetch("/api/v1/agents")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load agent profiles.");
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setAgents(data);
          setFetchingAgents(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Failed to load agent profiles:", err);
          setFetchingAgents(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeAgent) {
      scrollToBottom();
    }
  }, [messages, loading, activeAgent]);

  // Open an agent's chat session
  function handleSelectAgent(agent: Agent) {
    setActiveAgent(agent);
    setMessages([
      {
        id: "init",
        role: "assistant",
        content: `Hello! I am your **${agent.name}**. I have access to the **${agent.collection_bind}** knowledge collection and can execute automated workflows including: ${agent.allowed_tools.map(t => `\`${t}\``).join(", ")}. Ask me anything or select a prompt below.`,
      },
    ]);
  }

  // Send message to active agent
  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const queryText = input.trim();
    if (!queryText || loading || !activeAgent) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: queryText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await apiFetch(`/api/v1/agents/${activeAgent.id}/run`, {
        method: "POST",
        body: JSON.stringify({ message: queryText }),
      });

      if (!res.ok) {
        throw new Error("Agent run failed or returned an error.");
      }

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        tool_calls: data.tool_calls,
        citations: data.citations,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `⚠️ Error executing agent request: ${err instanceof Error ? err.message : "Internal system error"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  if (fetchingAgents) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        <span className="ml-3 text-sm text-slate-500 font-medium">Loading Autonomous AI Workforce...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 font-mono">Agentic workforce</p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Enterprise AI Agent Workflows</h1>
          <p className="text-sm text-slate-500 mt-1">
            Specialized autonomous agents equipped with role-based security guards, tool calling, and grounded vector retrieval.
          </p>
        </div>
      </div>

      {!activeAgent ? (
        /* AGENTS CARDS GRID */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const meta = AGENT_META[agent.id] || {
              icon: "🤖",
              category: "Operations",
              color: "from-slate-500/10 to-slate-600/10 border-slate-200",
              samplePrompts: [],
            };

            return (
              <div
                key={agent.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      <span>{meta.icon}</span> {meta.category}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 font-mono">
                      📚 {agent.collection_bind} Context
                    </span>
                  </div>

                  <h2 className="mt-4 text-lg font-bold text-slate-900 tracking-tight group-hover:text-indigo-600 transition">
                    {agent.name}
                  </h2>
                  <p className="mt-2 text-xs text-slate-500 leading-relaxed min-h-[36px]">
                    {agent.description}
                  </p>

                  {/* TOOLS BIND */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Guarded Capabilities</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {agent.allowed_tools.map((tool) => (
                        <span
                          key={tool}
                          className="rounded bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 font-mono"
                        >
                          ⚙️ {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSelectAgent(agent)}
                  className="mt-6 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-600 transition active:scale-95"
                >
                  Run Agent Workflow →
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* INTERACTIVE CONSOLE */
        <div className="flex flex-col h-[750px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* CONSOLE HEADER */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{AGENT_META[activeAgent.id]?.icon || "🤖"}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">{activeAgent.name}</h2>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Active Session
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Grounding: <span className="font-semibold text-slate-700">{activeAgent.collection_bind}</span> domain | Role security guard active
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveAgent(null)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition shadow-sm"
            >
              ← Back to Workforce
            </button>
          </div>

          {/* SUGGESTED PROMPTS BAR */}
          {AGENT_META[activeAgent.id]?.samplePrompts && (
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/40 px-6 py-2 overflow-x-auto text-xs">
              <span className="font-semibold text-slate-400 whitespace-nowrap text-[11px]">Quick actions:</span>
              {AGENT_META[activeAgent.id].samplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(prompt)}
                  disabled={loading}
                  className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition shadow-2xs"
                >
                  ⚡ {prompt}
                </button>
              ))}
            </div>
          )}

          {/* CHAT MESSAGES LOG */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/20">
            {messages.map((message) => {
              const isAssistant = message.role === "assistant";
              return (
                <div
                  key={message.id}
                  className={`flex flex-col gap-2 max-w-[85%] sm:max-w-2xl ${
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

                  {/* TOOL CALLS LOG */}
                  {isAssistant && message.tool_calls && message.tool_calls.length > 0 && (
                    <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-slate-300 shadow-inner w-full">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1">
                        🛠️ Tool Execution &amp; Security Guard Log
                      </p>
                      <div className="space-y-3">
                        {message.tool_calls.map((tool, idx) => {
                          const isDenied = tool.status === "DENIED";
                          return (
                            <div key={idx} className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className={isDenied ? "text-rose-400" : "text-emerald-400"}>
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

            {loading && (
              <div className="flex flex-col gap-2 max-w-[85%] sm:max-w-2xl">
                <div className="rounded-2xl px-5 py-4 text-xs bg-white text-slate-500 border border-slate-200 shadow-sm flex items-center gap-3">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-600 [animation-delay:0.4s]" />
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Agent executing tools and querying vector context...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* CONSOLE INPUT */}
          <form onSubmit={handleSend} className="border-t border-slate-200 p-4 bg-white">
            <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-2 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500 transition">
              <input
                required
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="min-w-0 flex-1 px-3 text-xs bg-transparent outline-none disabled:cursor-not-allowed text-slate-900 placeholder:text-slate-400"
                placeholder={`Query ${activeAgent.name}...`}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition shadow-sm active:scale-95"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
