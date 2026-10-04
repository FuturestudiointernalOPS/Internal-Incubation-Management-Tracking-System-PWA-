"use client";
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { getLocalToday } from "@/lib/constants";
import { cacheGet, cacheSet, useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import ProgramLoading from "@/components/pm/program-workspace/ProgramLoading";
import ProgramWorkspaceView from "@/components/pm/programs/ProgramWorkspaceView";
import ProgramSuspenseFallback from "@/components/pm/programs/ProgramSuspenseFallback";
import { buildProgramTabs } from "@/components/pm/programs/programTabs";
import {
  selectOversightCandidates,
  selectProgramAccess,
  selectProgramTeamMembers,
  selectVisibleTabs,
} from "@/components/pm/programs/programWorkspaceSelectors";
import { pickRegForm, pickReviews } from "@/components/pm/programs/programWorkspaceShapes";
import useAttendanceMarks from "@/app/pm/programs/[id]/useAttendanceMarks";
import { teamActions } from "@/app/pm/programs/[id]/actions/teams";
import { curriculumActions } from "@/app/pm/programs/[id]/actions/curriculum";
import { kpiActions } from "@/app/pm/programs/[id]/actions/kpis";
import { reportActions } from "@/app/pm/programs/[id]/actions/reports";
import { reviewActions } from "@/app/pm/programs/[id]/actions/reviews";
import { scoreActions } from "@/app/pm/programs/[id]/actions/scores";
import { attendanceActions } from "@/app/pm/programs/[id]/actions/attendance";
import { facilitatorActions } from "@/app/pm/programs/[id]/actions/facilitators";
import { shellActions } from "@/app/pm/programs/[id]/actions/shell";

export const dynamic = "force-dynamic";

/**
 * IMPACTOS OPERATIONAL CONTROL — PROGRAM WORKSPACE
 *
 * The screen keeps every state value and every data read. Its writes live in
 * `./actions/`, one factory per concern, and its markup in
 * `src/components/pm/program-workspace/` (the body in `WorkspaceContent`, the
 * overlays in `WorkspaceModals`) — each receives the values below as props.
 */

function ProgramWorkspace() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "overview",
  );
  const [loading, setLoading] = useState(true);

  // State Modules
  // Who is signed in comes from the session the shell already publishes, so it
  // needs no effect and no read of its own. An absent identity is "not known
  // yet" rather than "empty", which is why the empty object is kept as the
  // shape the screen has always rendered against.
  const { user: sessionUser } = useSessionUser();
  const user = sessionUser || {};
  const [program, setProgram] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [reports, setReports] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState("individuals");
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [newTeam, setNewTeam] = useState({
    name: "",
    group_name: "",
    handler_name: "",
    member_ids: [],
    leader_id: "",
    staff_id: "",
  });
  const [kpis, setKpis] = useState([]);
  const [, setEvents] = useState([]);
  const [assignedStaff, setAssignedStaff] = useState([]);
  const [facilitators, setFacilitators] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toast] = useState(null);
  const [activePDF, setActivePDF] = useState(null);
  const [families, setFamilies] = useState([]);
  // Assigned registration form (public link) - resolved from the Form Run
  // assigned directly to this Program (target_type = "program"), or to the
  // person's family when the screen has no program id. The ADDRESS says which of
  // the two questions is being asked, so "nothing to ask" is simply no address
  // and the read's default (null) is what the header shows.
  const regGroupId = families[0]?.registration_id || families[0]?.id;
  const regFormUrl = id
    ? `/api/platform/form-runs?program_id=${encodeURIComponent(String(id))}`
    : regGroupId
      ? `/api/platform/form-runs?group_id=${encodeURIComponent(String(regGroupId))}`
      : null;
  const { data: regForm } = useApi(regFormUrl, {
    defaultValue: null,
    transform: pickRegForm,
  });

  // Compute program team members from Super Admin's approved list (assigned_assistant_id)
  const assignedAssistantId = program?.assigned_assistant_id;
  const programTeamMembers = React.useMemo(
    () => selectProgramTeamMembers(assignedAssistantId, staffList, assignedStaff),
    [assignedAssistantId, staffList, assignedStaff],
  );

  // Oversight candidates = assigned program staff (staff/assistant)
  // + program facilitators. Deduped by cid so the same person appears once.
  const oversightCandidates = React.useMemo(
    () => selectOversightCandidates(assignedStaff, facilitators),
    [assignedStaff, facilitators],
  );

  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamAssignmentMode, setTeamAssignmentMode] = useState("new"); // 'new' or 'existing'
  const [selectedExistingTeamId, setSelectedExistingTeamId] = useState("");
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);

  const [showRequirementModal, setShowRequirementModal] = useState(false);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [newKPI, setNewKPI] = useState({ title: "" });
  const [showPMReportModal, setShowPMReportModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedSessionForAttendance, setSelectedSessionForAttendance] =
    useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  // Snapshot of the marks as loaded when the modal opened — used to send
  // only the participants whose mark actually changed on save, so saving
  // never rewrites or clears marks recorded elsewhere (e.g. by a facilitator
  // for their team).
  const [attendanceLoaded, setAttendanceLoaded] = useState({});
  const [attendanceDate, setAttendanceDate] = useState(() => getLocalToday());
  const [pmReportAttachments, setPmReportAttachments] = useState({
    type: "",
    url: "",
  });
  const [showTeamDetails, setShowTeamDetails] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [showFacilitatorSelect, setShowFacilitatorSelect] = useState(false);
  const [facilitatorDraftId, setFacilitatorDraftId] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [editingScoreFor, setEditingScoreFor] = useState(null); // participant id being edited
  const [scoreDraft, setScoreDraft] = useState(""); // in-progress marks value


  const [showArchivedSessions, setShowArchivedSessions] = useState(false);

  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [newSession, setNewSession] = useState({
    title: "",
    week_number: 1,
    status: "pending",
    kpi_ids: [],
    handler_ids: [],
    handler_names: [],
    scheduled_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    notes: "",
    extra_materials: [],
    requirements: [],
  });

  const [newSessionMaterial, setNewSessionMaterial] = useState({
    type: "text",
    content: "",
    name: "",
  });
  const [newRequirement, setNewRequirement] = useState({
    title: "",
    description: "",
    allowed_format: "pdf",
    kpi_ids: [],
    due_date: "",
    assignee_type: "all",
    assignee_id: "",
    resource_url: "",
    resource_label: "",
  });
  const [newPMReport, setNewPMReport] = useState({
    summary: "",
    status: "optimal",
    // New structured fields
    week_status: "",
    week_rating: "",
    main_topic: "",
    // KPI-linked assignment tracking
    assignment_given: false,
    assignment_kpi_ids: [],
    assignment_objective: "",
    assignment_outcome: "",
    attendance_level: "",
    participation_level: "",
    participants_need_attention: false,
    participants_attention_notes: "",
    standout_participants: false,
    standout_notes: "",
    delivery_quality: "",
    participant_understanding: "",
    delivery_challenges: false,
    delivery_challenge_note: "",
    had_issues: false,
    issue_types: [],
    requires_admin_attention: false,
    additional_issue_note: "",
    program_on_track: true,
    planned_adjustments: "",
  });
  const [newStaff, setNewStaff] = useState({ staff_id: "", role: "staff" });

  const [confirmTarget, setConfirmTarget] = useState(null); // { id, message, onConfirm } or null

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [reviewScore, setReviewScore] = useState("");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [showFollowupFields, setShowFollowupFields] = useState(false);
  // Tracks whether the PM has opened the submissions tab (clears the "new" badge/highlight)
  const [submissionsSeen, setSubmissionsSeen] = useState(
    searchParams.get("tab") === "submissions",
  );
  const [followupDate, setFollowupDate] = useState("");
  const [followupTime, setFollowupTime] = useState("");
  const [followupDuration, setFollowupDuration] = useState(30);
  const [followupMeetingLink, setFollowupMeetingLink] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");

  const configNameRef = useRef(null);
  const configDescRef = useRef(null);
  const configWeeksRef = useRef(null);
  const configStatusRef = useRef(null);
  const configStartRef = useRef(null);
  const configEndRef = useRef(null);
  const configGradingRef = useRef(null);

  // The attendance marks already recorded for the open modal.
  useAttendanceMarks({
    id,
    showAttendanceModal,
    selectedSessionForAttendance,
    attendanceDate,
    setAttendanceRecords,
    setAttendanceLoaded,
  });

  const notify = (message, type = "success") => {
    window.dispatchEvent(
      new CustomEvent("impactos:notify", { detail: { type, message } }),
    );
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/pm/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name:
            user.role === "super_admin"
              ? configNameRef.current?.value
              : program?.name,
          description: configDescRef.current?.value,
          duration_weeks:
            parseInt(configWeeksRef.current?.value) || program?.duration_weeks,
          status: configStatusRef.current?.value,
          note_id: program?.note_id,
          assigned_pm_id: program?.assigned_pm_id,
          assigned_assistant_id: program?.assigned_assistant_id,
          materials: program?.materials,
          start_date: configStartRef.current?.value,
          end_date: configEndRef.current?.value,
          grading_mode: configGradingRef.current?.value || "graded",
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.saved"));
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.saveFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.saveFailed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // The reviews list is read through the shared hook, which owns the cache, the
  // cache-first paint and the discarding of a stale answer. A decision reloads it
  // with `refresh()`, which bypasses the cache exactly as loadReviews(true) did.
  const {
    data: facilitatorReviews,
    loading: reviewsLoading,
    refresh: refreshReviews,
  } = useApi(
    id ? `/api/facilitator-reviews?program_id=${encodeURIComponent(id)}` : null,
    { defaultValue: [], transform: pickReviews },
  );

  const fetchProgramData = useCallback(
    async (bypassCache = false) => {
      const url = `/api/pm/full-state?id=${id}&metrics=true`;
      const apply = (payload) => {
        if (payload?.success) {
          setProgram(payload.program);
          setSessions(payload.sessions || []);
          setTeams(payload.teams || []);
          setParticipants(payload.participants || []);
          setSubmissions(payload.submissions || []);
          setRequirements(payload.documents || []);
          setKpis(payload.kpis || []);
          setEvents(payload.events || []);
          setAssignedStaff(payload.assignedStaff || []);
          setFacilitators(payload.facilitators || []);
          setStaffList(payload.staffList || []);
          setReports(payload.reports || []);
          setFamilies(payload.families || []);
        }
      };
      let painted = false;
      // Post-mutation reloads pass bypassCache=true — they never flash the
      // full-page spinner and always fetch fresh data.
      if (!bypassCache) setLoading(true);
      try {
        // Cache-first paint: returning to this page renders instantly from a
        // fresh snapshot; mutation flows pass bypassCache=true so the lists
        // always reflect the last action.
        if (!bypassCache) {
          const cached = cacheGet(url);
          if (cached !== null && cached.success) {
            apply(cached);
            setLoading(false);
            painted = true;
          }
        }
        const payload = await fetch(url).then((response) => response.json());
        if (payload?.success) {
          cacheSet(url, payload);
          apply(payload);
        }
      } catch (error) {
        if (!painted) console.error("Operational Fetch Failure:", error);
      } finally {
        setLoading(false);
      }
    },
    // setFamilies is listed because react-hooks infers it here; a useState
    // setter is stable, so the callback identity is unchanged.
    [id, setFamilies],
  );

  useEffect(() => {
    fetchProgramData();
  }, [fetchProgramData]);

  if (loading) {
    return <ProgramLoading />;
  }

  // Access flags: the assigned PM or a team member (assistant/associate) can
  // manage the program the same as a program_manager. Derived BEFORE `values`
  // because `values` lists `canEdit` / `canContribute`; declaring them after
  // would leave the references in the temporal dead zone and throw on render.
  const { isAssignedPm, isTeamMember, canEdit, canContribute } =
    selectProgramAccess({ program, programTeamMembers, user });

  // Every write of this screen, grouped by concern. The factories read what they
  // need from `values`; the two view blocks below read `ctx`, which is those
  // values plus the handlers — so each block's dependencies are listed once, in
  // its own signature.
  const values = {
    activePDF,
    activeSubTab,
    activeTab,
    assignedStaff,
    attendanceDate,
    attendanceLoaded,
    attendanceRecords,
    canContribute,
    canEdit,
    configDescRef,
    configEndRef,
    configGradingRef,
    configNameRef,
    configStartRef,
    configStatusRef,
    configWeeksRef,
    confirmTarget,
    editingScoreFor,
    emailInput,
    expandedSessionId,
    facilitatorDraftId,
    facilitatorReviews,
    families,
    fetchProgramData,
    followupDate,
    followupDuration,
    followupMeetingLink,
    followupNotes,
    followupTime,
    id,
    isSaving,
    kpis,
    newKPI,
    newPMReport,
    newRequirement,
    newSession,
    newSessionMaterial,
    newStaff,
    newTeam,
    notify,
    oversightCandidates,
    participants,
    pmReportAttachments,
    program,
    programTeamMembers,
    refreshReviews,
    regForm,
    reports,
    requirements,
    reviewFeedback,
    reviewScore,
    reviewsLoading,
    router,
    saveConfig,
    scoreDraft,
    selectedExistingTeamId,
    selectedParticipants,
    selectedSessionForAttendance,
    selectedSessionId,
    selectedSubmission,
    selectedTeam,
    sessions,
    setActivePDF,
    setActiveSubTab,
    setActiveTab,
    setAttendanceDate,
    setAttendanceLoaded,
    setAttendanceRecords,
    setConfirmTarget,
    setEditingScoreFor,
    setEmailInput,
    setExpandedSessionId,
    setFacilitatorDraftId,
    setFollowupDate,
    setFollowupDuration,
    setFollowupMeetingLink,
    setFollowupNotes,
    setFollowupTime,
    setIsSaving,
    setNewKPI,
    setNewPMReport,
    setNewRequirement,
    setNewSession,
    setNewSessionMaterial,
    setNewStaff,
    setNewTeam,
    setPmReportAttachments,
    setReviewFeedback,
    setReviewScore,
    setScoreDraft,
    setSelectedExistingTeamId,
    setSelectedParticipants,
    setSelectedSessionForAttendance,
    setSelectedSessionId,
    setSelectedSubmission,
    setSelectedTeam,
    setSessions,
    setShowArchivedSessions,
    setShowAttendanceModal,
    setShowFacilitatorSelect,
    setShowFollowupFields,
    setShowKPIModal,
    setShowPMReportModal,
    setShowRequirementModal,
    setShowReviewModal,
    setShowSessionModal,
    setShowStaffModal,
    setShowTeamDetails,
    setShowTeamModal,
    setSubmissionsSeen,
    setTeamAssignmentMode,
    showArchivedSessions,
    showAttendanceModal,
    showFacilitatorSelect,
    showFollowupFields,
    showKPIModal,
    showPMReportModal,
    showRequirementModal,
    showReviewModal,
    showSessionModal,
    showStaffModal,
    showTeamDetails,
    showTeamModal,
    staffList,
    submissions,
    submissionsSeen,
    t,
    teamAssignmentMode,
    teams,
    toast,
    user,
  };

  const teamsHandlers = teamActions(ctx);
  const curriculumHandlers = curriculumActions(ctx);
  const kpisHandlers = kpiActions(ctx);
  const reportsHandlers = reportActions(ctx);
  const reviewsHandlers = reviewActions(ctx);
  const scoresHandlers = scoreActions(ctx);
  const attendanceHandlers = attendanceActions(ctx);
  const facilitatorsHandlers = facilitatorActions(ctx);
  const shellHandlers = shellActions(ctx);

  const ctx = {
    ...teamsHandlers,
    ...curriculumHandlers,
    ...kpisHandlers,
    ...reportsHandlers,
    ...reviewsHandlers,
    ...scoresHandlers,
    ...attendanceHandlers,
    ...facilitatorsHandlers,
    ...shellHandlers,
    ...values,
  };

  // The one handler this page renders with itself (the tab bar).
  const { handleSelectTab } = shellHandlers;

  const pendingSubmissionCount = submissions.filter(
    (submission) => submission.status === "pending",
  ).length;

  const allTabs = buildProgramTabs(t);

  // Tabs: show all tabs to anyone with edit rights, otherwise filter by roles array
  const tabs = selectVisibleTabs({
    allTabs,
    isAssignedPm,
    isTeamMember,
    user,
  });

  return (
    <ProgramWorkspaceView
      activeTab={activeTab}
      ctx={ctx}
      onSelectTab={handleSelectTab}
      pendingSubmissionCount={pendingSubmissionCount}
      program={program}
      submissionsSeen={submissionsSeen}
      tabs={tabs}
    />
  );
}

export default function ProgramWorkspacePage() {
  return (
    <Suspense fallback={<ProgramSuspenseFallback />}>
      <ProgramWorkspace />
    </Suspense>
  );
}
