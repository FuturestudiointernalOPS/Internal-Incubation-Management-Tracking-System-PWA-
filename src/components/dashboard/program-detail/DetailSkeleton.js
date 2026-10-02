"use client";

/** The placeholder shown while the programme detail loads. */
export default function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-24 bg-white/10 rounded" />
      <div className="bg-[var(--bg-tertiary)] rounded-xl p-6 border border-[var(--border-primary)]">
        <div className="h-5 w-40 bg-white/10 rounded mb-3" />
        <div className="h-4 w-64 bg-white/5 rounded mb-2" />
        <div className="flex gap-2">
          <div className="h-5 w-20 bg-white/5 rounded" />
          <div className="h-5 w-24 bg-white/5 rounded" />
        </div>
      </div>
      {[...Array(3)].map((_, index) => (
        <div
          key={index}
          className="h-20 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
        />
      ))}
    </div>
  );
}
