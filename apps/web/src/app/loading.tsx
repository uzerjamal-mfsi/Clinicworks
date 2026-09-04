export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 dark:bg-black px-6 py-24">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-6 w-3/4 rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-4 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-4 w-5/6 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    </div>
  );
}
