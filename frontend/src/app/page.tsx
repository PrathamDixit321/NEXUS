"use client";

import Link from "next/link";
import { useState } from "react";

// Interactive Simulator Scenarios
interface Scenario {
  id: string;
  category: string;
  icon: string;
  title: string;
  prompt: string;
  collection: string;
  response: string;
  citations: Array<{ document: string; page: number; similarity: number }>;
  tools: Array<{
    name: string;
    action: string;
    status: "SUCCESS" | "DENIED";
    allowedRoles: string[];
  }>;
}

const SCENARIOS: Scenario[] = [
  {
    id: "hr-policy",
    category: "People Operations",
    icon: "👥",
    title: "HR & Parental Leave Inquiry",
    prompt: "What is the policy for annual vacation leave carryover and parental leave?",
    collection: "HR",
    response:
      "Under corporate HR guidelines, full-time employees are eligible for up to 16 weeks of fully paid parental leave, accessible within the first 12 months following birth or adoption. Up to 5 unused PTO vacation days can be carried forward into the next fiscal year upon team lead approval.",
    citations: [
      { document: "employee_handbook_2026.pdf", page: 14, similarity: 0.98 },
      { document: "benefits_and_leave_policy.pdf", page: 3, similarity: 0.94 },
    ],
    tools: [
      {
        name: "notify-hr-team",
        action: "Logged inquiry and notified People Ops slack channel",
        status: "SUCCESS",
        allowedRoles: ["Employee", "Manager", "Admin", "CEO"],
      },
      {
        name: "generate-leave-form",
        action: "Drafted official PDF vacation application form",
        status: "SUCCESS",
        allowedRoles: ["Employee", "Manager", "Admin", "CEO"],
      },
    ],
  },
  {
    id: "finance-analyst",
    category: "Finance & Accounting",
    icon: "📊",
    title: "Quarterly Cloud Infrastructure Audit",
    prompt: "Calculate total Q3 cloud spend, check against budget, and export ledger.",
    collection: "Finance",
    response:
      "Q3 cloud infrastructure spend totaled $142,850.00 across AWS, GCP, and vector cluster instances. Spend is +4.2% above the baseline budget due to model inference scaling. The complete ledger breakdown has been calculated and verified.",
    citations: [
      { document: "q3_financial_ledger.xlsx", page: 1, similarity: 0.96 },
      { document: "cloud_infra_budget_2026.pdf", page: 7, similarity: 0.91 },
    ],
    tools: [
      {
        name: "math-calculator",
        action: "Computed sum totals and verified balance calculations across 18 line items",
        status: "SUCCESS",
        allowedRoles: ["Employee", "Manager", "Admin", "CEO"],
      },
      {
        name: "export-excel",
        action: "Exported Q3 statements database ledger to Excel sheet",
        status: "SUCCESS",
        allowedRoles: ["Manager", "Admin", "CEO"],
      },
    ],
  },
  {
    id: "compliance-officer",
    category: "Information Security",
    icon: "🛡️",
    title: "Access Matrix & Clearance Audit",
    prompt: "Scan the enterprise access matrix and flag any unauthorized document grants.",
    collection: "Security",
    response:
      "Completed security compliance scan across 142 repository files and 8 department roles. Zero overshared confidential records were detected. All explicit document grants strictly conform to least-privilege SOC2 Type II principles.",
    citations: [
      { document: "enterprise_security_matrix.pdf", page: 8, similarity: 0.97 },
      { document: "soc2_access_policy.pdf", page: 2, similarity: 0.93 },
    ],
    tools: [
      {
        name: "scan-access-matrix",
        action: "Scanned enterprise access matrix: verified clearance tiers across documents",
        status: "SUCCESS",
        allowedRoles: ["Manager", "Admin", "CEO"],
      },
      {
        name: "revoke-unauthorized-grant",
        action: "Revocation policy evaluated: all grants verified in compliance",
        status: "SUCCESS",
        allowedRoles: ["Admin", "CEO"],
      },
    ],
  },
  {
    id: "executive-ops",
    category: "Executive Strategy",
    icon: "⚡",
    title: "Cross-Department Operations Briefing",
    prompt: "Synthesize cross-department operations briefing and broadcast to dashboard.",
    collection: "All",
    response:
      "Executive synthesis completed: Engineering delivered 99.98% platform uptime; HR closed 14 key technical roles; Finance maintains an 18-month cash runway; and customer support triage SLA improved by 34%.",
    citations: [
      { document: "executive_briefing_q3.pdf", page: 1, similarity: 0.95 },
      { document: "operational_kpis_2026.pdf", page: 4, similarity: 0.92 },
    ],
    tools: [
      {
        name: "generate-executive-report",
        action: "Synthesized live cross-department executive briefing incorporating KPIs",
        status: "SUCCESS",
        allowedRoles: ["Manager", "Admin", "CEO"],
      },
      {
        name: "broadcast-executive-brief",
        action: "Broadcasted briefing to executive dashboard and leadership channels",
        status: "SUCCESS",
        allowedRoles: ["Admin", "CEO"],
      },
    ],
  },
];

