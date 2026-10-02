"use client";

/** The placeholder tile shown while the dashboard loads. Extracted verbatim. */
export default function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-slate-700/50" />
        <div className="h-3 w-32 rounded bg-slate-700/50" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-3/4 rounded bg-slate-700/50" />
        <div className="h-4 w-1/2 rounded bg-slate-700/50" />
        <div className="h-4 w-2/3 rounded bg-slate-700/50" />
      </div>
    </div>
  );
}
