"use client";

import { useCallback, useRef, useState } from "react";

type UploadResult = {
  id: string;
  status: string;
  fileName: string;
};

type Props = {
  onUploaded?: (result: UploadResult) => void;
};

export function UploadCard({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<UploadResult | null>(null);

  const validate = useCallback((f: File): string | null => {
    if (f.size === 0) return "File is empty";
    if (f.size > 10 * 1024 * 1024) return "File too large - max 10 MB";
    if (!f.name.toLowerCase().endsWith(".pdf")) return "Only PDF files are accepted";
    return null;
  }, []);

  function pickFile(f: File | null) {
    setError(null);
    setSuccess(null);
    if (!f) {
      setFile(null);
      return;
    }
    const msg = validate(f);
    if (msg) {
      setError(msg);
      setFile(null);
      return;
    }
    setFile(f);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    pickFile(e.target.files?.[0] ?? null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: data });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Upload failed");
        return;
      }
      const result: UploadResult = {
        id: String(json.id),
        status: String(json.status ?? "PROCESSING"),
        fileName: String(json.fileName ?? file.name),
      };
      setSuccess(result);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded?.(result);
    } catch {
      setError("Network error - please try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-zinc-900">Upload document</h2>
      <p className="mt-1 text-sm text-zinc-500">PDF only · Max 10 MB</p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center ${
          dragOver ? "border-zinc-900 bg-zinc-50" : "border-zinc-300 bg-white"
        }`}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-zinc-700">
            <path
              d="M12 16V4M12 4L8 8M12 4L16 8M4 14V18C4 19.1 4.9 20 6 20H18C19.1 20 20 19.1 20 18V14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="mt-3 text-sm font-medium text-zinc-900">Drop your PDF here</p>
        <p className="mt-1 text-sm text-zinc-500">
          or{" "}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-medium text-zinc-900 underline underline-offset-4"
          >
            browse files
          </button>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {file ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900">{file.name}</p>
            <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setError(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-white hover:text-zinc-700"
            aria-label="Remove file"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 18L18 6M6 6L18 18"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span className="font-medium">{success.fileName}</span> - {success.status}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || uploading}
        className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-zinc-500"
      >
        {uploading ? "Uploading…" : "Upload PDF"}
      </button>
    </div>
  );
}
