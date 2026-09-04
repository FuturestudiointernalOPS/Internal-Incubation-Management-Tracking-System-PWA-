"use client";

import { useI18n } from "@/lib/i18n";

/**
 * VentureStatusBadge — shared lifecycle status pill (Active / Paused /
 * Archived). Colors follow the platform tokens; labels come from locales.
 */
const STATUS_META = {
  active: { key: "venture.statusActive", text: "text-emerald-400", dot: "bg-emerald-400" },
  paused: { key: "venture.statusPaused", text: "text-amber-400", dot: "bg-amber-400" },
  archived: { key: "venture.statusArchived", text: "text-zinc-400", dot: "bg-zinc-400" },
};

export default function VentureStatusBadge({ status }) {
  const { t } = useI18n();
  const key = String(status || "active").toLowerCase();
  const meta = STATUS_META[key] || STATUS_META.active;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-wider ${meta.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {t(meta.key)}
    </span>
  );
}
