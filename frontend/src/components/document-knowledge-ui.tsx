"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

type Document = {
  id: string;
  name: string;
  collection: string;
  type: "PDF" | "DOCX" | "PPTX" | "XLSX" | "FILE";
  updated: string;
  owner: string;
  owner_id: string | null;
  status: "Ready" | "Processing";
  size: string;
  classification: string;
  default_access: string;
};

function toDocument(document: any): Document {
  const extension = document.name.split(".").pop()?.toUpperCase() ?? "FILE";
  return {
    id: document.id,
    name: document.name,
    collection: document.collection,
    type: extension as Document["type"],
    updated: new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(document.updated_at)),
    owner: document.owner,
    owner_id: document.owner_id,
    status: document.status === "ready" ? "Ready" : "Processing",
    size: document.size_bytes < 1024 * 1024 ? `${Math.ceil(document.size_bytes / 1024)} KB` : `${(document.size_bytes / 1024 / 1024).toFixed(1)} MB`,
    classification: document.classification || "INTERNAL",
    default_access: document.default_access || "ORGANIZATION",
  };
}

const collections = [
  ["All knowledge", "24 sources", "#4f46e5"],
  ["People & policies", "8 sources", "#db2777"],
  ["Product", "6 sources", "#0891b2"],
  ["Sales operations", "5 sources", "#d97706"],
  ["Engineering", "5 sources", "#059669"],
] as const;

