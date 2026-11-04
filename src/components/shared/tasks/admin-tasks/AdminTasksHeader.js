"use client";

import React from "react";
import { ArrowLeft, ListTodo, RefreshCw } from "lucide-react";

/** The dashboard's header: where it is, how many tasks there are, and a refresh. */
export default function AdminTasksHeader({ taskCount, onBack, onRefresh, t }) {
  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
      <div className="space-y-2">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[10px] uppercase tracking-wide"
        >
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
          {t("adminMisc.tasks.dashboard")}
        </button>
        <div className="flex items-center gap-2 mt-2">
          <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
            {t("navigation.internalReports")}
          </span>
        </div>
        <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
          {t("reports.taskManagement")}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)]">
          <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-xs font-black">
            {taskCount} {t("reports.tasks")}
          </span>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl hover:bg-white/5 transition-all"
          title={t("common.refresh")}
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>
    </header>
  );
}