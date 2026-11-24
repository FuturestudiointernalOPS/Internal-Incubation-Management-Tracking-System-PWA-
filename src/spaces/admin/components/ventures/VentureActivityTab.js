"use client";

import { Activity } from "lucide-react";
import { activityLabel, activityDetails } from "@/lib/ventureActivity";

export default function VentureActivityTab({
  t,
  venture,
  actorText,
  getActivityIcon,
  getActivityColor,
  lang,
}) {
  return (
    <>
      <div className="card">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("vadmin.detail.activityLog")}
        </h3>
        {(venture.activity || []).length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] py-6 text-center">{t("vadmin.detail.noActivityRecorded")}</p>
        ) : (
          <div className="space-y-1">
            {(venture.activity || []).map((activityEntry, index) => {
              const Icon = getActivityIcon(activityEntry.action);
              const color = getActivityColor(activityEntry.action);
              const details = activityDetails(activityEntry.details, t);
              return (
                <div key={activityEntry.id || index} className="flex items-start gap-4 p-3 rounded-lg hover:bg-tertiary transition-all">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-bold text-[var(--text-primary)]">{activityLabel(activityEntry.action, t)}</p>
                      <span className="text-[8px] text-slate-500">{actorText(activityEntry.actor_name)}</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      {new Date(activityEntry.created_at).toLocaleString(lang)}
                    </p>
                    {/* What actually changed — in words, never a raw payload. */}
                    {details.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {details.map((line, detailIndex) => (
                          <li key={detailIndex} className="text-[10px] text-[var(--text-secondary)]">
                            {line}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}