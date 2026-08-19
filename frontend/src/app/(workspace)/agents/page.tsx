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
    async function loadAgents() {
      try {
        const res = await apiFetch("/api/v1/agents");
        if (res.ok) {
          const data = await res.json();
          setAgents(data);
        }
      } catch (err) {
        console.error("Failed to load agent profiles:", err);
      } finally {
        setFetchingAgents(false);
      }
    }
    loadAgents();
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
        content: `Hello! I am your ${agent.name}. I have access to the **${agent.collection_bind}** document library and can execute automated workflows including: ${agent.allowed_tools.map(t => `\`${t}\``).join(", ")}. Ask me anything.`,
      },
    ]);
  }

  // Send message to active agent
  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading || !activeAgent) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await apiFetch(`/api/v1/agents/${activeAgent.id}/run`, {
        method: "POST",
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!res.ok) {
        throw new Error("Agent execution failed");
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
      console.error(err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error during workflow execution. Please check the network connectivity and retry.",
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
        <span className="ml-3 text-sm text-slate-500 font-medium">Loading AI Workforce...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 font-mono">Agentic workforce</p>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">Autonomous AI Agents</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure and run specialized AI agents with tool-calling capabilities and document grounding.
          </p>
        </div>
      </div>

      {!activeAgent ? (
        /* AGENTS CARDS GRID */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition duration-300"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {agent.status}
                </span>
                <span className="text-xs font-bold text-slate-400 font-mono">
                  📚 {agent.collection_bind} Context
                </span>
              </div>

              <h2 className="mt-4 text-lg font-bold text-slate-800 tracking-tight">{agent.name}</h2>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed flex-1">{agent.description}</p>

              {/* TOOLS BIND */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allowed Toolsets</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {agent.allowed_tools.map((tool) => (
                    <span
                      key={tool}
                      className="rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 font-mono"
                    >
                      ⚙️ {tool}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleSelectAgent(agent)}
                className="mt-6 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition"
              >
                Run Session
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* DEDICATED AGENT CONSOLE */
        <div className="grid h-[calc(100vh-14rem)] grid-rows-[auto_1fr_auto] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* CONSOLE HEADER */}
          <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4.5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 shadow-sm">
                🤖
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-800 leading-tight">{activeAgent.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Collection: <strong className="font-semibold text-slate-500">{activeAgent.collection_bind}</strong>
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveAgent(null)}
              className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Exit Session
            </button>
          </header>

          {/* CHAT VIEWPORT */}
          <div className="space-y-6 overflow-y-auto bg-slate-50/50 p-6">
            {messages.map((message) => {
              const isAssistant = message.role === "assistant";
              return (
                <div
                  key={message.id}
                  className={`flex flex-col gap-2 max-w-[85%] sm:max-w-2xl ${
                    isAssistant ? "" : "ml-auto"
                  }`}
                >
                  <div
                    className={`rounded-2xl px-5 py-3.5 text-sm leading-6 shadow-sm ${
                      isAssistant
                        ? "bg-white text-slate-800 border border-slate-100"
                        : "bg-indigo-600 text-white font-medium"
                    }`}
                  >
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                      isAssistant ? "text-indigo-600" : "text-indigo-200"
                    }`}>
                      {isAssistant ? activeAgent.name : "You"}
                    </p>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {/* CITATIONS DISPLAY */}
                  {isAssistant && message.citations && message.citations.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-2">
                      {message.citations.map((citation, idx) => (
                        <Link
                          key={idx}
                          href={`/documents/${citation.document_name.toLowerCase().replaceAll(" ", "-")}`}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] text-slate-500 hover:border-indigo-500 hover:text-indigo-600 transition shadow-sm"
                        >
                          📄 {citation.document_name} {citation.page_number && `(p. ${citation.page_number})`}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* TIMELINE TOOL CALL LOGS */}
                  {isAssistant && message.tool_calls && message.tool_calls.length > 0 && (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-900 p-4 text-xs font-mono text-slate-300 shadow-inner">
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1">
                        🛠️ Tool Execution Log
                      </p>
                      <div className="space-y-2">
                        {message.tool_calls.map((tool, idx) => (
                          <div key={idx} className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-emerald-400">✓</span>
                              <span className="font-bold text-slate-100">{tool.tool_name}</span>
                              <span className="rounded bg-emerald-950 border border-emerald-800 px-1 text-[9px] text-emerald-400 font-bold">
                                {tool.status}
                              </span>
                            </div>
                            <p className="text-slate-400 pl-4">{tool.action_taken}</p>
                            <p className="text-[9px] text-slate-500 pl-4">{tool.timestamp}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex flex-col gap-2 max-w-[85%] sm:max-w-2xl">
                <div className="rounded-2xl px-5 py-4 text-sm bg-white text-slate-500 border border-slate-100 shadow-sm flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-500 [animation-delay:0.2s]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-600 [animation-delay:0.4s]" />
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Agent is thinking and executing toolsets...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* CONSOLE INPUT */}
          <form onSubmit={handleSend} className="border-t border-slate-100 p-4 bg-white">
            <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-2 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500 transition">
              <input
                required
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="min-w-0 flex-1 px-3 text-sm bg-transparent outline-none disabled:cursor-not-allowed"
                placeholder={`Ask ${activeAgent.name} something (e.g. try using keywords like 'notify', 'leave', 'calculate', 'escalate')...`}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition shadow-sm"
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
