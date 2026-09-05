"use client";

import { useState } from "react";
import { DocumentTable } from "@/components/DocumentTable";
import { UploadCard } from "@/components/UploadCard";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-xs font-semibold text-white">
              CW
            </div>
            <span className="text-sm font-semibold text-zinc-900">ClinicWorks</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Upload and track clinical documents
          </h1>
        </div>

        <div className="mx-auto flex flex-col gap-8">
          <UploadCard onUploaded={() => setRefreshKey((k) => k + 1)} />
          <DocumentTable refreshKey={refreshKey} />
        </div>

        <footer className="mt-10 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} ClinicWorks
        </footer>
      </main>
    </div>
  );
}
