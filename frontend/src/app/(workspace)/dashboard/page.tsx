import { WorkspacePage } from "@/components/workspace-page";

export default function DashboardPage() {
  return <WorkspacePage eyebrow="Overview" title="Good morning, Pratham" description="Here is a concise view of your workspace activity, AI usage, and items that need attention." action="Ask NexusAI" metrics={[{ label: "Knowledge sources", value: "24", change: "+3 this month" }, { label: "AI conversations", value: "128", change: "+18% this week" }, { label: "Active workflows", value: "6", change: "All operating normally" }]} items={[{ title: "Q2 Sales Report processed", detail: "Added to Company Knowledge by Maya Chen", status: "Ready" }, { title: "Weekly executive summary", detail: "Report Agent generated a draft", status: "Review" }, { title: "Expense approval workflow", detail: "Awaiting manager decision", status: "Pending" }]} />;
}
