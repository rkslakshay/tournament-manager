import type { TournamentStatus } from "@/lib/tournament-config";

const LABELS: Record<TournamentStatus, { text: string; className: string }> = {
  DRAFT: {
    text: "Draft",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  REGISTRATION: {
    text: "Upcoming",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
  IN_PROGRESS: {
    text: "Live",
    className: "bg-accent-100 text-accent-900 dark:bg-accent-900/50 dark:text-accent-100",
  },
  COMPLETED: {
    text: "Completed",
    className: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  },
  ARCHIVED: {
    text: "Archived",
    className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  },
};

/** Tournament status as a labelled pill (text, not colour alone, carries the meaning). */
export function StatusBadge({ status }: { status: TournamentStatus }) {
  const { text, className } = LABELS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {status === "IN_PROGRESS" && (
        <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-600" />
      )}
      {text}
    </span>
  );
}
