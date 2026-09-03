"use client";

import { CalendarDays } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";

/* Calendar Tab */
export function CalendarTab() {
  const { t } = useI18n();
  const { calendarEvents, cardStyle } = useVenture();
  return (
    <div className="space-y-4">
      <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5"><CalendarDays size={14} /> {t('venture.calendar')}</h2>
      {calendarEvents.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>{t('venture.noEvents')}</div>) :
        calendarEvents.map((ev, i) => {
          const typeIcon = ev.type === 'milestone' ? '🗓' : ev.type === 'task' ? '📋' : ev.type === 'action' ? '📌' : ev.type === 'coaching' ? '🎯' : ev.type === 'followup' ? '📅' : '📅';
          const statusMap = { not_started: 'notStarted', in_progress: 'inProgress', completed: 'completed', done: 'completed', pending_review: 'pendingReview', revision_requested: 'revisionRequested' };
          const statusClass = ev.status === 'completed' || ev.status === 'done' ? 'bg-green-500/20 text-green-400' : ev.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-slate-400';
          return (
            <div key={i} className="rounded-xl p-4 border" style={cardStyle}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold mb-1 flex items-center gap-2">
                    <span className="shrink-0">{typeIcon}</span>
                    <span className="truncate">{ev.title}</span>
                  </p>
                  {ev.date && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>📅 {new Date(ev.date).toLocaleDateString()}{ev.start_time ? ` at ${ev.start_time}` : ''}</p>}
                  {ev.location && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>📍 {ev.location}</p>}
                  {ev.meeting_link && <p className="text-xs"><a href={ev.meeting_link} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">🔗 Link</a></p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusClass}`}>
                  {t(`venture.${statusMap[ev.status] || ev.status || 'notStarted'}`)}
                </span>
              </div>
              {(ev.type === 'task' || ev.type === 'action') && ev.priority && (
                <div className="flex gap-2 mt-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${ev.priority === 'high' ? 'bg-red-500/20 text-red-400' : ev.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {t(`venture.${ev.priority}`)}
                  </span>
                </div>
              )}
            </div>
          );
        })
      }
    </div>
  );
}