// Product Modules Grid
const PRODUCT_MODULES = [
  {
    icon: "🔍",
    title: "Cryptographic RBAC/ABAC RAG",
    tagline: "Pre-filtered Vector Retrieval",
    description:
      "Eliminates prompt injection and unauthorized context leaks. User roles, department scopes, and explicit grants are cryptographically verified before vector similarity queries execute.",
    badge: "Zero Data Leakage",
    link: "/chat",
  },
  {
    icon: "🤖",
    title: "Autonomous Agent Workforce",
    tagline: "Role-Guarded Tool Sandbox",
    description:
      "6 specialized enterprise agents equipped with deterministic security guards. Agents execute domain workflows while enforcing least-privilege tool execution policies.",
    badge: "6 Active Agents",
    link: "/agents",
  },
  {
    icon: "📑",
    title: "Document Intelligence Engine",
    tagline: "Multi-Format Vector Ingestion",
    description:
      "Automated extraction, semantic chunking, and embedding for PDF, DOCX, XLSX, and PPTX files. Auto-classifies sensitivity levels (Public, Internal, Confidential, Restricted).",
    badge: "High-Throughput",
    link: "/documents",
  },
  {
    icon: "⚡",
    title: "Workflow Automation & n8n Hub",
    tagline: "Event-Driven Orchestration",
    description:
      "Seamlessly bridge AI decision-making with business execution. S2S API keys, authenticated webhooks, and execution replay traces connect directly to n8n pipelines.",
    badge: "S2S Webhooks",
    link: "/automation",
  },
  {
    icon: "📊",
    title: "Operations & Analytics Suite",
    tagline: "Real-Time Telemetry & Reports",
    description:
      "Comprehensive workspace dashboard tracking query volumes, storage utilization, task queues, and automated report generation for executive stakeholders.",
    badge: "Live Telemetry",
    link: "/analytics",
  },
  {
    icon: "🛡️",
    title: "Immutable Compliance Audits",
    tagline: "SOC2 & ISO 27001 Ready",
    description:
      "Every document view, file download, RAG context retrieval, and agent tool execution is immutably logged with user identity, client IP, timestamp, and security outcome.",
    badge: "Audited Ledger",
    link: "/admin",
  },
];

// Architecture Pipeline Stages
const ARCHITECTURE_STAGES = [
  {
    step: "01",
    title: "Identity & Token Validation",
    subtitle: "FastAPI JWT Auth Gate",
    detail: "Validates caller credentials, organizational tenant ID, role hierarchy, and active session tokens.",
    tag: "Auth Layer",
  },
  {
    step: "02",
    title: "Access Control Pre-Filter",
    subtitle: "Deterministic SQL Matrix",
    detail: "Pre-filters accessible document IDs based on OWNER, ORG, DEPT, TEAM, and explicit subject grants before vector search.",
    tag: "RBAC / ABAC",
  },
  {
    step: "03",
    title: "Hybrid Vector Retrieval",
    subtitle: "Qdrant & SQLite Vector Store",
    detail: "Calculates cosine similarity strictly within authorized document chunk IDs, eliminating unauthorized cross-department discovery.",
    tag: "Vector Index",
  },
  {
    step: "04",
    title: "Context-Grounded Inference",
    subtitle: "LLM Provider Gateway",
    detail: "Synthesizes responses strictly grounded in retrieved evidence chunks with exact document citations and similarity scores.",
    tag: "LLM Pipeline",
  },
  {
    step: "05",
    title: "Guard Evaluation & Audit",
    subtitle: "Tool Permission Firewall",
    detail: "Validates tool calling authority against deterministic role matrix; records every permitted and blocked action to immutable audit logs.",
    tag: "Audit Ledger",
  },
];

