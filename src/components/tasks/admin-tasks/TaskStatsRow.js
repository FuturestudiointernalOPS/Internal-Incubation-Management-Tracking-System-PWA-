"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";

/** The counts across every task, over the whole set rather than the filtered one. */
export default function TaskStatsRow({ stats, t }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {[
        {
          label: t("reports.totalReports"),
          value: stats.total,
          color: "text-[var(--text-primary)]",
          bg: "bg-white/5",
        },
        {
          label: t("reports.pending"),
          value: stats.pending,
          color: "text-slate-400",
          bg: "bg-slate-500/10",
        },
        {
          label: t("reports.inProgress"),
          value: stats.inProgress,
          color: "text-blue-500",
          bg: "bg-blue-500/10",
        },
        {
          label: t("reports.blocked"),
          value: stats.blocked,
          color: "text-rose-500",
          bg: "bg-rose-500/10",
        },
        {
          label: t("reports.completed"),
          value: stats.completed,
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
        },
        {
          label: t("reports.carriedOver"),
          value: stats.carriedOver,
          color: "text-amber-500",
          bg: "bg-amber-500/10",
        },
      ].map((stat) => (
        <div key={stat.label} className="card flex items-center gap-3 p-3">
          <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {stat.label}
            </p>
            <p className={`text-base font-black ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}