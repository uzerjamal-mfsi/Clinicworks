type Props = {
  status: string;
};

const styles: Record<string, string> = {
  PROCESSING: "bg-amber-50 text-amber-700 ring-amber-200",
  SUCCESS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  NEEDS_REVIEW: "bg-orange-50 text-orange-700 ring-orange-200",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function StatusBadge({ status }: Props) {
  const base = styles[status] ?? "bg-zinc-50 text-zinc-600 ring-zinc-200";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${base}`}>
      {status}
    </span>
  );
}
