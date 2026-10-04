"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";

export default function VentureTasksArchiveBar({
  t,
  viewArchived,
  setViewArchived,
  setSearch,
  activeTasks,
  archivedTasks,
  archMsg,
  setArchMsg,
}) {
  return (
    <>
      {/* Archive toolbar + inline result */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setViewArchived(false); setSearch(""); }}
          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${!viewArchived ? "bg-brand-orange/15 text-[var(--brand-orange)] border-brand-orange/30" : "bg-tertiary border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"}`}>
          {t("vadmin.tasks.viewActive", { n: activeTasks.length })}
        </button>
        <button onClick={() => { setViewArchived(true); setSearch(""); }}
          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${viewArchived ? "bg-brand-orange/15 text-[var(--brand-orange)] border-brand-orange/30" : "bg-tertiary border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"}`}>
          {t("vadmin.tasks.viewArchived", { n: archivedTasks.length })}
        </button>
      </div>
      {archMsg && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold ${archMsg.type === "error" ? "bg-rose-500/10 text-rose-400 border border-rose-500/30" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"}`}>
          {archMsg.type === "error" ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{archMsg.msg}</span>
          <button onClick={() => setArchMsg(null)} className="ml-auto text-slate-500 hover:text-[var(--text-primary)]"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </>
  );
}
