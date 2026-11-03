"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useDialogs } from "@/components/ui/DialogProvider";
import { notify } from "@/lib/notify";
import { Loader2, Rocket, ListTodo, Calendar, Route, StickyNote, FolderKanban, FolderOpen, TrendingUp, Building2 } from "lucide-react";
import VenturePageHeader from "@/components/ventures/VenturePageHeader";
import VentureNotesPanel from "@/components/ventures/VentureNotesPanel";
import VentureTasksPanel from "@/components/ventures/VentureTasksPanel";
import JourneyManagerPanel from "@/components/ventures/JourneyManagerPanel";
import CoachSessionPanel from "@/components/ventures/CoachSessionPanel";
import VentureDataRoom from "@/components/ventures/data-room/VentureDataRoom";
import VentureProfileReadOnly from "@/components/ventures/VentureProfileReadOnly";
import CockpitMetrics from "@/components/ventures/cockpit/CockpitMetrics";
import CockpitDecisions from "@/components/ventures/cockpit/CockpitDecisions";
import CockpitSnapshot from "@/components/ventures/cockpit/CockpitSnapshot";
import ProjectsWorkItemsView from "@/components/ventures/projects/ProjectsWorkItemsView";
import VentureTimelineView from "@/components/ventures/timeline/VentureTimelineView";
import VenturePeoplePanel from "@/components/ventures/projects/VenturePeoplePanel";
import VentureReportingCharts from "@/components/ventures/reporting/VentureReportingCharts";
import { useApi } from "@/lib/hooks/useApi";
import { VentureWorkspace } from "@/components/ventures/workspace/VentureContext";
import { InvestmentTab } from "@/components/ventures/workspace/tabs/GrowthTabs";
import { pickInvestmentReadiness } from "@/components/participant/ventures/ventureScreenModel";
import { cardStyle } from "@/components/participant/ventures/ventureScreenHelpers";

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
 * lands on Overview and switches to Journey / Tasks / Sessions / Notes / Plan
 * without scrolling through one long page.
 *
 * Tasks sits directly after Journey because it IS the next level down —
 * Journey → Milestone → Task — and because assignment is a manager's act: the
 * person running the Venture is the person who knows who should do the work.
 */
const TABS = [
  { id: "overview", label: "venture.overview", icon: Rocket },
  { id: "journey", label: "venture.journey", icon: Route },
  // The Project lens on the same work: every milestone, activity and deliverable
  // in one row each — the Super Admin's "Project" button, for the Venture Manager.
  { id: "projects", label: "venture.projects.pageTitle", icon: FolderKanban, leadManagerOnly: true },
  // Investment readiness: the same two indicators the founder sees (roadmap
  // progress and Data Room completeness), between the work lens and the tasks.
  { id: "investment", label: "venture.investment", icon: TrendingUp },
  { id: "tasks", label: "venture.tasks", icon: ListTodo },
  { id: "sessions", label: "venture.sessions", icon: Calendar },
  { id: "notes", label: "venture.notes", icon: StickyNote },
  // The Data Room is the venture's confidential fundraising / due-diligence
  // document set (including the material shared with granted investors).
  { id: "dataRoom", label: "dataRoom.title", icon: FolderOpen },
  // The profile the founders fill in, read-only: the Venture Manager follows the
  // Venture without owning its record.
  { id: "profile", label: "vadmin.detail.profile", icon: Building2, leadManagerOnly: true },
];

