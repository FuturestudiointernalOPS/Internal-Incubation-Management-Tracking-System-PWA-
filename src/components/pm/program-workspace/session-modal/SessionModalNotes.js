"use client";

import { useI18n } from "@/lib/i18n";

export default function SessionModalNotes({
  t,
  newSession,
  onNotesChange,
}) {
  return (
    <div className="space-y-1">
      <label
        className="text-[10px] font-black uppercase tracking-widest"
        style={{ color: "var(--text-secondary)" }}
      >
        {t("pmMisc.workspace.sessionNotes")}
      </label>
      <textarea
        value={newSession.notes}
        onChange={(event) =>
          onNotesChange((prev) => ({
            ...prev,
            notes: event.target.value,
          }))
        }
        rows={3}
        className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold resize-none"
        style={{
          background: "var(--bg-primary)",
          border: "1px solid var(--border-primary)",
          color: "var(--text-primary)",
        }}
        placeholder={t("pmMisc.workspace.sessionNotesPlaceholder")}
      />
    </div>
  );
}