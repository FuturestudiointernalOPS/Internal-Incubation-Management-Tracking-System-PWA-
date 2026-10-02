"use client";

import { Activity, Plus } from "lucide-react";

/**
 * EMPTY STATE — shown when the payload holds nothing to show: a welcome and the
 * two doors out of it.
 *
 * Extracted verbatim from UnifiedDashboard; the two routes stay with the screen.
 */
export default function EmptyState({ onCreateTask, onViewProjects }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <Activity className="w-16 h-16 text-[var(--text-secondary)]" />
      <p className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
        Welcome to your dashboard
      </p>
      <p className="text-sm text-[var(--text-secondary)]">
        Start by creating tasks or joining projects.
      </p>
      <div className="flex gap-3 mt-4">
        <button
          onClick={onCreateTask}
          className="px-6 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all"
        >
          <Plus className="w-4 h-4 inline mr-1" /> Create Task
        </button>
        <button onClick={onViewProjects}>View Projects</button>
      </div>
    </div>
  );
}
