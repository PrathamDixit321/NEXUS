"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

type Document = {
  id: string;
  name: string;
  collection: string;
  type: string;
  updated_at: string;
  owner: string;
  owner_id: string | null;
  status: string;
  size_bytes: number;
  classification: string;
  default_access: string;
};

type Chunk = {
  id: number;
  page_number: number;
  content: string;
};

export default function DocumentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [document, setDocument] = useState<Document | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (id) {
      // 1. Fetch metadata details
      apiFetch(`/api/v1/documents/${id}`)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(
              res.status === 404
                ? "Document not found or access denied."
                : "Unable to retrieve document details."
            );
          }
          return res.json();
        })
        .then((data) => {
          setDocument({
            id: data.id,
            name: data.name,
            collection: data.collection,
            type: data.name.split(".").pop()?.toUpperCase() ?? "FILE",
            updated_at: new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.updated_at)),
            owner: data.owner,
            owner_id: data.owner_id,
            status: data.status === "ready" ? "Ready" : "Processing",
            size_bytes: data.size_bytes,
            classification: data.classification || "INTERNAL",
            default_access: data.default_access || "ORGANIZATION",
          });
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });

      // 2. Fetch parsed text chunks
      apiFetch(`/api/v1/documents/${id}/chunks`)
        .then((res) => {
          if (res.ok) return res.json();
          return [];
        })
        .then((data) => {
          setChunks(data);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [id]);

  // Secure File Download trigger
  async function handleDownload() {
    if (!document) return;
    setDownloading(true);
    try {
      const response = await apiFetch(`/api/v1/documents/${document.id}/download`);
      if (!response.ok) throw new Error("Unauthorized or invalid file download context.");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = document.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">
        Loading document preview context...
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-rose-50 text-2xl text-rose-600 shadow-sm border border-rose-100">
          ⚠️
        </span>
        <h2 className="mt-6 text-xl font-semibold text-slate-900">Preview Blocked</h2>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          {error || "The document you are attempting to preview does not exist or you lack sufficient clearance."}
        </p>
        <Link
          href="/documents"
          className="mt-8 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
        >
          Back to Documents
        </Link>
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    return bytes < 1024 * 1024 
      ? `${Math.ceil(bytes / 1024)} KB` 
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-2">
        <Link href="/documents" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition">
          ← Back to Documents
        </Link>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        {/* Main Document Text Content Preview */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-[70vh]">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-xs font-bold text-indigo-700">
                {document.type}
              </span>
              <div>
                <h1 className="font-semibold text-slate-900 leading-tight">{document.name}</h1>
                <p className="text-xs text-slate-400 mt-0.5">Parsed Document Extraction Panel</p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              document.status === "Ready" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700 animate-pulse"
            }`}>
              {document.status}
            </span>
          </div>

          {/* Extracted chunks scroll window */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950 text-slate-300 font-mono text-sm leading-relaxed space-y-6 selection:bg-indigo-500 selection:text-white">
            {chunks.map((chunk) => (
              <div key={chunk.id} className="relative pt-4 border-t border-slate-800 first:border-0 first:pt-0">
                <span className="absolute top-0 right-0 text-[10px] text-slate-500 uppercase tracking-widest font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Page {chunk.page_number}
                </span>
                <p className="whitespace-pre-wrap">{chunk.content}</p>
              </div>
            ))}
            {chunks.length === 0 && (
              <div className="py-20 text-center text-slate-500 italic">
                {document.status === "Ready" 
                  ? "This document contains no readable text content." 
                  : "Parsing document text chunks in background... Please check back in a moment."}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info & Controls Panel */}
        <aside className="space-y-6">
          {/* Metadata Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">File Metadata</h2>
            
            <div className="space-y-3 text-sm text-slate-600">
              <div>
                <span className="text-xs text-slate-400 block">Owner Operator</span>
                <span className="font-medium text-slate-900">{document.owner}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">File Size</span>
                <span className="font-medium text-slate-900">{formatSize(document.size_bytes)}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Collection Bind</span>
                <span className="font-medium text-slate-900">{document.collection}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Updated Timestamp</span>
                <span className="font-medium text-slate-900">{document.updated_at}</span>
              </div>
            </div>
          </div>

          {/* Clearance & Security Settings Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clearance & Security</h2>
            
            <div className="space-y-3">
              <div>
                <span className="text-xs text-slate-400 block">Visibility Setting</span>
                <span className="mt-1 inline-block rounded bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 text-xs font-semibold uppercase">
                  {document.default_access}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Classification Badge</span>
                <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-semibold border ${
                  document.classification === "RESTRICTED" ? "bg-rose-50 text-rose-700 border-rose-200" :
                  document.classification === "CONFIDENTIAL" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  document.classification === "INTERNAL" ? "bg-blue-50 text-blue-700 border-blue-200" :
                  "bg-slate-50 text-slate-700 border-slate-200"
                }`}>
                  {document.classification}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <button
              onClick={handleDownload}
              disabled={downloading || document.status !== "Ready"}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? "Downloading..." : "Download File"}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
