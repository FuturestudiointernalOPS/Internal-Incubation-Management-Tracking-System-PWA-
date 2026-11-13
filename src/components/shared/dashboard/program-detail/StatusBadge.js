"use client";

import { useI18n } from "@/lib/i18n";
import { translateStatus } from "./translateStatus";

/** A coloured, localized pill for a submission / program status. */
export default function StatusBadge({ status }) {
  const { t } = useI18n();
  const config = {
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  const classes =
    config[status?.toLowerCase()] ||
    "bg-white/5 text-[var(--text-tertiary)] border-white/10";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${classes}`}
    >
      {translateStatus(status || "draft", t)}
    </span>
  );
}