// Agents Showcase Data
const AGENTS_ROSTER = [
  {
    id: "hr-policy",
    name: "HR Policy Assistant",
    icon: "👥",
    domain: "HR",
    tools: ["notify-hr-team", "generate-leave-form"],
    persona: "Grounded in corporate HR guidelines, benefits summaries, and leave policies. Supportive, empathetic, and detail-oriented.",
  },
  {
    id: "finance-analyst",
    name: "Finance Analyst",
    icon: "📊",
    domain: "Finance",
    tools: ["math-calculator", "export-excel"],
    persona: "Inspects ledger balances, checks variances against budgets, and generates spreadsheet exports with mathematical accuracy.",
  },
  {
    id: "support-triage",
    name: "Support Triage Agent",
    icon: "🛠️",
    domain: "Support",
    tools: ["escalate-ticket", "create-jira-issue"],
    persona: "Organizes incoming customer tickets, extracts critical bug patterns, and escalates severity issues to on-call engineers.",
  },
  {
    id: "compliance-officer",
    name: "Security Compliance Officer",
    icon: "🛡️",
    domain: "Security",
    tools: ["scan-access-matrix", "flag-security-breach", "revoke-unauthorized-grant"],
    persona: "Audits enterprise access matrices, detects overshared confidential records, and enforces SOC2 and ISO compliance controls.",
  },
  {
    id: "document-classifier",
    name: "Document Intelligence & PII Redactor",
    icon: "📑",
    domain: "Engineering",
    tools: ["detect-pii", "auto-classify-document", "assign-collection-bind"],
    persona: "Scans files for sensitive PII leaks (SSNs, cards, credentials), assigns classification tiers, and routes files to collections.",
  },
  {
    id: "executive-ops",
    name: "Executive Strategy Agent",
    icon: "⚡",
    domain: "All",
    tools: ["generate-executive-report", "create-operational-task", "broadcast-executive-brief"],
    persona: "Synthesizes cross-department operations briefings, resolves workflow bottlenecks, and keeps leadership aligned on strategic KPIs.",
  },
];

// FAQs Data
const FAQS = [
  {
    q: "How does Nexus guarantee zero data leakage between enterprise departments?",
    a: "Unlike standard RAG architectures that search across an entire vector database and then try to redact content with prompt instructions, Nexus applies deterministic RBAC/ABAC pre-filtering at the database level. Before any vector similarity calculation occurs, the system queries only the document IDs that the caller's role, department, and team grants allow them to read. Unauthorized documents are never embedded in the LLM's context window.",
  },
  {
    q: "Is our proprietary enterprise data used to train AI models?",
    a: "No. Never. Nexus is architected with a strict Zero-Data-Retention policy. Your documents, extracted embeddings, user queries, and agent tool execution payloads are solely used to generate real-time inferences for your organization and are never used to train public or foundational AI models.",
  },
  {
    q: "How do the role-based security guards for AI agents work?",
    a: "Each agent capability tool (such as ledger export, Jira creation, or access grant revocation) is governed by a deterministic role authorization matrix. When an agent formulates an action, the security firewall checks whether the caller's authenticated role possesses the required capability scope. Permitted tools execute and log an audit event; unauthorized attempts are instantly blocked, generating a security denial event in the InfoSec audit log.",
  },
  {
    q: "Can Nexus connect to external workflow automation tools like n8n?",
    a: "Yes. Nexus features a dedicated Automation Hub supporting cryptographically signed S2S API keys, customizable event webhook dispatchers, and execution traces. External workflows in n8n, Make, or Zapier can trigger autonomous agent workflows or receive real-time webhook alerts when compliance events occur.",
  },
  {
    q: "What document formats and storage backends are supported?",
    a: "Nexus supports ingestion of PDF, DOCX, XLSX, and PPTX files with automated text extraction, chunking, and metadata tagging. Vector storage is built with a pluggable abstraction supporting local high-speed SQLite vector stores in development and dedicated Qdrant clusters in production.",
  },
];