export function DocumentKnowledgeUI({ initialView }: { initialView: "knowledge" | "documents" }) {
  const { user } = useAuth();
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("All knowledge");
  const [uploaded, setUploaded] = useState(false);
  const [documentRows, setDocumentRows] = useState<Document[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  // Upload Access-Control States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sharingOptions, setSharingOptions] = useState<Array<{label: string, value: string}>>([]);
  const [uploadAccess, setUploadAccess] = useState("ORGANIZATION");
  const [uploadClassification, setUploadClassification] = useState("INTERNAL");

  // Manage Access States
  const [managingDoc, setManagingDoc] = useState<Document | null>(null);
  const [permissionsList, setPermissionsList] = useState<any[]>([]);
  const [mgmtAccess, setMgmtAccess] = useState("ORGANIZATION");
  const [mgmtClassification, setMgmtClassification] = useState("INTERNAL");
  const [newSubjectType, setNewSubjectType] = useState("USER");
  const [newSubjectId, setNewSubjectId] = useState("");
  const [newPermType, setNewPermType] = useState("VIEW");
  const [mgmtError, setMgmtError] = useState("");
  const [mgmtSuccess, setMgmtSuccess] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);

  const fetchDocuments = () => {
    apiFetch("/api/v1/documents")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        setDocumentRows(data.map(toDocument));
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    fetchDocuments();
    
    // Fetch user allowed sharing choices
    apiFetch("/api/v1/documents/sharing-options")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        setSharingOptions(data);
        if (data.length > 0) {
          setUploadAccess(data[0].value);
        }
      })
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => documentRows.filter((document) =>
    (collection === "All knowledge" || document.collection === collection) &&
    document.name.toLowerCase().includes(query.toLowerCase())
  ), [collection, documentRows, query]);

  // Handle selected file file selection
  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadError("");
  }

  // Handle actual file upload with settings
  async function performUpload() {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("collection", collection === "All knowledge" ? "General" : collection);
    formData.append("default_access", uploadAccess);
    formData.append("classification", uploadClassification);

    try {
      const response = await apiFetch("/api/v1/documents", { method: "POST", body: formData });
      if (!response.ok) throw new Error((await response.json()).detail ?? "Unable to upload this document.");
      const created = toDocument(await response.json());
      setDocumentRows((rows) => [created, ...rows]);
      setUploaded(true);
      setSelectedFile(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Unable to upload this document.");
    } finally {
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  // Open permissions manager
  async function openManageAccess(doc: Document) {
    setManagingDoc(doc);
    setMgmtError("");
    setMgmtSuccess(false);
    try {
      const response = await apiFetch(`/api/v1/documents/${doc.id}/permissions`);
      if (!response.ok) throw new Error("Could not retrieve permissions metadata.");
      const data = await response.json();
      setPermissionsList(data.permissions);
      setMgmtAccess(data.default_access);
      setMgmtClassification(data.classification);
    } catch (error) {
      setMgmtError(error instanceof Error ? error.message : "Failed loading metadata.");
    }
  }

  // Add explicit grant rule
  function addPermissionGrant() {
    if (!newSubjectId.trim()) return;
    const isDuplicate = permissionsList.some(
      (p) => p.subject_type === newSubjectType && p.subject_id === newSubjectId
    );
    if (isDuplicate) {
      setMgmtError("Subject entry permission already defined.");
      return;
    }

    const newGrant = {
      subject_type: newSubjectType,
      subject_id: newSubjectId.trim(),
      permission_type: newPermType,
    };
    setPermissionsList([...permissionsList, newGrant]);
    setNewSubjectId("");
    setMgmtError("");
  }

  // Remove explicit grant rule
  function removePermissionGrant(index: number) {
    setPermissionsList(permissionsList.filter((_, idx) => idx !== index));
  }

  // Save changes to permissions
  async function savePermissions() {
    if (!managingDoc) return;
    setMgmtError("");
    setMgmtSuccess(false);
    try {
      const response = await apiFetch(`/api/v1/documents/${managingDoc.id}/permissions`, {
        method: "POST",
        body: JSON.stringify({
          default_access: mgmtAccess,
          classification: mgmtClassification,
          permissions: permissionsList,
        }),
      });

      if (!response.ok) {
        throw new Error((await response.json()).detail ?? "Unable to update access configuration.");
      }

      setMgmtSuccess(true);
      fetchDocuments(); // Refresh general document list
      setTimeout(() => setManagingDoc(null), 1000);
    } catch (error) {
      setMgmtError(error instanceof Error ? error.message : "Unable to save permissions.");
    }
  }

  // Trigger file download securely
  async function downloadDoc(doc: Document) {
    try {
      const response = await apiFetch(`/api/v1/documents/${doc.id}/download`);
      if (!response.ok) throw new Error("Unauthorized to download this file.");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = doc.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Download failed.");
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Knowledge workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Documents & knowledge</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Bring approved company context together so people and Nexus can find reliable answers.
          </p>
        </div>
        <button
          onClick={() => fileInput.current?.click()}
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          Upload document
        </button>
      </header>

      {uploaded && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>Upload queued. Your file will be indexed before it becomes searchable.</span>
          <button onClick={() => setUploaded(false)} className="font-medium">
            Dismiss
          </button>
        </div>
      )}

      {uploadError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {uploadError}
        </div>
      )}

      <input
        ref={fileInput}
        onChange={handleFileSelect}
        accept=".pdf,.docx,.pptx,.xlsx"
        className="hidden"
        type="file"
      />

      {/* ----------------------------------------------------
          UPLOAD SETTINGS ACCESS-CONTROL MODAL (Phase 3)
         ---------------------------------------------------- */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">Upload Options</h3>
            <p className="mt-1 text-sm text-slate-500">Configure security settings for {selectedFile.name}</p>

            <div className="mt-4 space-y-4">
              {/* Access Levels Options */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Document Visibility</label>
                <select
                  value={uploadAccess}
                  onChange={(e) => setUploadAccess(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:bg-white"
                >
                  {sharingOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Classification dropdown */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Classification Rating</label>
                <select
                  value={uploadClassification}
                  onChange={(e) => setUploadClassification(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:bg-white"
                >
                  <option value="PUBLIC">PUBLIC (Everyone can access)</option>
                  <option value="INTERNAL">INTERNAL (Internal organization only)</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL (High restriction department audits)</option>
                  <option value="RESTRICTED">RESTRICTED (Executive Eyes Only)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedFile(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={performUpload}
                disabled={isUploading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {isUploading ? "Uploading..." : "Publish Document"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------
          MANAGE ACCESS SECURITY CONFIGURATION MODAL (Phase 4)
         ---------------------------------------------------- */}
      {managingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Manage Access</h3>
                <p className="text-sm text-slate-500 truncate max-w-xs">{managingDoc.name}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                Owner: {managingDoc.owner}
              </span>
            </div>

            {mgmtError && (
              <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 border border-rose-100">
                {mgmtError}
              </div>
            )}
            {mgmtSuccess && (
              <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 border border-emerald-100">
                Access configuration updated successfully!
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Default Access</label>
                  <select
                    value={mgmtAccess}
                    onChange={(e) => setMgmtAccess(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    {sharingOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Classification</label>
                  <select
                    value={mgmtClassification}
                    onChange={(e) => setMgmtClassification(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="PUBLIC">PUBLIC</option>
                    <option value="INTERNAL">INTERNAL</option>
                    <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                    <option value="RESTRICTED">RESTRICTED</option>
                  </select>
                </div>
              </div>

              {/* Explicit grants section */}
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Explicit Permissions</h4>
                
                {/* List rules */}
                <div className="mt-2 space-y-2 max-h-36 overflow-y-auto pr-1">
                  {permissionsList.map((perm, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs text-slate-600 border border-slate-100">
                      <div>
                        <span className="font-semibold text-slate-800">[{perm.subject_type}]</span> {perm.subject_id} — <span className="text-indigo-600 font-medium">{perm.permission_type}</span>
                      </div>
                      <button
                        onClick={() => removePermissionGrant(idx)}
                        className="text-slate-400 hover:text-rose-600 text-sm font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {permissionsList.length === 0 && (
                    <p className="text-xs text-slate-400 italic py-2">No explicit sharing permissions added.</p>
                  )}
                </div>

                {/* Form to add rule */}
                <div className="mt-3 grid grid-cols-12 gap-2 items-end bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <div className="col-span-3">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Subject</label>
                    <select
                      value={newSubjectType}
                      onChange={(e) => setNewSubjectType(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none"
                    >
                      <option value="USER">USER ID</option>
                      <option value="ROLE">ROLE ID</option>
                      <option value="DEPARTMENT">DEPARTMENT ID</option>
                      <option value="TEAM">TEAM ID</option>
                    </select>
                  </div>
                  <div className="col-span-5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Subject ID / Value</label>
                    <input
                      type="text"
                      placeholder="e.g. employee-id-123"
                      value={newSubjectId}
                      onChange={(e) => setNewSubjectId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Access</label>
                    <select
                      value={newPermType}
                      onChange={(e) => setNewPermType(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none"
                    >
                      <option value="VIEW">VIEW</option>
                      <option value="DOWNLOAD">DOWNLOAD</option>
                      <option value="EDIT">EDIT</option>
                      <option value="SHARE">SHARE</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={addPermissionGrant}
                      className="w-full rounded-lg bg-indigo-600 py-1.5 text-white font-bold text-xs hover:bg-indigo-700 flex items-center justify-center h-8"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => setManagingDoc(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={savePermissions}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {(["knowledge", "documents"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className={`border-b-2 px-4 py-3 text-sm font-medium capitalize ${
              view === tab ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between px-2 pb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Collections</p>
            <button className="text-lg leading-none text-slate-400 hover:text-indigo-600">+</button>
          </div>
          <div className="space-y-1">
            {collections.map(([name, count, color]) => (
              <button
                key={name}
                onClick={() => setCollection(name)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm ${
                  collection === name ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="flex-1">{name}</span>
                <span className="text-xs text-slate-400">{count.split(" ")[0]}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 border-t border-slate-100 px-2 pt-4">
            <p className="text-xs font-medium text-slate-500">Storage</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[28%] rounded-full bg-indigo-600" />
            </div>
            <p className="mt-2 text-xs text-slate-400">2.8 GB of 10 GB used</p>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          {view === "knowledge" && (
            <div className="grid gap-4 md:grid-cols-3">
              {collections.slice(1).map(([name, count, color]) => (
                <button
                  key={name}
                  onClick={() => {
                    setCollection(name);
                    setView("documents");
                  }}
                  className="group rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                >
                  <span
                    className="grid h-9 w-9 place-items-center rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {name.charAt(0)}
                  </span>
                  <p className="mt-5 font-semibold">{name}</p>
                  <p className="mt-1 text-sm text-slate-500">{count} · Available in search</p>
                  <p className="mt-5 text-sm font-medium text-indigo-600">Open collection →</p>
                </button>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">{view === "knowledge" ? "Recent knowledge" : "All documents"}</h2>
                <p className="mt-1 text-sm text-slate-500">{filtered.length} files · Permission-aware access</p>
              </div>
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search documents..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 sm:w-52"
                />
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  Filter
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Collection</th>
                    <th className="px-4 py-3 font-medium">Classification</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((document) => (
                    <tr key={document.id ?? document.name} className="border-t border-slate-100 text-slate-600 hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-[10px] font-bold text-indigo-700">
                            {document.type}
                          </span>
                          <div>
                            <span className="font-medium text-slate-900">{document.name}</span>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {document.owner} · {document.size} · Updated {document.updated}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">{document.collection}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                          document.classification === "RESTRICTED" ? "bg-rose-50 text-rose-700 border-rose-200" :
                          document.classification === "CONFIDENTIAL" ? "bg-amber-50 text-amber-700 border-amber-200" :
                          document.classification === "INTERNAL" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          "bg-slate-50 text-slate-700 border-slate-200"
                        }`}>
                          {document.classification}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          document.status === "Ready" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {document.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2.5">
                          {document.status === "Ready" && (
                            <button
                              onClick={() => downloadDoc(document)}
                              className="text-xs font-semibold text-slate-500 hover:text-indigo-600"
                            >
                              Download
                            </button>
                          )}
                          {(user?.role === "Admin" || user?.role === "CEO" || document.owner_id === user?.id) && (
                            <button
                              onClick={() => openManageAccess(document)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                              Manage Access
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-500">No documents match your search.</p>
            )}
          </div>
          {view === "documents" && (
            <button
              onClick={() => fileInput.current?.click()}
              disabled={isUploading}
              className="flex w-full flex-col items-center rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-6 py-7 text-center hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-70"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-xl text-indigo-600 shadow-sm">
                ↑
              </span>
              <span className="mt-3 text-sm font-medium text-indigo-700">
                {isUploading ? "Uploading document..." : "Drop files here or choose files to upload"}
              </span>
              <span className="mt-1 text-xs text-slate-500">PDF, DOCX, PPTX and XLSX up to 50 MB</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
