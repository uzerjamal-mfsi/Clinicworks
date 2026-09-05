"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "./StatusBadge";

type DocumentItem = {
  id: string;
  fileName: string;
  status: string;
  documentType: string | null;
  measureValue: string | null;
  measureDate: string | null;
  errorMessage: string | null;
  createdAt: string;
  dateProcessed: string | null;
};

type ApiResponse = {
  documents: DocumentItem[];
  total: number;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(d);
  } catch {
    return value;
  }
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(d);
  } catch {
    return "—";
  }
}

export function DocumentTable({ refreshKey }: { refreshKey?: number }) {
  const [data, setData] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/documents?limit=50", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      const json: ApiResponse = await res.json();
      setData(json.documents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs, refreshKey]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between px-6 py-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Documents</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {loading
              ? "Loading…"
              : `${data.length} ${data.length === 1 ? "document" : "documents"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchDocs();
          }}
          className="rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Refresh
        </button>
      </div>

      <div className="border-t border-zinc-200" />

      {loading ? (
        <div className="space-y-3 p-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex animate-pulse gap-4">
              <div className="h-10 w-10 rounded-xl bg-zinc-100" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-2/5 rounded bg-zinc-100" />
                <div className="h-3 w-3/5 rounded bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-10 text-center">
          <p className="text-sm text-rose-600">{error}</p>
          <button
            type="button"
            onClick={fetchDocs}
            className="mt-3 text-sm font-medium text-zinc-900 underline"
          >
            Try again
          </button>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-zinc-400">
              <path
                d="M7 3.5H14L20 9.5V18.5C20 19.6 19.1 20.5 18 20.5H7C5.9 20.5 5 19.6 5 18.5V5.5C5 4.4 5.9 3.5 7 3.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M14 3.5V9.5H20"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="mt-4 text-sm font-medium text-zinc-900">No documents yet</p>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">Upload a PDF to get started.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
                  <th className="px-6 py-3 font-medium">Document</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {data.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-6 py-4">
                      <p className="truncate text-sm font-medium text-zinc-900">{doc.fileName}</p>
                      <p className="text-xs text-zinc-500">
                        #{doc.id} · {formatTime(doc.createdAt)}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-700">{doc.documentType ?? "—"}</td>
                    <td className="px-4 py-4 font-mono text-sm text-zinc-700">
                      {doc.measureValue ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-600">
                      {formatDate(doc.measureDate)}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={doc.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-4 sm:hidden">
            {data.map((doc) => (
              <div key={doc.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-medium text-zinc-900">{doc.fileName}</p>
                  <StatusBadge status={doc.status} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  #{doc.id} · {formatDate(doc.createdAt)}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 text-xs">
                  <div>
                    <p className="text-zinc-500">Type</p>
                    <p className="mt-1 font-medium text-zinc-900">{doc.documentType ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Value</p>
                    <p className="mt-1 font-mono font-medium text-zinc-900">
                      {doc.measureValue ?? "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
