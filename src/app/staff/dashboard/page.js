"use client";

import { useState } from "react";
import {
  Clock,
  Star,
  ArrowRight,
  Activity,
} from "lucide-react";
import StandupRetroView from "@/components/dashboard/StandupRetroView";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";

// Module scope on purpose: the hook keys its internal callback on these functions,
// so inline arrows would give them a new identity on every render and refetch in
// a loop.
const pickStaffAssignments = (d) => (d?.success ? d.assignments || [] : []);
const pickStaffTasks = (d) => (d?.success ? d.tasks || [] : []);
const pickPendingSubmissions = (d) =>
  d?.success ? (d.submissions || []).filter((s) => s.status === "pending") : [];

export default function StaffDashboard() {
  const { t } = useI18n();
  // Snapshot the clock once per render — reading it mid-render is impure.
  const [now] = useState(() => Date.now());

  const timeAgo = (dateStr) => {
    if (!dateStr) return "";
    const diff = now - new Date(dateStr).getTime();
    if (isNaN(diff) || diff < 0) return "";
    const mins = Math.max(1, Math.floor(diff / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  // The identity comes from the shell's session cache instead of the browser's
  // stored copy, and the reads follow it as a plain dependency — so nothing is
  // written from an effect.
  //
  // This also corrects what those reads were asking for: they used the person's
  // record identifier, while the task endpoint authenticates against the SESSION
  // identifier and refuses any other — so a staff member who is not a super admin
  // had their task list refused rather than drawn.
  const { user, cid } = useSessionUser();
  const { data: assignments } = useApi(
    cid ? `/api/program-staff?staff_id=${cid}` : null,
    { defaultValue: [], transform: pickStaffAssignments, deps: [cid] },
  );
  const { data: upcomingTasks, loading: tasksReadLoading } = useApi(
    cid ? `/api/tasks?user_id=${cid}&status=pending&limit=5` : null,
    { defaultValue: [], transform: pickStaffTasks, deps: [cid] },
  );
  const { data: pendingSubmissions } = useApi("/api/participant/submissions", {
    defaultValue: [],
    transform: pickPendingSubmissions,
  });
  // "Not known yet" is not the same as "empty": the task block keeps its
  // spinner while the identity is still on its way.
  const tasksLoading = !cid || tasksReadLoading;

  return (
    <>
      <div className="space-y-12">
        {/* STAFF WELCOME */}
        <header className="space-y-4">
          <div className="flex items-center gap-4">
            <Star className="w-5 h-5 text-[#FF6600]" />
            <span className="text-[10px] font-bold text-[#FF6600] uppercase tracking-widest">
              {t("staffMisc.dashboard.tacticalFacultyHub")}
            </span>
          </div>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter uppercase leading-none">
            {t("staffMisc.dashboard.commandOverview")}
          </h2>
          <p className="text-slate-400 font-bold max-w-xl opacity-70">
            {t("staffMisc.dashboard.commandSubtitle")}
          </p>
        </header>

        {/* ── STAND-UP & RETRO (Phase 7 Redesign) ── */}
        <StandupRetroView
          user={user || {}}
          context={{ context_type: "staff", context_id: null }}
          contextLabel={t("staffMisc.dashboard.standupRetroContextLabel")}
        />

        {/* UPCOMING TASKS */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
              {t("staffMisc.dashboard.nextTasksTitle")}
            </h3>
          </div>
          {tasksLoading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="w-4 h-4 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("staffMisc.dashboard.loadingTasks")}
              </span>
            </div>
          ) : upcomingTasks.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-4">
              {t("staffMisc.dashboard.noUpcomingTasks")}
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-tertiary border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                        {task.title}
                      </p>
                      {task.start_date && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-0.5">
                          {new Date(task.start_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 ml-2">
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
          {/* ASSIGNED PROGRAMS */}
          <div className="xl:col-span-2 space-y-8">
            <div className="flex justify-between items-end">
              <h3 className="text-xl font-black text-white uppercase tracking-widest">
                {t("staffMisc.dashboard.activeAssignments")}
              </h3>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                {t("staffMisc.dashboard.programClustersCount", {
                  count: assignments.length,
                })}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {assignments.map((assign) => (
                <div
                  key={assign.id}
                  className="ios-card bg-white/[0.01] border-white/5 p-8 space-y-8 group hover:border-[#FF6600]/20 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div
                      className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase border ${assign.role === "group_leader" ? "bg-[#FF6600]/80/10 text-indigo-400 border-[#FF6600]/80/20" : "bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/20"}`}
                    >
                      {assign.role.replace("_", " ")}
                    </div>
                    <Activity className="w-5 h-5 text-slate-800 group-hover:text-[#FF6600] transition-colors" />
                  </div>
                  <div>
                    <h4 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-4">
                      {assign.program_name}
                    </h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {t("staffMisc.dashboard.statusLabel", {
                        status: assign.program_status,
                      })}
                    </p>
                  </div>
                  <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">
                      {t("staffMisc.dashboard.viewProgramLogic")}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PENDING INTERCEPTIONS (Submissions) */}
          <div className="space-y-8">
            <h3 className="text-xl font-black text-white uppercase tracking-widest">
              {t("staffMisc.dashboard.pendingSignals")}
            </h3>
            <div className="space-y-4">
              {pendingSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="ios-card bg-white/[0.02] border-white/10 p-6 space-y-4 group hover:bg-[#FF6600]/5 transition-all"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#FF6600] shadow-[0_0_10px_rgba(255,102,0,0.5)]" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                        {t("staffMisc.dashboard.newSubmission")}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-700">
                      {timeAgo(sub.created_at)}
                    </span>
                  </div>
                  <p className="text-[12px] font-bold text-slate-400 leading-relaxed">
                    {t("staffMisc.dashboard.submissionPrompt", {
                      cid: sub.participant_id.slice(0, 8),
                    })}
                  </p>
                  <button className="w-full py-4 bg-white/5 text-white font-bold uppercase text-sm tracking-wide rounded-xl group-hover:bg-[#FF6600] group-hover:text-black transition-all">
                    {t("staffMisc.dashboard.interceptEvaluate")}
                  </button>
                </div>
              ))}
              {pendingSubmissions.length === 0 && (
                <div className="ios-card border-dashed py-32 text-center text-slate-700 text-[11px] uppercase tracking-widest opacity-40">
                  {t("staffMisc.dashboard.noPendingSignals")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
