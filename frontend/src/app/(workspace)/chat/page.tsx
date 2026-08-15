"use client";

import Link from "next/link";
import { useState, useRef, useEffect, FormEvent } from "react";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";

interface Citation {
  document_name: string;
  page_number: number | null;
  similarity: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi ${user?.full_name ? user.full_name.split(" ")[0] : "there"}. I can help you explore company knowledge, find documents, and understand operational details. What would you like to ask?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await apiFetch("/api/v1/chat", {
        method: "POST",
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from assistant");
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        citations: data.citations,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error while searching the workspace. Please check that the API service is online and try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid h-[calc(100vh-9rem)] grid-rows-[auto_1fr_auto] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-6 py-5">
        <p className="text-sm font-medium text-indigo-600 font-mono tracking-wider uppercase">Enterprise AI Chat</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Nexus Assistant</h1>
        <p className="mt-1 text-xs text-slate-400">Grounded in company documents with secure permission checks</p>
      </header>

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
                  {isAssistant ? "Nexus AI" : "You"}
                </p>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>

              {isAssistant && message.citations && message.citations.length > 0 && (
                <div className="flex flex-wrap gap-2 px-2">
                  {message.citations.map((citation, idx) => {
                    const docSlug = citation.document_name.toLowerCase().replaceAll(" ", "-");
                    return (
                      <Link
                        key={idx}
                        href={`/documents/${docSlug}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500 hover:border-indigo-500 hover:text-indigo-600 transition shadow-sm"
                      >
                        <span className="text-slate-400">📄</span>
                        <span className="font-medium truncate max-w-[120px]">{citation.document_name}</span>
                        {citation.page_number && <span className="text-[10px] text-slate-400">p. {citation.page_number}</span>}
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500 font-bold font-mono">
                          {Math.round(citation.similarity * 100)}%
                        </span>
                      </Link>
                    );
                  })}
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
              <span className="text-xs text-slate-400 font-medium">Nexus is searching and formulating an answer...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-slate-100 p-4 bg-white">
        <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-2 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500 transition">
          <input
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="min-w-0 flex-1 px-3 text-sm bg-transparent outline-none disabled:cursor-not-allowed"
            placeholder="Ask about policies, plans, documents, or metrics..."
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
    </section>
  );
}
