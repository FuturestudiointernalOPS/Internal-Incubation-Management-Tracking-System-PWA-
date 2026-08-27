"use client";

import { useI18n } from "@/lib/i18n";

const STYLES = {
  draft: { color: "text-indigo-400", bg: "bg-indigo-500/10", dot: "bg-indigo-400" },
  published: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    dot: "bg-emerald-400",
  },
  archived: { color: "text-slate-400", bg: "bg-slate-500/10", dot: "bg-slate-400" },
};

/**
 * Course status pill (draft / published / archived).
 * Uses the design system's semantic colors — no hex values, no dark: variants.
 */
export default function CourseStatusBadge({ status }) {
  const { t } = useI18n();
  const s = STYLES[status] || STYLES.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${s.bg} ${s.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {t(`lms.status.${status}`)}
    </span>
  );
}
