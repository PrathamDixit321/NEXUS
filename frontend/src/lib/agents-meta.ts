/**
 * Metadata configurations and sample prompts for enterprise AI agents.
 */

export interface AgentMeta {
  icon: string;
  category: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  samplePrompts: string[];
}

export const AGENT_META: Record<string, AgentMeta> = {
  "hr-policy": {
    icon: "👥",
    category: "People Operations",
    color: "from-blue-500/10 to-indigo-500/10 border-indigo-200",
    badgeBg: "bg-blue-50 border-blue-200",
    badgeText: "text-blue-700",
    samplePrompts: [
      "I want to submit a leave request for next week, notify HR.",
      "What is the company vacation and sick leave policy?",
      "Who should I contact regarding dental and health benefits?",
    ],
  },
  "finance-analyst": {
    icon: "📊",
    category: "Finance & Accounting",
    color: "from-emerald-500/10 to-teal-500/10 border-emerald-200",
    badgeBg: "bg-emerald-50 border-emerald-200",
    badgeText: "text-emerald-700",
    samplePrompts: [
      "Please calculate the total sum of this quarter's expenses.",
      "Export Q3 financial statements ledger to Excel.",
      "What is our allocated budget for infrastructure operations?",
    ],
  },
  "support-triage": {
    icon: "🛠️",
    category: "Customer Support & IT",
    color: "from-amber-500/10 to-orange-500/10 border-amber-200",
    badgeBg: "bg-amber-50 border-amber-200",
    badgeText: "text-amber-700",
    samplePrompts: [
      "Escalate critical database outage to on-call engineering.",
      "Create high priority Jira bug ticket for API latency spike.",
      "Summarize current open priority incidents for customer operations.",
    ],
  },
  "compliance-officer": {
    icon: "🛡️",
    category: "Information Security",
    color: "from-rose-500/10 to-pink-500/10 border-rose-200",
    badgeBg: "bg-rose-50 border-rose-200",
    badgeText: "text-rose-700",
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
    badgeBg: "bg-cyan-50 border-cyan-200",
    badgeText: "text-cyan-700",
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
    badgeBg: "bg-violet-50 border-violet-200",
    badgeText: "text-violet-700",
    samplePrompts: [
      "Generate executive report summary of cross-department operations.",
      "Create high-priority operational task to resolve workflow bottleneck.",
      "Broadcast executive brief to board and leadership dashboard.",
    ],
  },
};
