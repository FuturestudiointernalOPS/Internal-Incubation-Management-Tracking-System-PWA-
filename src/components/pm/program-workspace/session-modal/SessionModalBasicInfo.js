"use client";

import { useI18n } from "@/lib/i18n";

export default function SessionModalBasicInfo({
  t,
  newSession,
  onNewSessionChange,
  onScheduledDateChange,
  onEndDateChange,
  onStartTimeChange,
  onEndTimeChange,
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label
          className="text-[9px] font-black uppercase tracking-widest"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("pmMisc.workspace.sessionTitle")}
        </label>
        <input
          value={newSession.title}
          onChange={(event) =>
            onNewSessionChange((prev) => ({
              ...prev,
              title: event.target.value,
            }))
          }
          className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold transition-all focus:border-[var(--brand-orange)]"
          style={{
            background: "var(--bg-primary)",
            border: "1px solid var(--border-primary)",
            color: "var(--text-primary)",
          }}
          placeholder={t("pmMisc.workspace.sessionTitlePlaceholder")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("pmMisc.workspace.startDate")}
          </label>
          <input
            type="date"
            value={newSession.scheduled_date}
            onChange={(event) =>
              onScheduledDateChange((prev) => ({
                ...prev,
                scheduled_date: event.target.value,
              }))
            }
            className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("pmMisc.workspace.finishDate")}
          </label>
          <input
            type="date"
            value={newSession.end_date}
            onChange={(event) =>
              onEndDateChange((prev) => ({
                ...prev,
                end_date: event.target.value,
              }))
            }
            className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("pmMisc.workspace.startTime")}
          </label>
          <input
            type="time"
            value={newSession.start_time}
            onChange={(event) =>
              onStartTimeChange((prev) => ({
                ...prev,
                start_time: event.target.value,
              }))
            }
            className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />
        </div>
        <div className="space-y-1">
          <label
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("pmMisc.workspace.endTime")}
          </label>
          <input
            type="time"
            value={newSession.end_time}
            onChange={(event) =>
              onEndTimeChange((prev) => ({
                ...prev,
                end_time: event.target.value,
              }))
            }
            className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>
    </div>
  );
}