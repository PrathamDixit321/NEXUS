"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Document = {
  name: string;
  collection: string;
  type: "PDF" | "DOCX" | "PPTX" | "XLSX";
  updated: string;
  owner: string;
  status: "Ready" | "Processing";
  size: string;
};

const documents: Document[] = [
  { name: "FY26 Product Roadmap", collection: "Product", type: "PPTX", updated: "Today, 10:42 AM", owner: "Maya Chen", status: "Ready", size: "4.2 MB" },
  { name: "Employee Handbook", collection: "People & policies", type: "DOCX", updated: "Yesterday", owner: "Priya Shah", status: "Ready", size: "1.8 MB" },
  { name: "Q2 Sales Report", collection: "Sales operations", type: "PDF", updated: "Aug 8", owner: "Alex Morgan", status: "Ready", size: "2.6 MB" },
  { name: "Security Incident Playbook", collection: "Engineering", type: "PDF", updated: "Aug 7", owner: "David Kim", status: "Processing", size: "932 KB" },
  { name: "Customer Discovery Notes", collection: "Product", type: "DOCX", updated: "Aug 5", owner: "Maya Chen", status: "Ready", size: "688 KB" },
  { name: "FY26 Hiring Plan", collection: "People & policies", type: "XLSX", updated: "Aug 1", owner: "Priya Shah", status: "Ready", size: "1.1 MB" },
];

const collections = [
  ["All knowledge", "24 sources", "#4f46e5"],
  ["People & policies", "8 sources", "#db2777"],
  ["Product", "6 sources", "#0891b2"],
  ["Sales operations", "5 sources", "#d97706"],
  ["Engineering", "5 sources", "#059669"],
] as const;

export function DocumentKnowledgeUI({ initialView }: { initialView: "knowledge" | "documents" }) {
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("All knowledge");
  const [uploaded, setUploaded] = useState(false);
  const filtered = useMemo(() => documents.filter((document) =>
    (collection === "All knowledge" || document.collection === collection) &&
    document.name.toLowerCase().includes(query.toLowerCase())
  ), [collection, query]);

  return <section className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-indigo-600">Knowledge workspace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Documents & knowledge</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Bring approved company context together so people and Nexus can find reliable answers.</p>
      </div>
      <button onClick={() => setUploaded(true)} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700">Upload document</button>
    </header>

    {uploaded && <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span>Upload queued. Your file will be indexed before it becomes searchable.</span><button onClick={() => setUploaded(false)} className="font-medium">Dismiss</button></div>}

    <div className="flex gap-1 border-b border-slate-200">
      {(["knowledge", "documents"] as const).map((tab) => <button key={tab} onClick={() => setView(tab)} className={`border-b-2 px-4 py-3 text-sm font-medium capitalize ${view === tab ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{tab}</button>)}
    </div>

    <div className="grid gap-6 xl:grid-cols-[245px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between px-2 pb-3"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Collections</p><button className="text-lg leading-none text-slate-400 hover:text-indigo-600">+</button></div>
        <div className="space-y-1">{collections.map(([name, count, color]) => <button key={name} onClick={() => setCollection(name)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm ${collection === name ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} /><span className="flex-1">{name}</span><span className="text-xs text-slate-400">{count.split(" ")[0]}</span></button>)}</div>
        <div className="mt-4 border-t border-slate-100 px-2 pt-4"><p className="text-xs font-medium text-slate-500">Storage</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[28%] rounded-full bg-indigo-600" /></div><p className="mt-2 text-xs text-slate-400">2.8 GB of 10 GB used</p></div>
      </aside>

      <div className="min-w-0 space-y-5">
        {view === "knowledge" && <div className="grid gap-4 md:grid-cols-3">
          {collections.slice(1).map(([name, count, color]) => <button key={name} onClick={() => { setCollection(name); setView("documents"); }} className="group rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"><span className="grid h-9 w-9 place-items-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: color }}>{name.charAt(0)}</span><p className="mt-5 font-semibold">{name}</p><p className="mt-1 text-sm text-slate-500">{count} · Available in search</p><p className="mt-5 text-sm font-medium text-indigo-600">Open collection →</p></button>)}
        </div>}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">{view === "knowledge" ? "Recent knowledge" : "All documents"}</h2><p className="mt-1 text-sm text-slate-500">{filtered.length} files · Permission-aware access</p></div><div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 sm:w-52" /><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Filter</button></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Collection</th><th className="px-4 py-3 font-medium">Updated</th><th className="px-4 py-3 font-medium">Status</th><th className="px-5 py-3" /></tr></thead><tbody>{filtered.map((document) => <tr key={document.name} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-[10px] font-bold text-indigo-700">{document.type}</span><div><Link href={`/documents/${document.name.toLowerCase().replaceAll(" ", "-")}`} className="font-medium text-slate-900 hover:text-indigo-600">{document.name}</Link><p className="mt-0.5 text-xs text-slate-400">{document.owner} · {document.size}</p></div></div></td><td className="px-4 py-4">{document.collection}</td><td className="px-4 py-4">{document.updated}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${document.status === "Ready" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{document.status}</span></td><td className="px-5 py-4 text-right"><button className="text-slate-400 hover:text-slate-700">•••</button></td></tr>)}</tbody></table></div>
          {filtered.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">No documents match your search.</p>}
        </div>
        {view === "documents" && <button onClick={() => setUploaded(true)} className="flex w-full flex-col items-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-6 py-7 text-center hover:bg-indigo-50"><span className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl text-indigo-600 shadow-sm">↑</span><span className="mt-3 text-sm font-medium text-indigo-700">Drop files here or choose files to upload</span><span className="mt-1 text-xs text-slate-500">PDF, DOCX, PPTX and XLSX up to 50 MB</span></button>}
      </div>
    </div>
  </section>;
}