export default function StaffVentureWorkspace() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const { prompt } = useDialogs();

  const [venture, setVenture] = useState(null);
  const [myRoles, setMyRoles] = useState([]);
  const [members, setMembers] = useState([]);
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
  const tabFromUrl = String(searchParams?.get("tab") || "");
  const isLeadManager = myRoles.some((role) => role.responsibility_code === "venture_manager");
  // A tab the viewer is not entitled to is not a tab they can stand on: a
  // hand-typed ?tab=projects falls back to Overview instead of an empty pane.
  // (The SERVER is still the authority — this only decides what is rendered.)
  const visibleTabs = TABS.filter((tab) => !tab.leadManagerOnly || isLeadManager);
  const activeTab = visibleTabs.some((tab) => tab.id === tabFromUrl) ? tabFromUrl : "overview";

  const { data: investmentReadiness } = useApi(
    activeTab === "investment" ? `/api/ventures/${id}/investment-readiness` : null,
    { defaultValue: null, transform: pickInvestmentReadiness, deps: [id, activeTab] },
  );

  const projectsView = searchParams?.get("view") === "timeline" ? "timeline" : "work";
  const selectProjectsView = (next) => {
    const params = new URLSearchParams(searchParams?.toString?.() || "");
    if (next === "work") params.delete("view");
    else params.set("view", next);
    router.replace(`/staff/ventures/${id}?${params.toString()}`, { scroll: false });
  };

  const selectTab = (tabId) => {
    const params = new URLSearchParams(searchParams?.toString?.() || "");
    params.set("tab", tabId);
    router.replace(`/staff/ventures/${id}?${params.toString()}`, { scroll: false });
  };

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
        const [ventureResponse, rolesResponse, membersResponse, tasksResponse, sessionsResponse] = await Promise.all([
          fetch(`/api/ventures/${id}`),
          fetch(`/api/ventures/assigned?venture=${id}`),
          fetch(`/api/ventures/${id}/members`),
          fetch(`/api/ventures/${id}/tasks`),
          fetch(`/api/ventures/${id}/sessions`),
        ]);
        const ventureData = await ventureResponse.json();
        const rolesData = await rolesResponse.json();
        const membersData = await membersResponse.json();
        const tasksData = await tasksResponse.json();
        const sessionsData = await sessionsResponse.json();
        if (!ventureData.success) { setNotFound(true); return; }
        setVenture(ventureData.venture);
        setMyRoles((rolesData.assignments || []).filter((role) => role.venture_id === id));
        setMembers((membersData.members || membersData.rows || []));
        const fullTasks = tasksData.tasks || [];
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
    <div className="p-6 space-y-6 w-full max-w-none">
      <VenturePageHeader
        displayName={displayName}
        brandColor={venture.branding?.color}
        ventureId={venture.venture_id}
        status={venture.status}
        logoUrl={venture.logo_url}
        metaItems={[
          t(`venture.stages.${venture.business_stage || "idea"}`),
          venture.industry,
          venture.country,
        ]}
      />

      {/* The viewer's mandate, kept as one line rather than a card: the full
          responsibility and its scope stay in the tooltip. */}
      {myRoles.length > 0 && (
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          {myRoles.map((role) => {
            const scope =
              role.scope_type && role.scope_type !== "venture_wide"
                ? ` · ${role.scope_type}${role.scope_ref_id ? `: ${role.scope_ref_id}` : ""}`
                : "";
            const label = role.responsibility_name || role.responsibility_code;
            return (
              <span
                key={role.id}
                title={`${label}${scope}`}
                className="rounded-lg bg-brand-orange/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]"
              >
                {t("staff.ventureWorkspace.myRole")}: {label}
              </span>
            );
          })}
        </div>
      )}

      {/* Tabs — same bar as the Super Admin venture hub, for consistency */}
      <div className="flex gap-1 border-b border-[var(--border-primary)] overflow-x-auto scrollbar-thin">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
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
      {/* Four figures first: where the work is, what waits on this person, what is
          late, what is next. Each one is a filter link into the tab that holds it. */}
      <CockpitMetrics ventureId={id} reviewCount={reviewQueue.length} onNavigate={selectTab} />

      {/* Two zones: what waits on this person, and the few facts that place the
          Venture. The roster, roadmap and calendar have their own tabs — the
          Overview no longer repeats them. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CockpitDecisions items={reviewQueue} loading={queueLoading} onDecide={decideSubmission} />
        </div>
        <CockpitSnapshot members={members} sessions={sessions} />
      </div>

      {/* The founder's own reporting charts, unmodified: the manager follows the
          Venture against the numbers the Venture actually reported. */}
      <VentureReportingCharts ventureId={id} />

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

      {/* Projects — the same read the Super Admin's venture "Project" page shows.
          The server gate is `ventures.view` + venture scope, which already admits
          the Venture's own Venture Manager; this is the surface that was missing. */}
      {activeTab === "projects" && isLeadManager && (
        <div className="flex gap-2 mb-5" role="tablist">
          {["work", "timeline"].map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={projectsView === option}
              onClick={() => selectProjectsView(option)}
              className={`stf-btn ${projectsView === option ? "pr" : ""}`}
            >
              {t(option === "work" ? "venture.projects.viewWork" : "venture.projects.viewTimeline")}
            </button>
          ))}
        </div>
      )}

      {activeTab === "projects" && isLeadManager && projectsView === "timeline" && (
        <VentureTimelineView id={id} embedded />
      )}

      {activeTab === "projects" && isLeadManager && projectsView === "work" && (
        <ProjectsWorkItemsView ventureId={id} emailsHref={`/staff/ventures/${id}/emails`} />
      )}

      {/* WHO the work stands on: the same linking the Super Admin's Project page
          offers, so a Venture Manager can name the people their Venture's work
          mentions and their reminders reach them. */}
      {activeTab === "projects" && isLeadManager && projectsView === "work" && (
        <div className="pt-2">
          <VenturePeoplePanel ventureId={id} />
        </div>
      )}

      {activeTab === "investment" && (
        <VentureWorkspace.Provider value={{ investmentReadiness, cardStyle }}>
          <InvestmentTab />
        </VentureWorkspace.Provider>
      )}

      {activeTab === "tasks" && <VentureTasksPanel ventureId={id} />}

      {activeTab === "dataRoom" && <VentureDataRoom ventureId={id} />}

      {activeTab === "notes" && <VentureNotesPanel ventureId={id} />}

      {activeTab === "profile" && <VentureProfileReadOnly venture={venture} />}
    </div>
  );
}
