"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useDialogs } from "@/components/ui/DialogProvider";
import { notify } from "@/lib/notify";
import { ArrowLeft, Loader2, Rocket, Flag, ListTodo, Calendar, FileText, Users, Inbox, Route, StickyNote } from "lucide-react";
import VenturePageHeader from "@/components/ventures/VenturePageHeader";
import VentureNotesPanel from "@/components/ventures/VentureNotesPanel";
import OperatingPlanPanel from "@/components/ventures/OperatingPlanPanel";
import JourneyManagerPanel from "@/components/ventures/JourneyManagerPanel";
import CoachSessionPanel from "@/components/ventures/CoachSessionPanel";

/**
 * Staff → Ventures → [Venture] — staff workspace (Phase 3).
 *
 * The staff member sees ONLY Ventures they are assigned to (server-enforced).
 * The page surfaces their own responsibilities/scopes plus read panes for the
 * areas their responsibility profile allows (server remains authoritative).
 */
/**
 * The Venture Manager workspace, organized into tabs exactly like the Super
 * Admin venture hub (same tab bar pattern, same order of ideas): the manager
 * lands on Overview and switches to Journey / Sessions / Notes / Plan without
 * scrolling through one long page.
 */
const TABS = [
  { id: "overview", label: "venture.overview", icon: Rocket },
  { id: "journey", label: "venture.journey", icon: Route },
  { id: "sessions", label: "venture.sessions", icon: Calendar },
  { id: "notes", label: "venture.notes", icon: StickyNote },
  { id: "plan", label: "venture.operatingPlan", icon: FileText },
];

