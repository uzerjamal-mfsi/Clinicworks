"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ reset }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 dark:bg-black">
        <div className="flex min-h-screen items-center justify-center px-6 py-24">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Application error
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              A critical error occurred. Please reload the page.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
