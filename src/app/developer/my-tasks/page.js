"use client";

import {
  CheckSquare,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";

// Module scope on purpose: the hook keys its internal callback on this function,
// so an inline arrow would give it a new identity on every render and refetch in
// a loop.
const pickMyTasks = (d) => (d?.success ? d.tasks || [] : []);

export default function MyTasks() {
  const { t } = useI18n();
  // The identity now comes from the shell's session cache instead of the
  // browser's stored copy, so nothing has to be written from an effect. The
  // tasks follow it, and the screen keeps its spinner while that identity is
  // still on its way rather than briefly claiming there is nothing to do.
  const { cid } = useSessionUser();
  const {
    data: tasks,
    loading: tasksLoading,
    refresh,
  } = useApi(cid ? `/api/tasks?user_id=${cid}&sort=priority` : null, {
    defaultValue: [],
    transform: pickMyTasks,
    deps: [cid],
  });
  const loading = !cid || tasksLoading;

  return (
    <>
      <div className="space-y-8 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                {t("developerMisc.myTasks.eyebrow")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              {t("developerMisc.myTasks.title")}
            </h1>
            <p className="text-xs font-bold text-[var(--text-secondary)] opacity-60">
              {t("developerMisc.myTasks.subtitle", { count: tasks.length })}
            </p>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-[var(--border-primary)] rounded-xl text-[10px] font-bold uppercase tracking-wide hover:bg-tertiary transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t("developerMisc.myTasks.refresh")}
          </button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
              style={{ borderColor: "rgba(255,102,0,0.1)", borderTopColor: "var(--brand-orange)" }}
            />
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
            <CheckSquare className="w-16 h-16 text-slate-500 mb-4" />
            <p className="text-lg font-black text-[var(--text-primary)] uppercase">{t("developerMisc.myTasks.noTasks")}</p>
            <p className="text-xs font-bold text-[var(--text-secondary)] mt-1">
              {t("developerMisc.myTasks.noTasksHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="ios-card !p-4 border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {task.priority && (
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          task.priority === "critical" ? "bg-red-500/10 text-red-400" :
                          task.priority === "high" ? "bg-amber-500/10 text-amber-400" :
                          task.priority === "medium" ? "bg-blue-500/10 text-blue-400" :
                          "bg-slate-500/10 text-slate-400"
                        }`}>{task.priority}</span>
                      )}
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400">
                        {task.status?.replace("_", " ") || "pending"}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{task.title}</p>
                    {task.assigned_to && (
                      <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">{t("developerMisc.myTasks.assignedTo")}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0 ml-2" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
