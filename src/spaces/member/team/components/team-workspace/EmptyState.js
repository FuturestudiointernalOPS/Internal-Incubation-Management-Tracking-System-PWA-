"use client";

/**
 * The centred empty state the workspace's panels fall back to.
 * Extracted verbatim from the empty-state renderer in app/team/[id]/page.js.
 */
export default function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--surface-3)] flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-bold text-[var(--text-primary)] mb-1">
        {title}
      </p>
      <p className="text-xs text-[var(--text-secondary)] max-w-xs">{description}</p>
    </div>
  );
}