export default function StaffVentureWorkspace() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const { prompt } = useDialogs();

  const [venture, setVenture] = useState(null);
  const [myRoles, setMyRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  // Coach tint: who is viewing, and title maps used to render each session's
  // operational context (Journey stage · milestone · task) in the Sessions pane.
  //
  // The viewer's identity comes from the shell's session cache rather than from
  // the browser's stored copy, so no effect writes it. It arrives a moment after
  // the first paint, and until then no session claims to be coached by this
  // person — the same "not known yet" state the coach-name fallback already
  // handled.
  const { user, cid } = useSessionUser();
  const myCid = cid;
  const myName = user?.name || user?.full_name || "";
  const [stageNameById, setStageNameById] = useState({});
  const [milestoneTitleById, setMilestoneTitleById] = useState({});
  const [taskTitleById, setTaskTitleById] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Attention: submissions awaiting this staff member's review (Coach view).
  const loadReviewQueue = useCallback(async () => {
    try {
      const response = await fetch(`/api/ventures/${id}/submissions/review-queue`);
      const data = await response.json();
      if (data.success) setReviewQueue(data.items || []);
    } catch (_) {}
    finally { setQueueLoading(false); }
  }, [id]);

  const decideSubmission = async (item, decision) => {
    const comment =
      decision === "changes_requested"
        ? (await prompt({ message: t("staff.ventureReview.commentPrompt"), required: false })) || ""
        : "";
    try {
      const response = await fetch(`/api/ventures/${id}/tasks/${item.task_id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review", submission_id: item.submission_id, decision, comment: comment || null }),
      });
      const data = await response.json();
      if (data.success) await loadReviewQueue();
      else notify("error", data.error || t("staff.ventureReview.reviewFailed"));
    } catch (_) {
      notify("error", t("staff.ventureReview.reviewFailed"));
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [ventureResponse, rolesResponse, membersResponse, milestonesResponse, tasksResponse, sessionsResponse] = await Promise.all([
          fetch(`/api/ventures/${id}`),
          fetch(`/api/ventures/assigned?venture=${id}`),
          fetch(`/api/ventures/${id}/members`),
          fetch(`/api/ventures/${id}/milestones`),
          fetch(`/api/ventures/${id}/tasks`),
          fetch(`/api/ventures/${id}/sessions`),
        ]);
        const ventureData = await ventureResponse.json();
        const rolesData = await rolesResponse.json();
        const membersData = await membersResponse.json();
        const milestonesData = await milestonesResponse.json();
        const tasksData = await tasksResponse.json();
        const sessionsData = await sessionsResponse.json();
        if (!ventureData.success) { setNotFound(true); return; }
        setVenture(ventureData.venture);
        setMyRoles((rolesData.assignments || []).filter((role) => role.venture_id === id));
        setMembers((membersData.members || membersData.rows || []));
        setMilestones((milestonesData.milestones || []).slice(0, 8));
        const fullTasks = tasksData.tasks || [];
        setTasks(fullTasks.slice(0, 8));
        const taskMap = {};
        for (const task of fullTasks) if (task.id != null && task.title) taskMap[String(task.id)] = task.title;
        setTaskTitleById(taskMap);
        setSessions((sessionsData.sessions || sessionsData.coaching_sessions || []).slice(0, 8));
        loadReviewQueue();
      } catch (error) {
        console.error("Failed to load staff venture workspace:", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, loadReviewQueue]);

  // Coach tint: the sessions list payload carries only soft context ids, so
  // Journey stage/milestone titles come from the same journey read the
  // JourneyManager uses (names are never invented client-side).
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`/api/ventures/${id}/journey`);
        const data = await response.json();
        if (!data.success || !Array.isArray(data.stages)) return;
        const stageMap = {};
        const milestoneMap = {};
        for (const stage of data.stages) {
          if (stage.id) stageMap[String(stage.id)] = stage.name;
          for (const milestone of stage.milestones || []) {
            if (milestone.id && milestone.title) milestoneMap[String(milestone.id)] = milestone.title;
          }
        }
        setStageNameById(stageMap);
        setMilestoneTitleById(milestoneMap);
      } catch (_) {}
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  if (notFound || !venture) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-16">
        <p className="text-sm font-bold text-[var(--text-primary)]">{t("staff.ventureWorkspace.unavailable")}</p>
        <p className="text-xs text-slate-500 mt-1">
          {t("staff.ventureWorkspace.unavailableHint")}
        </p>
        <button
          onClick={() => router.push("/staff/ventures")}
          className="mt-4 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest"
        >
          {t("staff.ventureWorkspace.backToMyVentures")}
        </button>
      </div>
    );
  }

  const displayName = venture.company_name || venture.name || t("venture.label");

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <button
        onClick={() => router.push("/staff/ventures")}
        className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
      >
        <ArrowLeft className="w-3 h-3" /> {t("venture.personal.myVentures")}
      </button>

      <VenturePageHeader
        displayName={displayName}
        brandColor={venture.branding?.color}
        ventureId={venture.venture_id}
        status={venture.status}
        metaItems={[
          t(`venture.stages.${venture.business_stage || "idea"}`),
          venture.industry,
          venture.country,
        ]}
      />

      {/* Tabs — same bar as the Super Admin venture hub, for consistency */}
      <div className="flex gap-1 border-b border-[var(--border-primary)] overflow-x-auto scrollbar-thin">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                  : "border-transparent text-slate-500 hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {t(tab.label)}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
      <>
      {/* My responsibilities on this Venture */}
      <div className="card">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Rocket className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("staff.ventureWorkspace.myRole")}
        </h3>
        {myRoles.length === 0 ? (
          <p className="text-xs text-slate-500">{t("staff.ventureWorkspace.noAssignment")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {myRoles.map((role) => (
              <span key={role.id} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-brand-orange/10 text-[var(--brand-orange)]">
                {role.responsibility_name || role.responsibility_code}
                {role.scope_type !== "venture_wide" && ` · ${role.scope_type}${role.scope_ref_id ? `: ${role.scope_ref_id}` : ""}`}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Attention — submissions awaiting review (Coach / Venture Support) */}
      <div className="card">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Inbox className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("staff.ventureWorkspace.needsAttention", { count: reviewQueue.length })}
        </h3>
        {queueLoading ? (
          <p className="text-xs text-slate-500">{t("common.loading")}</p>
        ) : reviewQueue.length === 0 ? (
          <p className="text-xs text-slate-500">{t("staff.ventureWorkspace.nothingToReview")}</p>
        ) : (
          <div className="space-y-2">
            {reviewQueue.map((submission) => (
              <div key={submission.submission_id} className="rounded-lg border border-[var(--border-primary)] p-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{submission.task_title}</p>
                  <p className="text-[10px] text-slate-500">
                    {submission.milestone_title ? `${submission.milestone_title} · ` : ""}{t("staff.ventureWorkspace.submissionMeta", { version: submission.version, name: submission.submitted_by_name || t("venture.label") })} · {new Date(submission.created_at).toLocaleDateString()}
                  </p>
                  {submission.notes && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{submission.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {submission.file_url && (
                    <a href={submission.file_url} target="_blank" rel="noreferrer" className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]">
                      {t("venture.personal.open")}
                    </a>
                  )}
                  <button onClick={() => decideSubmission(submission, "approved")} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25">
                    {t("venture.manager.approveDeliverable")}
                  </button>
                  <button onClick={() => decideSubmission(submission, "changes_requested")} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25">
                    {t("venture.manager.requestChanges")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Read panes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Flag className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("venture.milestones")} ({milestones.length})
          </h3>
          {milestones.length === 0 ? (
            <p className="text-xs text-slate-500">{t("venture.manager.noMilestones")}</p>
          ) : (
            <div className="space-y-2">
              {milestones.map((milestone) => (
                <div key={milestone.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border-primary)]">
                  <p className="text-xs font-medium text-[var(--text-primary)]">{milestone.title}</p>
                  <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">{milestone.status || "not_started"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <ListTodo className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("venture.tasks")} ({tasks.length})
          </h3>
          {tasks.length === 0 ? (
            <p className="text-xs text-slate-500">{t("venture.noTasksYet")}</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border-primary)]">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{task.title}</p>
                  <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">{task.status || "backlog"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("staff.ventureWorkspace.foundersAndMembers", { count: members.length })}
          </h3>
          {members.length === 0 ? (
            <p className="text-xs text-slate-500">{t("staff.ventureWorkspace.noMembers")}</p>
          ) : (
            <div className="space-y-2">
              {members.slice(0, 6).map((member) => (
                <div key={member.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border-primary)]">
                  <p className="text-xs font-medium text-[var(--text-primary)]">{member.contact_name || member.contact_id}</p>
                  <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">{member.member_type || "member"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {venture.description && (
        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{t("staff.ventureWorkspace.about")}</h3>
          <p className="text-sm text-[var(--text-secondary)]">{venture.description}</p>
        </div>
      )}

      <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
        <FileText className="w-3 h-3" /> {t("staff.ventureWorkspace.readPanesNote")}
      </p>
      </>
      )}

      {activeTab === "sessions" && (
        <div className="card">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("venture.sessions")} ({sessions.length})
          </h3>
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-500">{t("staff.ventureWorkspace.noSessions")}</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <CoachSessionPanel
                  key={session.id}
                  session={session}
                  ventureId={id}
                  myCid={myCid}
                  myName={myName}
                  stageNameById={stageNameById}
                  milestoneTitleById={milestoneTitleById}
                  taskTitleById={taskTitleById}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "journey" && <JourneyManagerPanel ventureId={id} />}

      {activeTab === "notes" && <VentureNotesPanel ventureId={id} />}

      {activeTab === "plan" && <OperatingPlanPanel ventureId={id} />}
    </div>
  );
}
