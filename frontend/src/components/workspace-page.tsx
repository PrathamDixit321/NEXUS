import Link from "next/link";

type WorkspacePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  metrics: Array<{ label: string; value: string; change: string }>;
  items: Array<{ title: string; detail: string; status: string }>;
};

export function WorkspacePage({ eyebrow, title, description, action, metrics, items }: WorkspacePageProps) {
  return (
    <section className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-indigo-600">{eyebrow}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p></div>
        <button className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700">{action}</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map((metric) => <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{metric.label}</p><p className="mt-2 text-2xl font-semibold">{metric.value}</p><p className="mt-2 text-xs font-medium text-emerald-600">{metric.change}</p></article>)}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="font-semibold">Recent activity</h2><Link href="/tasks" className="text-sm font-medium text-indigo-600">View all</Link></div>
        <div className="divide-y divide-slate-100">
          {items.map((item) => <div key={item.title} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-sm text-slate-500">{item.detail}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{item.status}</span></div>)}
        </div>
      </div>
      <p className="text-xs text-slate-400">This screen uses demo data. Database-backed data will replace it in the integration phase.</p>
    </section>
  );
}
