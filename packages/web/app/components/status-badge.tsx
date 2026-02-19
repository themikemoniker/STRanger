const colors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  running: "bg-blue-100 text-blue-700",
  passed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  error: "bg-red-100 text-red-700",
  mixed: "bg-yellow-100 text-yellow-700",
  skipped: "bg-gray-100 text-gray-500",
};

export function StatusBadge({ status }: { status: string }) {
  const colorClass = colors[status] || colors.draft;
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
