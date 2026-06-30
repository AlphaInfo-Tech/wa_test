"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { authedFetch } from "@/lib/auth/authed-fetch";

const STATUS_STYLES = {
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  processing: "bg-amber-50 text-amber-700 border-amber-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.processing;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {status}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "—";
  const d = value._seconds ? new Date(value._seconds * 1000) : new Date(value);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await authedFetch("/api/knowledge-base");
      if (!res.ok) throw new Error("Failed to load documents");
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadFile = useCallback(
    async (file) => {
      setError(null);
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await authedFetch("/api/knowledge-base", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        await fetchDocuments();
      } catch (err) {
        setError(err.message);
      } finally {
        setUploading(false);
      }
    },
    [fetchDocuments]
  );

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = ""; // allow re-uploading the same file name later
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDelete = async (docId) => {
    if (!confirm("Remove this document from the knowledge base?")) return;
    setDeletingId(docId);
    setError(null);
    try {
      const res = await authedFetch(`/api/knowledge-base?id=${docId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-900">Knowledge base</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload the documents your assistant should answer questions from. PDF, Word, or text files, up to 20MB each.
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragActive ? "border-slate-400 bg-slate-50" : "border-slate-200"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.docx"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        {uploading ? (
          <p className="text-sm text-slate-500">Uploading and indexing…</p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Drag a file here, or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-medium text-slate-900 underline underline-offset-2"
              >
                choose a file
              </button>
            </p>
            <p className="text-xs text-slate-400 mt-1">PDF, DOCX, TXT, MD — up to 20MB</p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Document list */}
      <div className="mt-8">
        {loading ? (
          <p className="text-sm text-slate-400">Loading documents…</p>
        ) : documents.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-400">
            No documents yet. Upload your first one above.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between px-4 py-3 bg-white"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{doc.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Uploaded {formatDate(doc.uploaded_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <StatusBadge status={doc.status} />
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="text-xs text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    {deletingId === doc.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
