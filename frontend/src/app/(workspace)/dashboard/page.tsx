export default function DashboardPage() {
  const activity = [
    ["Q2 Sales Report processed", "Added to Company Knowledge by Maya Chen", "Ready"],
    ["Weekly executive summary", "Report Agent generated a draft", "Review"],
    ["Expense approval workflow", "Awaiting manager decision", "Pending"],
  ];

  return <section className="space-y-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-sm font-medium text-indigo-600">Monday, August 10</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Good morning, Pratham</h1><p className="mt-2 text-sm text-slate-600">Your workspace is healthy. There are 3 items that need your attention.</p></div>
      <a href="/chat" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-medium text-white shadow-sm hover:bg-indigo-700">Ask Nexus</a>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[['Knowledge sources', '24', '+3 this month'], ['AI conversations', '128', '+18% this week'], ['Active workflows', '6', 'All operating normally'], ['Pending approvals', '3', 'Needs attention']].map(([label, value, note]) => <article key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs font-medium text-emerald-600">{note}</p></article>)}
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <article className="rounded-xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm"><p className="text-sm font-medium text-indigo-300">AI workspace</p><h2 className="mt-2 text-2xl font-semibold">What do you want to accomplish?</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Ask a question, summarize a report, or explore the knowledge base. AI answers will include sources once RAG is connected.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><a href="/chat" className="rounded-lg border border-slate-700 bg-white/5 p-4 text-sm hover:bg-white/10"><span className="font-medium">Ask a question</span><span className="mt-1 block text-xs text-slate-400">Search company knowledge</span></a><a href="/reports" className="rounded-lg border border-slate-700 bg-white/5 p-4 text-sm hover:bg-white/10"><span className="font-medium">Create a report</span><span className="mt-1 block text-xs text-slate-400">Draft an executive summary</span></a></div></article>
      <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Attention needed</h2><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">3 items</span></div><div className="mt-5 space-y-4">{[['Review executive report', 'Report Agent'], ['Approve leave request', 'HR workflow'], ['Validate document access', 'Security review']].map(([title, source]) => <div key={title} className="flex gap-3"><span className="mt-1.5 h-2 w-2 rounded-full bg-amber-500"/><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-slate-500">{source}</p></div></div>)}</div><a href="/tasks" className="mt-6 block text-sm font-medium text-indigo-600">Open task queue →</a></article>
    </div>

    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Recent activity</h2><a href="/tasks" className="text-sm font-medium text-indigo-600">View all</a></div><div className="divide-y divide-slate-100">{activity.map(([title, detail, status]) => <div key={title} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{status}</span></div>)}</div></article>
  </section>;
}
