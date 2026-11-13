"use client";

import { Calendar, X } from "lucide-react";

/**
 * EVENT DETAIL DRAWER — the calendar event opened from any view.
 *
 * Extracted verbatim from UnifiedDashboard.
 */
export default function EventDetailDrawer({ event, onClose, onOpenProject }) {
  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={(domEvent) => domEvent.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--brand-orange)]" />
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
              Event
            </h3>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm font-bold text-[var(--text-primary)]">{event.title}</p>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="p-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-0.5">
              Date
            </p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{event.date}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-0.5">
              Source
            </p>
            <p className="text-sm font-bold text-[var(--text-primary)] capitalize">
              {event.source}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-0.5">
              Type
            </p>
            <p className="text-sm font-bold text-[var(--text-primary)] capitalize">
              {event.type?.replace(/_/g, " ")}
            </p>
          </div>
          {event.status && (
            <div className="p-2.5 rounded-lg bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-0.5">
                Status
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)] capitalize">
                {event.status}
              </p>
            </div>
          )}
        </div>
        {event.project_id && (
          <button
            onClick={() => onOpenProject(event.project_id)}
            className="w-full py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all"
          >
            View Related Project
          </button>
        )}
      </div>
    </div>
  );
}