export default function Home() {
  // Simulator State
  const [activeScenarioId, setActiveScenarioId] = useState<string>("hr-policy");
  const [selectedRole, setSelectedRole] = useState<string>("Employee");
  const [simulatedCustomInput, setSimulatedCustomInput] = useState<string>("");
  const [simulating, setSimulating] = useState<boolean>(false);

  // Active Agent Preview State
  const [activeAgentId, setActiveAgentId] = useState<string>("hr-policy");

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Mobile Menu State
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const activeScenario = SCENARIOS.find((s) => s.id === activeScenarioId) || SCENARIOS[0];
  const activeAgent = AGENTS_ROSTER.find((a) => a.id === activeAgentId) || AGENTS_ROSTER[0];

  const handleRunSimulation = () => {
    setSimulating(true);
    setTimeout(() => {
      setSimulating(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* BACKGROUND AMBIENT GLOWS */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-indigo-600/20 via-purple-600/10 to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-[35%] -left-48 w-[600px] h-[600px] bg-cyan-600/10 blur-[140px] rounded-full" />
        <div className="absolute top-[65%] -right-48 w-[650px] h-[650px] bg-indigo-600/15 blur-[150px] rounded-full" />
      </div>

      {/* STICKY GLASSMORPHIC NAVIGATION BAR */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-md shadow-indigo-500/25 border border-indigo-400/30 group-hover:scale-105 transition">
              <span className="font-mono text-lg font-bold text-white tracking-wider">N</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">Nexus</span>
                <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-mono font-semibold text-indigo-300">
                  v2.0 OS
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight">Enterprise AI Operating System</p>
            </div>
          </Link>

          {/* DESKTOP NAV LINKS */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-300">
            <a href="#interactive-demo" className="hover:text-indigo-400 transition">
              Live Simulator
            </a>
            <a href="#features" className="hover:text-indigo-400 transition">
              Core Modules
            </a>
            <a href="#agents" className="hover:text-indigo-400 transition">
              Autonomous Agents
            </a>
            <a href="#architecture" className="hover:text-indigo-400 transition">
              Architecture
            </a>
            <a href="#security" className="hover:text-indigo-400 transition">
              Security &amp; SOC2
            </a>
            <a href="#faq" className="hover:text-indigo-400 transition">
              FAQ
            </a>
          </nav>

          {/* DESKTOP ACTIONS */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition shadow-sm"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:from-indigo-500 hover:to-indigo-400 transition active:scale-95"
            >
              <span>Launch Workspace</span>
              <span>→</span>
            </Link>
          </div>

          {/* MOBILE MENU TOGGLE */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden rounded-lg border border-slate-800 p-2 text-slate-400 hover:text-white hover:bg-slate-900"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* MOBILE MENU DROPDOWN */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950/95 px-6 py-4 space-y-3">
            <nav className="flex flex-col gap-3 text-xs font-semibold text-slate-300">
              <a
                href="#interactive-demo"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-indigo-400"
              >
                Live Simulator
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-indigo-400"
              >
                Core Modules
              </a>
              <a
                href="#agents"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-indigo-400"
              >
                Autonomous Agents
              </a>
              <a
                href="#architecture"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-indigo-400"
              >
                Architecture
              </a>
              <a
                href="#security"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-indigo-400"
              >
                Security &amp; SOC2
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-indigo-400"
              >
                FAQ
              </a>
            </nav>
            <div className="pt-3 border-t border-slate-800 flex gap-2">
              <Link
                href="/login"
                className="flex-1 text-center rounded-lg border border-slate-800 py-2 text-xs font-semibold text-slate-300"
              >
                Sign In
              </Link>
              <Link
                href="/dashboard"
                className="flex-1 text-center rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white"
              >
                Launch Workspace →
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* MAIN PAGE CONTENT */}
      <main className="relative z-10">
        {/* HERO SECTION */}
        <section className="relative px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center max-w-5xl mx-auto">
          {/* FLOATING ANNOUNCEMENT PILL */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-4 py-1.5 text-xs text-indigo-300 backdrop-blur-md hover:border-indigo-500/60 transition mb-8 group shadow-lg shadow-indigo-950/50">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="font-semibold">Nexus 2.0 Released:</span>
            <span className="text-slate-300">Autonomous Agent Workforce &amp; Cryptographic RBAC</span>
            <Link href="/agents" className="font-bold text-indigo-400 group-hover:translate-x-0.5 transition">
              Explore →
            </Link>
          </div>

          {/* MAIN HEADLINE */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
            The Enterprise AI <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
              Operating System
            </span>{" "}
            for Work
          </h1>

          {/* SUBTITLE */}
          <p className="mx-auto mt-6 max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed text-slate-400">
            Unify permission-governed vector retrieval, 6 role-guarded autonomous AI agents, and end-to-end workflow automation in one cryptographically audited workspace.
          </p>

          {/* CALL TO ACTION BUTTONS */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] transition active:scale-95"
            >
              <span>Explore Live Workspace</span>
              <span>→</span>
            </Link>

            <a
              href="#interactive-demo"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition shadow-sm"
            >
              <span>Try Interactive Simulator</span>
              <span>↓</span>
            </a>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-900/50 bg-indigo-950/30 px-5 py-3.5 text-sm font-semibold text-indigo-300 hover:bg-indigo-950/60 transition"
            >
              Create Account
            </Link>
          </div>

          {/* KEY TRUST STATS TICKER */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-800/80 pt-10 text-left">
            <div className="rounded-xl border border-slate-900 bg-slate-900/40 p-4 backdrop-blur-sm">
              <p className="text-xl md:text-2xl font-bold font-mono text-indigo-400">100% RBAC</p>
              <p className="mt-1 text-xs text-slate-400">Pre-filtered vector search with zero metadata leaks</p>
            </div>
            <div className="rounded-xl border border-slate-900 bg-slate-900/40 p-4 backdrop-blur-sm">
              <p className="text-xl md:text-2xl font-bold font-mono text-cyan-400">6 Agents</p>
              <p className="mt-1 text-xs text-slate-400">Guarded tools with role capability sandboxing</p>
            </div>
            <div className="rounded-xl border border-slate-900 bg-slate-900/40 p-4 backdrop-blur-sm">
              <p className="text-xl md:text-2xl font-bold font-mono text-purple-400">&lt; 120ms</p>
              <p className="mt-1 text-xs text-slate-400">Hybrid vector retrieval and context synthesis</p>
            </div>
            <div className="rounded-xl border border-slate-900 bg-slate-900/40 p-4 backdrop-blur-sm">
              <p className="text-xl md:text-2xl font-bold font-mono text-emerald-400">SOC2 Type II</p>
              <p className="mt-1 text-xs text-slate-400">Audit-ready immutable log stream and trace ledger</p>
            </div>
          </div>
        </section>

        {/* SECTION: INTERACTIVE LIVE DEMO SIMULATOR */}
        <section id="interactive-demo" className="px-6 py-20 border-t border-slate-900 bg-slate-950/60">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-indigo-400">
                Live Interactive Experience
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                Test the RAG &amp; Agent Security Firewall
              </h2>
              <p className="text-xs md:text-sm text-slate-400 max-w-2xl mx-auto">
                Toggle caller clearance roles to observe how Nexus enforces least-privilege tool execution and cryptographic document context gating.
              </p>
            </div>

            {/* SIMULATOR WORKBENCH CONTAINER */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-xl">
              {/* WORKBENCH TOP CONTROL BAR */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 bg-slate-950/70 p-4 gap-4">
                {/* SCENARIO SELECTOR TABS */}
                <div className="flex flex-wrap gap-2">
                  {SCENARIOS.map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => {
                        setActiveScenarioId(sc.id);
                        setSimulatedCustomInput("");
                      }}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        activeScenarioId === sc.id
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <span>{sc.icon}</span>
                      <span>{sc.category}</span>
                    </button>
                  ))}
                </div>

                {/* ROLE SWITCHER */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[11px] font-mono text-slate-400 font-semibold">Caller Role:</span>
                  <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-xs">
                    {["Employee", "Manager", "Admin", "CEO"].map((role) => (
                      <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-mono font-semibold transition ${
                          selectedRole === role
                            ? "bg-indigo-500 text-white shadow-xs"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SIMULATOR DUAL COLUMN DISPLAY */}
              <div className="grid lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
                {/* LEFT COLUMN: QUERY & RAG REASONING */}
                <div className="lg:col-span-7 p-6 space-y-6 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-400">
                        Knowledge Target: <strong className="text-indigo-400 font-bold">{activeScenario.collection} Domain</strong>
                      </span>
                      <span className="rounded-full bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 text-[10px] font-mono text-emerald-400 font-semibold">
                        RBAC Pre-Filtered
                      </span>
                    </div>

                    {/* USER QUERY BOX */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1">
                        Inbound Prompt
                      </p>
                      <p className="text-xs text-slate-200 font-medium">
                        {simulatedCustomInput || activeScenario.prompt}
                      </p>
                    </div>

                    {/* SYNTHESIZED RAG RESPONSE */}
                    <div className="rounded-2xl border border-indigo-900/40 bg-indigo-950/20 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 font-mono flex items-center gap-1.5">
                          <span>⚡</span> Nexus Grounded Completion
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">Latency: 84ms</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {simulating ? (
                          <span className="inline-flex items-center gap-2 text-indigo-300">
                            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                            Evaluating access rights &amp; retrieving vector chunks...
                          </span>
                        ) : (
                          activeScenario.response
                        )}
                      </p>
                    </div>

                    {/* CITATION SOURCES */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-2">
                        Authorized Citations
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {activeScenario.citations.map((c, i) => (
                          <div
                            key={i}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-300 font-mono"
                          >
                            <span className="text-slate-400">📄</span>
                            <span className="font-semibold text-slate-200">{c.document}</span>
                            <span className="text-slate-500">p.{c.page}</span>
                            <span className="rounded bg-indigo-950 border border-indigo-800 px-1 py-0.2 text-[9px] font-bold text-indigo-400">
                              {Math.round(c.similarity * 100)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM PROMPT INPUT IN SIMULATOR */}
                  <div className="pt-4 border-t border-slate-800">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={simulatedCustomInput}
                        onChange={(e) => setSimulatedCustomInput(e.target.value)}
                        placeholder={`Ask a question under ${selectedRole} clearance...`}
                        className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-indigo-500 transition"
                      />
                      <button
                        onClick={handleRunSimulation}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition active:scale-95 shadow-sm"
                      >
                        Simulate Query
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: GUARD EVALUATION & AUDIT TELEMETRY */}
                <div className="lg:col-span-5 p-6 bg-slate-950/50 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                      <span>🛡️</span> Security Guard Telemetry
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Live Evaluation</span>
                  </div>

                  <div className="space-y-3">
                    {activeScenario.tools.map((tool) => {
                      const isPermitted = tool.allowedRoles.includes(selectedRole);

                      return (
                        <div
                          key={tool.name}
                          className={`rounded-2xl border p-4 transition ${
                            isPermitted
                              ? "border-emerald-900/60 bg-emerald-950/20"
                              : "border-rose-900/60 bg-rose-950/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs">⚙️</span>
                              <span className="font-mono text-xs font-bold text-slate-200">{tool.name}</span>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold font-mono border ${
                                isPermitted
                                  ? "bg-emerald-950 border-emerald-800 text-emerald-400"
                                  : "bg-rose-950 border-rose-800 text-rose-400"
                              }`}
                            >
                              {isPermitted ? "✓ SUCCESS" : "⚠️ DENIED"}
                            </span>
                          </div>

                          <p className="mt-2 text-xs text-slate-300 leading-relaxed font-sans">
                            {isPermitted
                              ? tool.action
                              : `Access Denied: Caller role '${selectedRole}' lacks capability scope for tool '${tool.name}'.`}
                          </p>

                          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                            <span>Permitted Roles: {tool.allowedRoles.join(", ")}</span>
                            <span>Audit: Logged</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-xs text-slate-400 space-y-1">
                    <p className="font-bold text-slate-300 font-mono text-[11px]">Audit Ledger Guarantee</p>
                    <p className="text-[11px] leading-relaxed">
                      All execution events emit cryptographic audit traces storing user ID, IP address, and capability results for SOC2 / ISO verification.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: PRODUCT MODULES / FEATURE GRID */}
        <section id="features" className="px-6 py-24 max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-indigo-400">
              Enterprise Foundations
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
              Engineered for Mission-Critical Operations
            </h2>
            <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Every component of Nexus is built with strict boundary separation, deterministic access control, and complete operational transparency.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PRODUCT_MODULES.map((mod) => (
              <div
                key={mod.title}
                className="group relative flex flex-col justify-between rounded-3xl border border-slate-800/90 bg-slate-900/40 p-7 hover:border-indigo-500/50 hover:bg-slate-900/80 transition duration-300 shadow-lg hover:shadow-indigo-500/5"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-950/80 border border-indigo-800/60 text-2xl shadow-inner">
                      {mod.icon}
                    </span>
                    <span className="rounded-full bg-slate-800 border border-slate-700/80 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-slate-300">
                      {mod.badge}
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-white group-hover:text-indigo-400 transition">
                    {mod.title}
                  </h3>
                  <p className="text-xs font-mono text-indigo-400/90 font-semibold mt-0.5">
                    {mod.tagline}
                  </p>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    {mod.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80">
                  <Link
                    href={mod.link}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition"
                  >
                    <span>Launch Module</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: ARCHITECTURE PIPELINE FLOW */}
        <section id="architecture" className="px-6 py-24 border-t border-slate-900 bg-slate-950/80">
          <div className="max-w-6xl mx-auto space-y-14">
            <div className="text-center space-y-2">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-indigo-400">
                End-to-End Pipeline
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                How Nexus Processes an Enterprise Query
              </h2>
              <p className="text-xs md:text-sm text-slate-400 max-w-2xl mx-auto">
                Deterministic security boundary validation at every stage of the retrieval-augmented generation lifecycle.
              </p>
            </div>

            <div className="relative grid gap-4 md:grid-cols-5">
              {ARCHITECTURE_STAGES.map((st) => (
                <div
                  key={st.step}
                  className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5 relative hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-extrabold text-indigo-400">{st.step}</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">
                        {st.tag}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{st.title}</h3>
                    <p className="text-[11px] text-indigo-400 font-mono mt-0.5">{st.subtitle}</p>
                    <p className="mt-2.5 text-xs text-slate-400 leading-relaxed">{st.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ARCHITECTURE SUMMARY CALLOUT */}
            <div className="rounded-3xl border border-indigo-900/60 bg-gradient-to-r from-indigo-950/50 via-slate-900/80 to-purple-950/50 p-8 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <h3 className="text-lg font-bold text-white">
                    Pluggable Vector Store &amp; Isolated Tenant Models
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Nexus abstracts the vector persistence layer. Transition effortlessly from high-speed local vector storage in development to distributed multi-tenant Qdrant instances in production without changing application code.
                  </p>
                </div>
                <Link
                  href="/chat"
                  className="shrink-0 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-slate-200 transition shadow-md"
                >
                  Test Chat Architecture →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: AUTONOMOUS AGENT ROSTER */}
        <section id="agents" className="px-6 py-24 max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-indigo-400">
              Agentic Workforce
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
              6 Specialized Enterprise Agents
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Equipped with domain knowledge binding, deterministic permission guards, and live testing workspaces.
            </p>
          </div>

          {/* AGENT ROSTER TABS */}
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* AGENTS LIST SELECTOR */}
            <div className="lg:col-span-5 space-y-2">
              {AGENTS_ROSTER.map((agent) => {
                const isActive = agent.id === activeAgentId;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setActiveAgentId(agent.id)}
                    className={`w-full flex items-center justify-between rounded-2xl p-4 text-left transition border ${
                      isActive
                        ? "border-indigo-500 bg-indigo-950/40 text-white shadow-md shadow-indigo-950/50"
                        : "border-slate-800/80 bg-slate-900/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl">{agent.icon}</span>
                      <div className="truncate">
                        <p className="text-xs font-bold text-white truncate">{agent.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Domain: {agent.domain} • {agent.tools.length} Tools
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-indigo-400 font-mono font-bold">
                      {isActive ? "● Active" : "→"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* SELECTED AGENT PREVIEW CARD */}
            <div className="lg:col-span-7 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 space-y-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-950 border border-indigo-800 text-3xl shadow-inner">
                    {activeAgent.icon}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-white">{activeAgent.name}</h3>
                    <p className="text-xs text-indigo-400 font-mono mt-0.5">
                      Grounding Domain: <strong>{activeAgent.domain} Knowledge Scope</strong>
                    </p>
                  </div>
                </div>

                <Link
                  href={`/agents/${activeAgent.id}`}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-sm"
                >
                  Open Workspace ↗
                </Link>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                  System Persona Directive:
                </p>
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs font-mono text-slate-300 leading-relaxed">
                  {activeAgent.persona}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
                  Guarded Capabilities:
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeAgent.tools.map((t) => (
                    <span
                      key={t}
                      className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs font-mono text-slate-300"
                    >
                      ⚙️ {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Deterministic permission enforcement active</span>
                <Link
                  href={`/agents/${activeAgent.id}`}
                  className="font-bold text-indigo-400 hover:text-indigo-300 transition"
                >
                  Test agent in playground →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: SECURITY & SOC2 COMPLIANCE BADGES */}
        <section id="security" className="px-6 py-24 border-t border-slate-900 bg-slate-950/90">
          <div className="max-w-6xl mx-auto space-y-14">
            <div className="text-center space-y-3">
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-emerald-400">
                Enterprise Trust
              </span>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
                Bank-Grade Security Architecture
              </h2>
              <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
                Designed to satisfy the stringent requirements of Fortune 500 InfoSec teams and regulated industries.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
                <span className="text-3xl">🛡️</span>
                <h3 className="text-base font-bold text-white">SOC 2 Type II Certified</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Annual third-party audit verification evaluating system security, operational availability, confidentiality, and data integrity.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
                <span className="text-3xl">🔒</span>
                <h3 className="text-base font-bold text-white">ISO/IEC 27001 Controls</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Systematic information security management protocols protecting proprietary models, company IP, and vector embeddings.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
                <span className="text-3xl">🚫</span>
                <h3 className="text-base font-bold text-white">Zero Training Retention</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Customer documents and queries are never stored or retained to train public foundational LLM weights. Your IP remains your IP.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
                <span className="text-3xl">🔐</span>
                <h3 className="text-base font-bold text-white">AES-256 &amp; TLS 1.3</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  End-to-end cryptographic encryption across all states: AES-256 envelope encryption at rest and TLS 1.3 transport security.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
                <span className="text-3xl">📑</span>
                <h3 className="text-base font-bold text-white">PII &amp; Credential Redactor</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Automated scanning detects SSNs, credit card numbers, API keys, and sensitive employee PII prior to vector ingestion.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-3">
                <span className="text-3xl">📜</span>
                <h3 className="text-base font-bold text-white">Immutable Audit Ledger</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every document view, context grant, and agent tool execution is permanently logged with IP, user ID, and compliance status.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: FREQUENTLY ASKED QUESTIONS */}
        <section id="faq" className="px-6 py-24 max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-indigo-400">
              Frequently Asked Questions
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Everything You Need to Know
            </h2>
            <p className="text-xs md:text-sm text-slate-400 max-w-lg mx-auto">
              Clear answers to common questions about deployment, security, and agent governance.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden transition"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left text-xs md:text-sm font-bold text-slate-200 hover:text-white transition"
                  >
                    <span>{faq.q}</span>
                    <span className="ml-4 font-mono text-indigo-400 text-sm">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION: HIGH-CONVERSION BOTTOM CALL TO ACTION */}
        <section className="px-6 py-20 border-t border-slate-900">
          <div className="max-w-5xl mx-auto rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/60 via-slate-900/90 to-slate-950 p-10 md:p-16 text-center space-y-6 relative overflow-hidden shadow-2xl">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-950/60 px-3.5 py-1 text-xs font-mono text-indigo-300">
              <span>●</span> Production-Ready AI Infrastructure
            </span>

            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white max-w-2xl mx-auto leading-tight">
              Ready to deploy your enterprise AI workforce?
            </h2>

            <p className="text-sm md:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
              Experience the full power of grounded knowledge retrieval, multi-agent workflows, and verifiable access control today.
            </p>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] transition active:scale-95"
              >
                <span>Launch Demo Workspace</span>
                <span>→</span>
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition"
              >
                Create Free Account
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ENTERPRISE FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto grid gap-8 sm:grid-cols-2 md:grid-cols-4 pb-12 border-b border-slate-900">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 font-mono text-xs font-bold text-white">
                N
              </span>
              <span className="font-bold text-sm text-white">Nexus</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Enterprise AI Operating System for permissioned knowledge, guarded agent workflows, and operational automation.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All Systems Operational (99.99%)
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-200 uppercase tracking-wider font-mono text-[11px] mb-3">
              Platform Modules
            </h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <Link href="/chat" className="hover:text-indigo-400 transition">
                  Enterprise Chat 2.0
                </Link>
              </li>
              <li>
                <Link href="/agents" className="hover:text-indigo-400 transition">
                  Autonomous AI Agents
                </Link>
              </li>
              <li>
                <Link href="/documents" className="hover:text-indigo-400 transition">
                  Document Intelligence
                </Link>
              </li>
              <li>
                <Link href="/automation" className="hover:text-indigo-400 transition">
                  Workflow Automations
                </Link>
              </li>
              <li>
                <Link href="/analytics" className="hover:text-indigo-400 transition">
                  Operations Analytics
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-200 uppercase tracking-wider font-mono text-[11px] mb-3">
              Security &amp; Governance
            </h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <a href="#security" className="hover:text-indigo-400 transition">
                  SOC 2 Type II
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-indigo-400 transition">
                  ISO/IEC 27001
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-indigo-400 transition">
                  Zero Data Training
                </a>
              </li>
              <li>
                <Link href="/admin" className="hover:text-indigo-400 transition">
                  Immutable Audit Logs
                </Link>
              </li>
              <li>
                <a href="#architecture" className="hover:text-indigo-400 transition">
                  RBAC/ABAC Gate
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-200 uppercase tracking-wider font-mono text-[11px] mb-3">
              Developers &amp; API
            </h4>
            <ul className="space-y-2 text-slate-400">
              <li>
                <Link href="/automation" className="hover:text-indigo-400 transition">
                  S2S API Key Management
                </Link>
              </li>
              <li>
                <Link href="/automation" className="hover:text-indigo-400 transition">
                  n8n Webhook Simulator
                </Link>
              </li>
              <li>
                <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition">
                  FastAPI OpenAPI Docs ↗
                </a>
              </li>
              <li>
                <Link href="/settings" className="hover:text-indigo-400 transition">
                  Account Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Nexus Enterprise AI Inc. All rights reserved.</p>
          <div className="flex gap-6 text-slate-400">
            <Link href="/login" className="hover:text-slate-200 transition">
              Sign In
            </Link>
            <Link href="/register" className="hover:text-slate-200 transition">
              Register
            </Link>
            <Link href="/dashboard" className="hover:text-slate-200 transition">
              Workspace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
