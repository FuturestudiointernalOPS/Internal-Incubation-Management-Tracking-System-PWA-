"use client";
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Activity,
  CheckCircle2,
  FileText,
  MessageCircle,
  Shield,
  LayoutDashboard,
  BarChart3,
  UserPlus,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  getWeekNumber,
  getLocalToday,
  FACILITATOR_REVIEW_OPTIONS,
} from "@/lib/constants";
import { FacilitatorsPanel } from "@/components/pm/FacilitatorsPanel";
import { cacheGet, cacheSet, useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import ProgramLoading from "@/components/pm/program-workspace/ProgramLoading";
import ProgramHeader from "@/components/pm/program-workspace/ProgramHeader";
import ProgramTabs from "@/components/pm/program-workspace/ProgramTabs";
import OverviewTab from "@/components/pm/program-workspace/OverviewTab";
import ParticipantsTab from "@/components/pm/program-workspace/ParticipantsTab";
import CurriculumTab from "@/components/pm/program-workspace/CurriculumTab";
import AttendanceTab from "@/components/pm/program-workspace/AttendanceTab";
import ConfigTab from "@/components/pm/program-workspace/ConfigTab";
import ReviewsTab from "@/components/pm/program-workspace/ReviewsTab";
import ReportsTab from "@/components/pm/program-workspace/ReportsTab";
import SubmissionsTab from "@/components/pm/program-workspace/SubmissionsTab";
import PdfViewerModal from "@/components/pm/program-workspace/PdfViewerModal";
import ProgramToast from "@/components/pm/program-workspace/ProgramToast";
import DeployTeamModal from "@/components/pm/program-workspace/DeployTeamModal";
import SessionModal from "@/components/pm/program-workspace/SessionModal";
import ReviewModal from "@/components/pm/program-workspace/ReviewModal";
import StaffAssignmentModal from "@/components/pm/program-workspace/StaffAssignmentModal";
import KpiModal from "@/components/pm/program-workspace/KpiModal";
import RequirementModal from "@/components/pm/program-workspace/RequirementModal";
import AttendanceModal from "@/components/pm/program-workspace/AttendanceModal";
import PmReportModal from "@/components/pm/program-workspace/PmReportModal";
import TeamDetailsModal from "@/components/pm/program-workspace/TeamDetailsModal";
import ConfirmActionDialog from "@/components/pm/program-workspace/ConfirmActionDialog";

export const dynamic = "force-dynamic";

/**
 * IMPACTOS OPERATIONAL CONTROL — PROGRAM WORKSPACE
 * Performance-first, modular data loading, and clean data-first UI.
 */

// Shapes the assigned registration-form read: the active Form Run becomes the
// public link shown in the header, or null when there is none to show.
// Module scope on purpose - the read keys on the address, never on this.
function pickRegForm(payload) {
  const run = (payload?.success ? payload.runs || [] : []).find(
    (entry) => entry.status === "active" && entry.public_slug,
  );
  return run
    ? {
        link: `${window.location.origin}/s/${run.public_slug}`,
        name: run.form_name || run.name || "Form",
      }
    : null;
}

// Shapes the facilitator-reviews read: the list, or empty when the server
// refused - the screen shows its empty state for that, as its first load did.
function pickReviews(payload) {
  return payload?.success ? payload.reviews || [] : [];
}

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
  const toggleKpi = (type, kpiId) => {
    if (type === "session") {
      setNewSession((prev) => {
        const ids = prev.kpi_ids || [];
        const next = ids.includes(kpiId)
          ? ids.filter((id) => id !== kpiId)
          : [...ids, kpiId];
        return { ...prev, kpi_ids: next };
      });
    } else {
      setNewRequirement((prev) => {
        const ids = prev.kpi_ids || [];
        const next = ids.includes(kpiId)
          ? ids.filter((id) => id !== kpiId)
          : [...ids, kpiId];
        return { ...prev, kpi_ids: next };
      });
    }
  };
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
  const programTeamMembers = React.useMemo(() => {
    if (!assignedAssistantId) return [];
    try {
      const rawAssistantIds = assignedAssistantId;
      let approvedIds = [];
      // Handle both JSON array string and single CID string
      if (typeof rawAssistantIds === "string") {
        if (rawAssistantIds.startsWith("[")) {
          approvedIds = JSON.parse(rawAssistantIds);
        } else {
          approvedIds = [rawAssistantIds];
        }
      } else if (Array.isArray(rawAssistantIds)) {
        approvedIds = rawAssistantIds;
      }
      if (!Array.isArray(approvedIds)) return [];
      const allAvailable = [...staffList, ...assignedStaff];
      const unique = Array.from(
        new Map(allAvailable.map((member) => [member.cid, member])).values(),
      );
      return unique.filter(
        (member) =>
          approvedIds.includes(member.cid) && member.role !== "investor",
      );
    } catch {
      return [];
    }
  }, [assignedAssistantId, staffList, assignedStaff]);

  // Oversight candidates = assigned program staff (staff/assistant)
  // + program facilitators. Deduped by cid so the same person appears once.
  const oversightCandidates = React.useMemo(() => {
    const merged = [...assignedStaff, ...facilitators];
    return Array.from(
      new Map(
        merged.map((member) => [
          member.cid ?? member.email ?? member.id,
          member,
        ]),
      ).values(),
    );
  }, [assignedStaff, facilitators]);

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

  // Load existing attendance when modal opens
  useEffect(() => {
    if (
      !showAttendanceModal ||
      !selectedSessionForAttendance ||
      !attendanceDate
    )
      return;
    const loadAttendance = async () => {
      try {
        const response = await fetch(
          `/api/attendance?session_id=${selectedSessionForAttendance.id}&program_id=${id}&date=${attendanceDate}`,
        );
        const data = await response.json();
        if (data.success && data.attendance) {
          const records = {};
          data.attendance.forEach((record) => {
            records[record.participant_id] = record.status;
          });
          setAttendanceRecords(records);
          setAttendanceLoaded(records);
        } else {
          setAttendanceRecords({});
          setAttendanceLoaded({});
        }
      } catch (_) {
        setAttendanceRecords({});
        setAttendanceLoaded({});
      }
    };
    loadAttendance();
  }, [showAttendanceModal, selectedSessionForAttendance, id, attendanceDate]);

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

  const deployTeam = async () => {
    if (teamAssignmentMode === "new" && !newTeam.name.trim()) return;
    if (teamAssignmentMode === "existing" && !selectedExistingTeamId) return;

    setIsSaving(true);
    try {
      const endpoint =
        teamAssignmentMode === "new" ? "/api/pm/teams" : "/api/pm/teams";
      const method = teamAssignmentMode === "new" ? "POST" : "PATCH";

      // Auto-detect group_name from selected participants
      const firstParticipant = participants.find(
        (participant) => participant.id === selectedParticipants[0],
      );
      const detectedGroupName = firstParticipant?.group_name || "Individual";

      const payload =
        teamAssignmentMode === "new"
          ? {
              name: newTeam.name,
              group_name: detectedGroupName,
              program_id: id,
              member_ids: selectedParticipants,
              is_management_group: true,
              ...(newTeam.handler_name
                ? { handler_name: newTeam.handler_name }
                : {}),
              ...(newTeam.staff_id ? { handler_id: newTeam.staff_id } : {}),
              ...(newTeam.leader_id ? { leader_id: newTeam.leader_id } : {}),
            }
          : {
              team_id: selectedExistingTeamId,
              member_ids: selectedParticipants,
            };

      const response = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        notify(
          teamAssignmentMode === "new"
            ? t("pmMisc.workspace.teamInitialized")
            : t("pmMisc.workspace.teamMembersAdded"),
        );
        setShowTeamModal(false);
        setNewTeam({
          name: "",
          group_name: "",
          handler_name: "",
          member_ids: [],
          leader_id: "",
          staff_id: "",
        });
        setSelectedExistingTeamId("");
        fetchProgramData(true);
        setSelectedParticipants([]);
        setActiveTab("teams");
        setActiveSubTab("groups");
      } else
        notify(
          t(data.error || t("pmMisc.workspace.operationFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.operationFailed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const changeParticipantTeam = async (participantId, newTeamId) => {
    if (!participantId || !newTeamId) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/pm/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: newTeamId,
          member_ids: [participantId],
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.participantMoved"));
        fetchProgramData(true);
      } else {
        notify(
          t(data.error || t("pmMisc.workspace.moveParticipantFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.moveParticipantFailed"),
          "error",
        );
      }
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Reassign the team's facilitator (handler) — PM control.
  const changeTeamHandler = async (teamId, handlerId) => {
    if (!teamId) return;
    const staff = oversightCandidates.find(
      (member) => String(member.cid) === String(handlerId || ""),
    );
    const handlerName = handlerId ? staff?.name || "" : "";
    setIsSaving(true);
    try {
      const response = await fetch("/api/pm/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_handler",
          team_id: teamId,
          handler_id: handlerId || null,
          handler_name: handlerName,
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.facilitatorUpdated"));
        setShowFacilitatorSelect(false);
        setFacilitatorDraftId("");
        setSelectedTeam((prev) =>
          prev
            ? {
                ...prev,
                handler_id: handlerId || null,
                handler_name: handlerName,
              }
            : prev,
        );
        fetchProgramData(true);
      } else {
        notify(
          t(
            data.error || t("pmMisc.workspace.facilitatorUpdateFailed") || "",
          ) ||
            data.error ||
            t("pmMisc.workspace.facilitatorUpdateFailed"),
          "error",
        );
      }
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Remove a participant from the current team (left unassigned afterwards).
  const removeParticipantFromTeam = async (participantId) => {
    if (!selectedTeam || !participantId) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/pm/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove_member",
          team_id: selectedTeam.id,
          member_id: participantId,
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.memberRemoved"));
        fetchProgramData(true);
      } else {
        notify(
          t(data.error || t("pmMisc.workspace.removeMemberFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.removeMemberFailed"),
          "error",
        );
      }
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk-add participants to the current selection by pasted email list
  // (comma / semicolon / newline separated). Unmatched emails are reported.
  const addEmailsToSelection = () => {
    const emails = emailInput
      .split(/[,;\n]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (emails.length === 0) return;

    const emailSet = new Set(emails);
    const matched = new Set();
    const matchedEmails = new Set();
    participants.forEach((participant) => {
      if (
        participant.email &&
        emailSet.has(String(participant.email).trim().toLowerCase())
      ) {
        matched.add(participant.id);
        matchedEmails.add(String(participant.email).trim().toLowerCase());
      }
    });
    const notFound = emails.filter((email) => !matchedEmails.has(email));

    setSelectedParticipants((prev) =>
      Array.from(new Set([...prev, ...matched])),
    );
    setEmailInput("");

    if (notFound.length > 0) {
      notify(
        t("pmMisc.workspace.emailsPartialResult", {
          added: matched.size,
          missing: notFound.slice(0, 8).join(", "),
        }),
        "error",
      );
    } else {
      notify(t("pmMisc.workspace.emailsAddedCount", { count: matched.size }));
    }
  };

  /** Close the session form. */
  const closeSessionModal = () => {
    setShowSessionModal(false);
  };

  const addSession = async () => {
    if (!newSession.title.trim()) return;
    if (
      kpis.length > 0 &&
      (!newSession.kpi_ids || newSession.kpi_ids.length === 0)
    ) {
      notify(t("pmMisc.workspace.kpiRequired"), "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_session",
          program_id: id,
          title: newSession.title,
          week_number: newSession.week_number,
          status: newSession.status,
          handler_id: (newSession.handler_ids || []).join(","),
          handler_name: (newSession.handler_names || []).join(", "),
          kpi_ids: newSession.kpi_ids || [],
          scheduled_date: newSession.scheduled_date || null,
          start_time: newSession.start_time || null,
          end_time: newSession.end_time || null,
          notes: newSession.notes || null,
          extra_materials: newSession.extra_materials || [],
          requirements: newSession.requirements || [],
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.added"));
        setShowSessionModal(false);
        setNewSession({
          title: "",
          week_number:
            sessions.length > 0
              ? Math.max(
                  ...sessions.map((session) => session.week_number || 0),
                ) + 1
              : 1,
          status: "pending",
          kpi_ids: [],
          handler_ids: [],
          handler_names: [],
          scheduled_date: "",
          start_time: "",
          end_time: "",
          notes: "",
          extra_materials: [],
          requirements: [],
        });
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.addFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.addFailed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const addRequirement = async (shouldClose = true) => {
    if (!newRequirement.title.trim()) return;
    if (!newRequirement.kpi_ids || newRequirement.kpi_ids.length === 0) {
      notify(t("pmMisc.workspace.kpiLinkRequired"), "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_requirement",
          program_id: id,
          session_id: selectedSessionId,
          title: newRequirement.title,
          description: newRequirement.description,
          allowed_format: newRequirement.allowed_format,
          kpi_ids: newRequirement.kpi_ids || [],
          due_date: newRequirement.due_date || null,
          assignee_type: newRequirement.assignee_type || "all",
          assignee_id: newRequirement.assignee_id || "",
          resource_url: newRequirement.resource_url || null,
          resource_label: newRequirement.resource_label || null,
          weight: 1,
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.added"));
        if (shouldClose) setShowRequirementModal(false);
        setNewRequirement({
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
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.failed") || "") ||
            data.error ||
            t("pmMisc.workspace.failed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSessionStatus = async (sessionId, status) => {
    // Optimistic Update
    const previousSessions = [...sessions];
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId ? { ...session, status } : session,
      ),
    );

    try {
      const response = await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_status",
          program_id: id,
          id: sessionId,
          status,
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(
          t("pmMisc.workspace.statusUpdatedTo", {
            status: status.toUpperCase(),
          }),
        );
        // Sync with server just in case
        fetchProgramData(true);
      } else {
        setSessions(previousSessions);
        notify(t("pmMisc.workspace.statusUpdateFailed"), "error");
      }
    } catch {
      setSessions(previousSessions);
      notify(t("pmMisc.workspace.statusUpdateFailed"), "error");
    }
  };

  const updateSessionField = async (
    sessionId,
    field,
    value,
    handlerName = null,
  ) => {
    // Optimistic update: apply to local state immediately
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId ? { ...session, [field]: value } : session,
      ),
    );

    try {
      const response = await fetch("/api/pm/curriculum", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: id,
          sessionId,
          field,
          value,
          handlerName,
        }),
      });
      const data = await response.json();
      if (data.success) {
        const silentFields = ["title", "description", "notes"];
        if (!silentFields.includes(field)) {
          notify(t("pmMisc.workspace.sessionFieldSynced"));
        }
        fetchProgramData(true);

        // When a staff member is assigned, create a task for their calendar
        if (field === "handler_id" && value && handlerName) {
          const session = sessions.find(
            (candidate) => candidate.id === sessionId,
          );
          if (session) {
            const now = new Date();
            const weekNumber = getWeekNumber(now);
            const year = now.getFullYear();

            await fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: value,
                user_name: handlerName,
                title: `${session.title || "Session"} - ${program?.name || "Program"}`,
                description: `Assigned session for week ${session.week_number}`,
                status: "pending",
                created_week: weekNumber,
                created_year: year,
                start_date: session.scheduled_date || null,
                end_date: session.end_date || null,
                category: "curriculum",
              }),
            });
          }
        }
      } else {
        if (response.status === 401) {
          notify(t("pmMisc.workspace.sessionExpired"), "error");
        } else {
          notify(
            t(data.error || t("pmMisc.workspace.fieldSyncFailed") || "") ||
              data.error ||
              t("pmMisc.workspace.fieldSyncFailed"),
            "error",
          );
        }
      }
    } catch {
      notify(t("pmMisc.workspace.fieldSyncFailed"), "error");
    }
  };

  // Upload a PDF attachment for the weekly report (stored in Supabase storage).
  const handleReportAttachmentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      notify(t("pmMisc.workspace.attachmentPdfOnly"), "error");
      event.target.value = "";
      return;
    }
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success && data.url) {
        setPmReportAttachments((prev) => ({
          ...prev,
          type: "file",
          url: data.url,
        }));
        notify(t("pmMisc.workspace.attachmentUploaded"));
      } else {
        notify(
          t(data.error || t("pmMisc.workspace.attachmentUploadFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.attachmentUploadFailed"),
          "error",
        );
      }
    } catch (_) {
      notify(t("pmMisc.workspace.attachmentUploadFailed"), "error");
    } finally {
      setIsSaving(false);
      event.target.value = "";
    }
  };

  const submitPMReport = async () => {
    // Validate required fields
    if (
      !newPMReport.week_status ||
      !newPMReport.week_rating ||
      !newPMReport.main_topic?.trim()
    ) {
      notify(t("pmMisc.workspace.reportRequiredFields"), "error");
      return;
    }
    setIsSaving(true);
    try {
      const body = {
        action: "submit_pm_report",
        program_id: id,
        session_id: selectedSessionId,
        week_number: sessions.find(
          (session) => session.id === selectedSessionId,
        )?.week_number,
        summary: newPMReport.summary,
        status: newPMReport.status,
        pm_id: user.cid || user.id,
        // New structured fields
        week_status: newPMReport.week_status,
        week_rating: newPMReport.week_rating,
        main_topic: newPMReport.main_topic,
        // KPI-linked assignment tracking
        assignment_given: newPMReport.assignment_given,
        assignment_kpi_ids: newPMReport.assignment_kpi_ids,
        assignment_objective: newPMReport.assignment_objective || null,
        assignment_outcome: newPMReport.assignment_outcome || null,
        attendance_level: newPMReport.attendance_level || null,
        participation_level: newPMReport.participation_level || null,
        participants_need_attention: newPMReport.participants_need_attention,
        participants_attention_notes:
          newPMReport.participants_attention_notes || null,
        standout_participants: newPMReport.standout_participants,
        standout_notes: newPMReport.standout_notes || null,
        delivery_quality: newPMReport.delivery_quality || null,
        participant_understanding:
          newPMReport.participant_understanding || null,
        delivery_challenges: newPMReport.delivery_challenges,
        delivery_challenge_note: newPMReport.delivery_challenge_note || null,
        had_issues: newPMReport.had_issues,
        issue_types: newPMReport.issue_types,
        requires_admin_attention: newPMReport.requires_admin_attention,
        additional_issue_note: newPMReport.additional_issue_note || null,
        program_on_track: newPMReport.program_on_track,
        planned_adjustments: newPMReport.planned_adjustments || null,
        attachment_type: pmReportAttachments.type || null,
        attachment_url: pmReportAttachments.url || null,
      };
      const response = await fetch("/api/pm/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.reportTransmitted"));
        setShowPMReportModal(false);
        setPmReportAttachments({ type: "", url: "" });
        setNewPMReport({
          summary: "",
          status: "optimal",
          week_status: "",
          week_rating: "",
          main_topic: "",
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
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.failed") || "") ||
            data.error ||
            t("pmMisc.workspace.failed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const addKPI = async () => {
    if (user.role !== "super_admin") {
      notify(t("pmMisc.workspace.superAdminKpiDefineOnly"), "error");
      return;
    }
    if (!newKPI.title.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/v2/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newKPI, program_id: id }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.kpiDefined"));
        setShowKPIModal(false);
        setNewKPI({ title: "" });
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.failed") || "") ||
            data.error ||
            t("pmMisc.workspace.failed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const _removeKPI = (kpiId) => {
    if (user.role !== "super_admin") {
      notify(t("pmMisc.workspace.superAdminKpiRemoveOnly"), "error");
      return;
    }
    setConfirmTarget({
      id: kpiId,
      message: t("pmMisc.workspace.confirmDecommissionKpi"),
      onConfirm: () => performRemoveKPI(kpiId),
    });
  };

  const performRemoveKPI = async (kpiId) => {
    try {
      await fetch("/api/v2/kpis", {
        method: "DELETE",
        body: JSON.stringify({ id: kpiId }),
      });
      notify(t("pmMisc.workspace.kpiRemoved"));
      fetchProgramData(true);
    } catch {}
  };

  const assignStaff = async () => {
    if (!newStaff.staff_id) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/v2/program-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newStaff, program_id: id }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.personnelAssigned"));
        setShowStaffModal(false);
        setNewStaff({ staff_id: "", role: "staff" });
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.assignmentFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.assignmentFailed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const removeStaff = (staffId) => {
    setConfirmTarget({
      id: staffId,
      message: t("pmMisc.workspace.confirmRemoveStaff"),
      onConfirm: () => performRemoveStaff(staffId),
    });
  };

  const performRemoveStaff = async (staffId) => {
    try {
      const record = assignedStaff.find((member) => member.cid === staffId);
      if (record && record.id) {
        await fetch("/api/v2/program-staff", {
          method: "DELETE",
          body: JSON.stringify({ id: record.id }),
        });
        notify(t("pmMisc.workspace.personnelRemoved"));
        fetchProgramData(true);
      }
    } catch {}
  };

  const deleteTeam = (teamId) => {
    setConfirmTarget({
      id: teamId,
      message: t("pmMisc.workspace.confirmDecommissionGroup"),
      onConfirm: () => performDeleteTeam(teamId),
    });
  };

  const performDeleteTeam = async (teamId) => {
    try {
      const response = await fetch("/api/pm/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId }),
      });
      if ((await response.json()).success) {
        notify(t("pmMisc.workspace.groupDecommissioned"));
        fetchProgramData(true);
      }
    } catch {
      notify(t("pmMisc.workspace.removeGroupFailed"), "error");
    }
  };

  const [showArchivedSessions, setShowArchivedSessions] = useState(false);

  const deleteSession = (sessionId) => {
    setConfirmTarget({
      id: sessionId,
      message: t("pmMisc.workspace.confirmArchiveSession"),
      onConfirm: () => performDeleteSession(sessionId),
    });
  };

  const performDeleteSession = async (sessionId) => {
    try {
      await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_status",
          program_id: id,
          id: sessionId,
          status: "archived",
        }),
      });
      notify(t("pmMisc.workspace.sessionArchived"));
      fetchProgramData(true);
    } catch {}
  };

  const handleReviewSubmission = async () => {
    if (!selectedSubmission) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSubmission.id,
          status: "approved",
          score: parseInt(reviewScore) || 0,
          feedback: "Graded via PM Dashboard",
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.submissionGraded"));
        setShowReviewModal(false);
        setShowFollowupFields(false);
        setFollowupDate("");
        setFollowupTime("");
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.gradeFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.gradeFailed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!selectedSubmission) return;
    if (!reviewFeedback.trim()) {
      notify("Written feedback is required", "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSubmission.id,
          status: "revision_requested",
          feedback: reviewFeedback.trim(),
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.submissionGraded"));
        setShowReviewModal(false);
        setReviewFeedback("");
        fetchProgramData(true);
      } else {
        notify(data.error || t("pmMisc.workspace.gradeFailed"), "error");
      }
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectSubmission = async () => {
    if (!selectedSubmission) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSubmission.id,
          status: "rejected",
          rejection_reason: reviewFeedback.trim() || "Rejected",
          feedback: reviewFeedback.trim() || "Rejected",
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.submissionGraded"));
        setShowReviewModal(false);
        setReviewFeedback("");
        fetchProgramData(true);
      } else {
        notify(data.error || t("pmMisc.workspace.gradeFailed"), "error");
      }
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

  const reviewRatingLabel = (value) =>
    FACILITATOR_REVIEW_OPTIONS.ratings.includes(value)
      ? t(`pmMisc.facilitators.weeklyReview.rating_${value}`)
      : value || "";
  const reviewEngagementLabel = (value) =>
    FACILITATOR_REVIEW_OPTIONS.engagement.includes(value)
      ? t(`pmMisc.facilitators.weeklyReview.engagement_${value}`)
      : value || "";
  const reviewAttentionLabel = (value) =>
    FACILITATOR_REVIEW_OPTIONS.attention.includes(value)
      ? t(`pmMisc.facilitators.weeklyReview.attention_${value}`)
      : value || "";

  const handleReviewDecision = async (reviewId, decision) => {
    try {
      const response = await fetch("/api/facilitator-reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reviewId, pm_decision: decision }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.reviewDecided") || "Review updated");
        refreshReviews();
      } else {
        notify(data.error || "Failed to update review", "error");
      }
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    }
  };

  const handleScheduleFollowup = async () => {
    if (!selectedSubmission) return;
    if (!followupDate || !followupTime) {
      notify(t("pmMisc.workspace.followupDateTimeRequired"), "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSubmission.id,
          status: "pending_followup",
          score: parseInt(reviewScore) || 0,
          feedback: followupNotes || "Follow-up scheduled",
          followup_date: followupDate,
          followup_time: followupTime,
          followup_duration: parseInt(followupDuration) || 30,
          meeting_link: followupMeetingLink || null,
          followup_notes: followupNotes || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.followupScheduled"));
        setShowReviewModal(false);
        setShowFollowupFields(false);
        setFollowupDate("");
        setFollowupTime("");
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.followupScheduleFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.followupScheduleFailed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Open a submission's attachment: PDFs open in the built-in viewer, anything else in a new tab.
  const handleViewSubmission = (submission) => {
    const url =
      submission.file_url ||
      submission.submission_url ||
      submission.submission_link ||
      submission.supporting_url ||
      null;
    if (!url) {
      notify(t("pmMisc.workspace.noSubmissionFile"), "error");
      return;
    }
    const path = url.split("?")[0].toLowerCase();
    if (path.endsWith(".pdf")) {
      setActivePDF({
        url,
        name:
          submission.deliverable_title ||
          t("pmMisc.workspace.submissionDocument"),
      });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const updateParticipantScores = async (participantId, score) => {
    const numericScore = parseInt(score, 10);
    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
      notify(t("pmMisc.workspace.invalidScore"), "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: participantId,
          program_id: id,
          score: numericScore,
        }),
      });
      if ((await response.json()).success) {
        notify(t("pmMisc.workspace.scoresSynced", { score: numericScore }));
        setEditingScoreFor(null);
        setScoreDraft("");
        fetchProgramData(true);
      } else {
        notify(t("pmMisc.workspace.syncFailed"), "error");
      }
    } catch {
      notify(t("pmMisc.workspace.syncFailed"), "error");
    } finally {
      setIsSaving(false);
    }
  };

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

  const pendingSubmissionCount = submissions.filter(
    (submission) => submission.status === "pending",
  ).length;

  const allTabs = [
    {
      id: "overview",
      name: t("pmMisc.workspace.tabOverview"),
      icon: LayoutDashboard,
    },
    {
      id: "config",
      name: t("pmMisc.workspace.tabConfiguration"),
      icon: Shield,
      roles: ["super_admin", "program_manager"],
    },
    {
      id: "curriculum",
      name: t("pmMisc.workspace.tabCurriculum"),
      icon: FileText,
    },
    {
      id: "attendance",
      name: t("pmMisc.workspace.tabAttendance"),
      icon: CheckCircle2,
    },
    {
      id: "reports",
      name: t("pmMisc.workspace.tabReports"),
      icon: BarChart3,
      roles: ["super_admin", "program_manager", "staff"],
    },
    {
      id: "reviews",
      name: t("pmMisc.workspace.tabReviews"),
      icon: MessageCircle,
      roles: ["super_admin", "program_manager", "staff"],
    },
    {
      id: "participants",
      name: t("pmMisc.workspace.tabParticipants"),
      icon: Users,
    },
    {
      id: "submissions",
      name: t("pmMisc.workspace.tabSubmissions"),
      icon: Activity,
    },
    {
      id: "facilitators",
      name: t("pmMisc.workspace.tabFacilitators"),
      icon: UserPlus,
      roles: ["super_admin", "program_manager", "staff"],
    },
  ];

  const isAssignedPm =
    user.role === "super_admin" ||
    (!!program?.assigned_pm_id &&
      (user.cid === program.assigned_pm_id ||
        user.id === program.assigned_pm_id));

  // Assistants / associates listed in assigned_assistant_id are "team members"
  const isTeamMember = programTeamMembers.some(
    (member) => member.cid === (user.cid || user.id),
  );

  // A staff member who is the program's assigned PM, OR a team member
  // (assistant/associate), can manage the program the same as a program_manager.
  const canEdit =
    user.role === "super_admin" ||
    user.role === "program_manager" ||
    isAssignedPm ||
    isTeamMember;

  const canContribute = canEdit;

  // Tabs: show all tabs to anyone with edit rights, otherwise filter by roles array
  const tabs = allTabs.filter(
    (tab) =>
      !tab.roles ||
      tab.roles.includes(user.role) ||
      isAssignedPm ||
      isTeamMember,
  );

  // curriculum content moved inline below

  const handleSelectTab = (tab) => {
    if (tab.href) router.push(tab.href);
    else {
      if (tab.id === "submissions") {
        setSubmissionsSeen(true);
        // Tell the global sidebar badge to clear too.
        window.dispatchEvent(new CustomEvent("pm:submissions-seen"));
      }
      setActiveTab(tab.id);
    }
  };

  const handleCopyRegFormLink = () => {
    navigator.clipboard.writeText(regForm.link);
    window.dispatchEvent(
      new CustomEvent("impactos:notify", {
        detail: {
          type: "success",
          message: t("pmMisc.workspace.registrationLinkCopied"),
        },
      }),
    );
  };

  const handleDeployTeam = () => {
    setNewTeam({
      name: "",
      handler_name: "",
      member_ids: selectedParticipants,
    });
    setEmailInput("");
    setShowTeamModal(true);
  };

  const handleToggleParticipant = (isSelected, participant) => {
    if (isSelected)
      setSelectedParticipants(
        selectedParticipants.filter((id) => id !== participant.id),
      );
    else setSelectedParticipants([...selectedParticipants, participant.id]);
  };

  const handleChangeParticipantTeam = (event, participant) => {
    const newTeamId = event.target.value;
    if (newTeamId && newTeamId !== (participant.v2_team_id || "")) {
      changeParticipantTeam(participant.id, newTeamId);
    }
  };

  const handleOpenTeamDetails = (team) => {
    setSelectedTeam(team);
    setShowTeamDetails(true);
  };

  const handleAddSession = () => {
    const nextWeekNumber =
      sessions.length > 0
        ? Math.max(...sessions.map((session) => session.week_number || 0)) + 1
        : 1;
    setNewSession({
      title: "",
      week_number: nextWeekNumber,
      status: "pending",
      kpi_ids: [],
      handler_ids: [],
      handler_names: [],
      scheduled_date: "",
      start_time: "",
      end_time: "",
      notes: "",
      extra_materials: [],
    });
    setShowSessionModal(true);
  };

  const handleToggleSessionExpanded = (event, session) => {
    event.stopPropagation();
    setExpandedSessionId(expandedSessionId === session.id ? null : session.id);
  };

  const handleOpenSessionAttendance = (event, session) => {
    event.stopPropagation();
    setSelectedSessionId(session.id);
    setSelectedSessionForAttendance(session);
    setShowAttendanceModal(true);
  };

  const handleOpenSessionPMReport = (event, session) => {
    event.stopPropagation();
    setSelectedSessionId(session.id);
    setShowPMReportModal(true);
  };

  const handleToggleSessionLock = (event, session) => {
    event.stopPropagation();
    const newStatus = session.status === "locked" ? "not started" : "locked";
    updateSessionStatus(session.id, newStatus);
  };

  const handleDeleteSession = (event, session) => {
    event.stopPropagation();
    deleteSession(session.id);
  };

  const handleEditSessionDescription = (event, session) => {
    // Update local state only, save on blur
    const updated = sessions.map((item) =>
      item.id === session.id
        ? { ...item, description: event.target.value }
        : item,
    );
    setSessions(updated);
  };

  const handleToggleSessionHandler = (event, session, stringId) => {
    const checked = event.target.checked;
    let currentIds = [];
    try {
      currentIds = JSON.parse(session.handler_id || "[]");
      if (!Array.isArray(currentIds))
        currentIds = session.handler_id ? [session.handler_id] : [];
    } catch {
      currentIds = session.handler_id ? [session.handler_id] : [];
    }

    let newIds;
    if (checked) {
      newIds = [...new Set([...currentIds, stringId])];
    } else {
      newIds = currentIds.filter((id) => id !== stringId);
    }

    const staffList =
      programTeamMembers.length > 0 ? programTeamMembers : assignedStaff;
    const selectedStaff = staffList.filter((staff) =>
      newIds.includes(String(staff.cid)),
    );
    const selectedNames = selectedStaff.map((staff) => staff.name);

    updateSessionField(
      session.id,
      "handler_id",
      JSON.stringify(newIds),
      JSON.stringify(selectedNames),
    );
  };

  const handleOpenRequirementForSession = (session) => {
    setSelectedSessionId(session.id);
    // Pre-populate KPIs from the session (handle JSON string or array)
    let sessionKpiIds = session.kpi_ids || [];
    if (typeof sessionKpiIds === "string") {
      try {
        sessionKpiIds = JSON.parse(sessionKpiIds);
      } catch (_) {
        sessionKpiIds = [];
      }
    }
    if (!Array.isArray(sessionKpiIds)) sessionKpiIds = [];
    setNewRequirement((prev) => ({ ...prev, kpi_ids: sessionKpiIds }));
    setShowRequirementModal(true);
  };

  const handleSendRequirementReminder = async (requirement) => {
    try {
      const response = await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_reminder",
          requirement_id: requirement.id,
          program_id: id,
        }),
      });
      const data = await response.json();
      if (data.success) {
        const message =
          data.sent > 0
            ? t("pmMisc.workspace.reminderSentTo", { count: data.sent })
            : t("pmMisc.workspace.reminderSent");
        notify(message);
      } else {
        notify(t("pmMisc.workspace.reminderFailed"));
      }
    } catch {
      notify(t("pmMisc.workspace.reminderError"));
    }
  };

  const handleOpenAttendanceModal = (session) => {
    setSelectedSessionForAttendance(session);
    setShowAttendanceModal(true);
  };

  const handleOpenPdfViewer = (event, url) => {
    event.preventDefault();
    event.stopPropagation();
    setActivePDF({ url: url || "#", name });
  };

  const handleRecalculateKpis = async () => {
    try {
      const response = await fetch(`/api/kpi-progress?program_id=${id}`);
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.kpiRecalculated"));
        fetchProgramData(true);
      }
    } catch (_) {
      notify(t("pmMisc.workspace.recalculationFailed"), "error");
    }
  };

  const handleExportPmReport = async (type, format, label) => {
    try {
      const response = await fetch(
        `/api/pm/export?type=${type}&program_id=${id}&format=${format}`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Export failed");
      if (format === "pdf") {
        const { rows: data, filename } = await response.json();
        const { default: jsPDF } = await import("jspdf");
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(12);
        doc.text(`${type.toUpperCase()} - Talent for Startups`, 10, 10);
        if (data && data.length > 0) {
          const headers = Object.keys(data[0]);
          let lineY = 20;
          doc.setFontSize(7);
          // Header row
          headers.forEach((header, columnIndex) =>
            doc.text(String(header), 10 + columnIndex * 35, lineY),
          );
          lineY += 5;
          // Data rows (max 40 rows per page)
          data.slice(0, 80).forEach((row, _ri) => {
            if (lineY > 180) {
              doc.addPage();
              lineY = 15;
            }
            headers.forEach((header, columnIndex) => {
              const cellValue = String(row[header] ?? "").substring(0, 20);
              doc.text(cellValue, 10 + columnIndex * 35, lineY);
            });
            lineY += 4;
          });
        }
        doc.save(filename);
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        const fileExtension = format === "xlsx" ? "xlsx" : "csv";
        anchor.href = url;
        anchor.download = `${type}-${id}.${fileExtension}`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
      notify(t("pmMisc.workspace.exported", { label }));
    } catch {
      notify(t("pmMisc.workspace.exportFailed"), "error");
    }
  };

  const handleOpenReviewModal = (submission) => {
    setSelectedSubmission(submission);
    setReviewScore(submission.score || 0);
    setShowReviewModal(true);
  };

  const handleChangeNewTeamStaff = (event) => {
    const staff = oversightCandidates.find(
      (member) => String(member.cid) === event.target.value,
    );
    setNewTeam((prev) => ({
      ...prev,
      staff_id: event.target.value,
      handler_name: staff?.name || "",
    }));
  };

  const handleToggleSessionStaff = (staff) => {
    const handlerIds = newSession.handler_ids || [];
    const handlerNames = newSession.handler_names || [];
    const staffCid = String(staff.cid);
    if (handlerIds.includes(staffCid)) {
      const index = handlerIds.indexOf(staffCid);
      setNewSession((prev) => ({
        ...prev,
        handler_ids: handlerIds.filter((id) => id !== staffCid),
        handler_names: handlerNames.filter(
          (_, nameIndex) => nameIndex !== index,
        ),
      }));
    } else {
      setNewSession((prev) => ({
        ...prev,
        handler_ids: [...handlerIds, staffCid],
        handler_names: [...handlerNames, staff.name],
      }));
    }
  };

  const handleSessionMaterialFile = (event) => {
    const file = event.target.files?.[0];
    if (file)
      setNewSessionMaterial((prev) => ({
        ...prev,
        content: file.name,
        name: file.name,
      }));
  };

  const handleAttachSessionMaterial = () => {
    if (!newSessionMaterial.content.trim()) return;
    setNewSession((prev) => ({
      ...prev,
      extra_materials: [
        ...(prev.extra_materials || []),
        { ...newSessionMaterial },
      ],
    }));
    setNewSessionMaterial({
      type: "text",
      content: "",
      name: "",
    });
  };

  const handleAddSessionRequirement = () => {
    setNewSession((prev) => ({
      ...prev,
      requirements: [
        ...(prev.requirements || []),
        { ...newRequirement, kpi_ids: prev.kpi_ids || [] },
      ],
    }));
    setNewRequirement({
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
  };

  const handleResetFollowupFields = () => {
    setShowFollowupFields(false);
    setFollowupDate("");
    setFollowupTime("");
  };

  const handleSaveAttendance = async () => {
    if (!selectedSessionForAttendance || !attendanceDate) return;
    setIsSaving(true);
    try {
      // Delta-only save: send only participants whose mark
      // changed since the modal opened (empty = explicit
      // clear). Marks the PM did not touch — including those
      // recorded by a facilitator for their team — are left
      // exactly as they are.
      const records = participants
        .map((participant) => {
          const participantId =
            participant.user_id || participant.cid || participant.id;
          return {
            session_id: selectedSessionForAttendance.id,
            program_id: id,
            participant_id: participantId,
            status: attendanceRecords[participantId] || "",
            date: attendanceDate,
          };
        })
        .filter(
          (record) =>
            record.participant_id &&
            record.status !== (attendanceLoaded[record.participant_id] || ""),
        );
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(records),
      });
      const data = await response.json();
      if (!data.success)
        throw new Error(
          t(data.error || "Unknown error") || data.error || "Unknown error",
        );
      notify(
        t("pmMisc.workspace.attendanceRecorded", { count: data.upserted }),
      );
      setShowAttendanceModal(false);
      setAttendanceRecords({});
      setAttendanceLoaded({});
    } catch (error) {
      notify(
        (error && error.message) || t("pmMisc.workspace.attendanceSaveFailed"),
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseTeamDetails = () => {
    setShowTeamDetails(false);
    setSelectedTeam(null);
    setEditingScoreFor(null);
    setScoreDraft("");
  };

  const handleCancelFacilitatorSelect = () => {
    setShowFacilitatorSelect(false);
    setFacilitatorDraftId("");
  };

  const handleOpenFacilitatorSelect = () => {
    setFacilitatorDraftId(selectedTeam.handler_id || "");
    setShowFacilitatorSelect(true);
  };

  const handleParticipantScoreKeyDown = (event, participantId) => {
    if (event.key === "Enter") {
      updateParticipantScores(participantId, scoreDraft);
    }
  };

  const handleCancelScoreEdit = () => {
    setEditingScoreFor(null);
    setScoreDraft("");
  };

  const handleEditParticipantScore = (participantId, avgScore) => {
    setEditingScoreFor(participantId);
    setScoreDraft(String(avgScore || ""));
  };

  const handleConfirmAction = () => {
    confirmTarget.onConfirm();
    setConfirmTarget(null);
  };

  return (
    <>
      <div className="space-y-8 animate-in">
        {/* HEADER SECTION */}
        <ProgramHeader program={program} />

        {/* TAB NAVIGATION */}
        <ProgramTabs
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          pendingSubmissionCount={pendingSubmissionCount}
          submissionsSeen={submissionsSeen}
          tabs={tabs}
        />

        {/* WORKSPACE CONTENT */}
        <div className="pt-4">
          {activeTab === "overview" && (
            <OverviewTab
              assignedStaff={assignedStaff}
              families={families}
              onCopyRegFormLink={handleCopyRegFormLink}
              participants={participants}
              program={program}
              regForm={regForm}
              reports={reports}
              requirements={requirements}
              sessions={sessions}
              submissions={submissions}
              teams={teams}
            />
          )}

          {activeTab === "participants" && (
            <ParticipantsTab
              activeSubTab={activeSubTab}
              assignedStaff={assignedStaff}
              canEdit={canEdit}
              onActiveSubTab={setActiveSubTab}
              onActiveSubTabGroups={setActiveSubTab}
              onActiveSubTabStaff={setActiveSubTab}
              onChangeParticipantTeam={handleChangeParticipantTeam}
              onDeleteTeam={deleteTeam}
              onDeployTeam={handleDeployTeam}
              onOpenStaffModal={() => setShowStaffModal(true)}
              onOpenTeamDetails={handleOpenTeamDetails}
              onRemoveStaff={removeStaff}
              onSelectedParticipants={setSelectedParticipants}
              onSelectedParticipants2={setSelectedParticipants}
              onToggleParticipant={handleToggleParticipant}
              participants={participants}
              selectedParticipants={selectedParticipants}
              teams={teams}
            />
          )}

          {activeTab === "curriculum" && (
            <CurriculumTab
              assignedStaff={assignedStaff}
              canContribute={canContribute}
              canEdit={canEdit}
              expandedSessionId={expandedSessionId}
              id={id}
              kpis={kpis}
              onAddSession={handleAddSession}
              onDeleteSession={handleDeleteSession}
              onEditSessionDescription={handleEditSessionDescription}
              onExpandedSessionId={setExpandedSessionId}
              onOpenRequirementForSession={handleOpenRequirementForSession}
              onOpenSessionAttendance={handleOpenSessionAttendance}
              onOpenSessionPMReport={handleOpenSessionPMReport}
              onSendRequirementReminder={handleSendRequirementReminder}
              onShowArchivedSessions={setShowArchivedSessions}
              onToggleSessionExpanded={handleToggleSessionExpanded}
              onToggleSessionHandler={handleToggleSessionHandler}
              onToggleSessionLock={handleToggleSessionLock}
              onUpdateSessionFieldBlur={updateSessionField}
              onUpdateSessionFieldChange={updateSessionField}
              onUpdateSessionFieldEndDateChange={updateSessionField}
              onUpdateSessionFieldEndTimeChange={updateSessionField}
              onUpdateSessionFieldScheduledDateChange={updateSessionField}
              onUpdateSessionFieldStartTimeChange={updateSessionField}
              onUpdateSessionFieldTimezoneChange={updateSessionField}
              onUpdateSessionFieldWeekNumberChange={updateSessionField}
              onUpdateSessionStatusChange={updateSessionStatus}
              programTeamMembers={programTeamMembers}
              requirements={requirements}
              sessions={sessions}
              showArchivedSessions={showArchivedSessions}
            />
          )}

          {activeTab === "attendance" && (
            <AttendanceTab
              onOpenAttendanceModal={handleOpenAttendanceModal}
              sessions={sessions}
            />
          )}

          {activeTab === "config" && (
            <ConfigTab
              configDescRef={configDescRef}
              configEndRef={configEndRef}
              configGradingRef={configGradingRef}
              configNameRef={configNameRef}
              configStartRef={configStartRef}
              configStatusRef={configStatusRef}
              configWeeksRef={configWeeksRef}
              isSaving={isSaving}
              kpis={kpis}
              onActivePDF={setActivePDF}
              onOpenPdfViewer={handleOpenPdfViewer}
              onRecalculateKpis={handleRecalculateKpis}
              onSaveConfig={saveConfig}
              program={program}
              user={user}
            />
          )}

          {activeTab === "reviews" && (
            <ReviewsTab
              facilitatorReviews={facilitatorReviews}
              onRefreshReviews={refreshReviews}
              onReviewDecision={handleReviewDecision}
              onReviewDecisionChangesRequested={handleReviewDecision}
              reviewAttentionLabel={reviewAttentionLabel}
              reviewEngagementLabel={reviewEngagementLabel}
              reviewRatingLabel={reviewRatingLabel}
              reviewsLoading={reviewsLoading}
            />
          )}
          {activeTab === "reports" && (
            <ReportsTab
              onExportPmReport={handleExportPmReport}
              reports={reports}
              user={user}
            />
          )}

          {activeTab === "submissions" && (
            <SubmissionsTab
              onOpenReviewModal={handleOpenReviewModal}
              onViewSubmission={handleViewSubmission}
              submissions={submissions}
              submissionsSeen={submissionsSeen}
            />
          )}

          {activeTab === "facilitators" && <FacilitatorsPanel programId={id} />}
        </div>

        {/* PDF VIEWER MODAL */}
        {activePDF && (
          <PdfViewerModal
            activePDF={activePDF}
            onClearActivePDF={() => setActivePDF(null)}
          />
        )}

        {/* TOAST */}
        {toast && <ProgramToast toast={toast} />}

        {/* DEPLOY STUDENT GROUP MODAL */}
        {showTeamModal && (
          <DeployTeamModal
            emailInput={emailInput}
            isSaving={isSaving}
            newTeam={newTeam}
            onAddEmailsToSelection={addEmailsToSelection}
            onChangeNewTeamStaff={handleChangeNewTeamStaff}
            onCloseTeamModal={() => setShowTeamModal(false)}
            onDeployTeam={deployTeam}
            onEmailInputChange={setEmailInput}
            onLeaderIdChange={setNewTeam}
            onNewTeamChange={setNewTeam}
            onSelectedExistingTeamIdChange={setSelectedExistingTeamId}
            onTeamAssignmentMode={setTeamAssignmentMode}
            onTeamAssignmentModeExisting={setTeamAssignmentMode}
            oversightCandidates={oversightCandidates}
            participants={participants}
            selectedExistingTeamId={selectedExistingTeamId}
            selectedParticipants={selectedParticipants}
            teamAssignmentMode={teamAssignmentMode}
            teams={teams}
          />
        )}

        {/* ADD SESSION MODAL */}
        {showSessionModal && (
          <SessionModal
            isSaving={isSaving}
            kpis={kpis}
            newRequirement={newRequirement}
            newSession={newSession}
            newSessionMaterial={newSessionMaterial}
            onAddSession={addSession}
            onAddSessionRequirement={handleAddSessionRequirement}
            onAssigneeTypeChange={setNewRequirement}
            onAttachSessionMaterial={handleAttachSessionMaterial}
            onCloseSessionModal={closeSessionModal}
            onCloseSessionModal2={() => setShowSessionModal(false)}
            onDescriptionChange={setNewRequirement}
            onDueDateChange={setNewRequirement}
            onEndDateChange={setNewSession}
            onEndTimeChange={setNewSession}
            onNewRequirementChange={setNewRequirement}
            onNewSession={setNewSession}
            onNewSessionChange={setNewSession}
            onNewSessionMaterial={setNewSessionMaterial}
            onNewSessionMaterialChange={setNewSessionMaterial}
            onNewSessionMaterialExternalLinkChange={setNewSessionMaterial}
            onNotesChange={setNewSession}
            onRequirements={setNewSession}
            onResourceLabelChange={setNewRequirement}
            onResourceUrlChange={setNewRequirement}
            onScheduledDateChange={setNewSession}
            onSessionMaterialFile={handleSessionMaterialFile}
            onStartTimeChange={setNewSession}
            onTitleChange={setNewRequirement}
            onToggleKpi={toggleKpi}
            onToggleSessionStaff={handleToggleSessionStaff}
            programTeamMembers={programTeamMembers}
          />
        )}

        {/* REVIEW & GRADE MODAL */}
        {showReviewModal && (
          <ReviewModal
            followupDate={followupDate}
            followupDuration={followupDuration}
            followupMeetingLink={followupMeetingLink}
            followupNotes={followupNotes}
            followupTime={followupTime}
            isSaving={isSaving}
            onCloseReviewModal={() => setShowReviewModal(false)}
            onFollowupDateChange={setFollowupDate}
            onFollowupDurationChange={setFollowupDuration}
            onFollowupMeetingLinkChange={setFollowupMeetingLink}
            onFollowupNotesChange={setFollowupNotes}
            onFollowupTimeChange={setFollowupTime}
            onOpenFollowupFields={() => setShowFollowupFields(true)}
            onRejectSubmission={handleRejectSubmission}
            onRequestRevision={handleRequestRevision}
            onResetFollowupFields={handleResetFollowupFields}
            onReviewFeedbackChange={setReviewFeedback}
            onReviewScoreChange={setReviewScore}
            onReviewSubmission={handleReviewSubmission}
            onScheduleFollowup={handleScheduleFollowup}
            reviewFeedback={reviewFeedback}
            reviewScore={reviewScore}
            selectedSubmission={selectedSubmission}
            showFollowupFields={showFollowupFields}
          />
        )}

        {/* ASSIGN STAFF MODAL */}
        {showStaffModal && (
          <StaffAssignmentModal
            isSaving={isSaving}
            newStaff={newStaff}
            onAssignStaff={assignStaff}
            onCloseStaffModal={() => setShowStaffModal(false)}
            onNewStaffChange={setNewStaff}
            onRoleChange={setNewStaff}
            staffList={staffList}
          />
        )}

        {/* DEFINE KPI MODAL */}
        {showKPIModal && (
          <KpiModal
            isSaving={isSaving}
            newKPI={newKPI}
            onAddKPI={addKPI}
            onCloseKPIModal={() => setShowKPIModal(false)}
            onNewKPIChange={setNewKPI}
          />
        )}

        {/* ANCHOR REQUIREMENT MODAL */}
        {showRequirementModal && (
          <RequirementModal
            isSaving={isSaving}
            kpis={kpis}
            newRequirement={newRequirement}
            onAllowedFormatChange={setNewRequirement}
            onAssigneeIdChange={setNewRequirement}
            onAssigneeTypeChange={setNewRequirement}
            onCloseAddRequirement={() => addRequirement(false)}
            onCloseRequirementModal={() => setShowRequirementModal(false)}
            onDescriptionChange={setNewRequirement}
            onDueDateChange={setNewRequirement}
            onNewRequirementChange={setNewRequirement}
            onOpenAddRequirement={() => addRequirement(true)}
            onResourceLabelChange={setNewRequirement}
            onResourceUrlChange={setNewRequirement}
            onToggleKpi={toggleKpi}
            participants={participants}
            teams={teams}
          />
        )}

        {/* ATTENDANCE MODAL */}
        {showAttendanceModal && selectedSessionForAttendance && (
          <AttendanceModal
            attendanceDate={attendanceDate}
            attendanceRecords={attendanceRecords}
            isSaving={isSaving}
            onAttendanceDateChange={setAttendanceDate}
            onAttendanceRecordsChange={setAttendanceRecords}
            onCloseAttendanceModal={() => setShowAttendanceModal(false)}
            onSaveAttendance={handleSaveAttendance}
            participants={participants}
            selectedSessionForAttendance={selectedSessionForAttendance}
          />
        )}

        {/* PM WEEKLY REPORT MODAL — Structured Reporting Flow */}
        {showPMReportModal && (
          <PmReportModal
            isSaving={isSaving}
            kpis={kpis}
            newPMReport={newPMReport}
            onAdditionalIssueNoteChange={setNewPMReport}
            onAssignmentGivenSet={setNewPMReport}
            onAssignmentGivenUnset={setNewPMReport}
            onAssignmentKpiIds={setNewPMReport}
            onAssignmentObjectiveChange={setNewPMReport}
            onAssignmentOutcomeChange={setNewPMReport}
            onAttendanceLevel={setNewPMReport}
            onClosePMReportModal={() => setShowPMReportModal(false)}
            onDeliveryChallengeNoteChange={setNewPMReport}
            onDeliveryChallenges={setNewPMReport}
            onDeliveryQuality={setNewPMReport}
            onHadIssues={setNewPMReport}
            onIssueTypes={setNewPMReport}
            onNewPMReport={setNewPMReport}
            onNewPMReportChange={setNewPMReport}
            onParticipantUnderstanding={setNewPMReport}
            onParticipantsAttentionNotesChange={setNewPMReport}
            onParticipantsNeedAttention={setNewPMReport}
            onParticipationLevel={setNewPMReport}
            onPlannedAdjustmentsChange={setNewPMReport}
            onPmReportAttachments={setPmReportAttachments}
            onPmReportAttachmentsChange={setPmReportAttachments}
            onPmReportAttachmentsFile={setPmReportAttachments}
            onProgramOnTrackSet={setNewPMReport}
            onProgramOnTrackUnset={setNewPMReport}
            onReportAttachmentUploadChange={handleReportAttachmentUpload}
            onRequiresAdminAttention={setNewPMReport}
            onResetPmReportAttachments={setPmReportAttachments}
            onStandoutNotesChange={setNewPMReport}
            onStandoutParticipants={setNewPMReport}
            onStatusChange={setNewPMReport}
            onSubmitPMReport={submitPMReport}
            onSummaryChange={setNewPMReport}
            onWeekRating={setNewPMReport}
            pmReportAttachments={pmReportAttachments}
          />
        )}
        {/* TEAM DETAILS MODAL */}
        {showTeamDetails && selectedTeam && (
          <TeamDetailsModal
            canEdit={canEdit}
            editingScoreFor={editingScoreFor}
            facilitatorDraftId={facilitatorDraftId}
            isSaving={isSaving}
            onActivePDF={setActivePDF}
            onCancelFacilitatorSelect={handleCancelFacilitatorSelect}
            onCancelScoreEdit={handleCancelScoreEdit}
            onChangeTeamHandler={changeTeamHandler}
            onCloseTeamDetails={handleCloseTeamDetails}
            onCloseTeamDetails2={handleCloseTeamDetails}
            onCloseTeamDetails3={handleCloseTeamDetails}
            onConfirmTarget={setConfirmTarget}
            onEditParticipantScore={handleEditParticipantScore}
            onFacilitatorDraftIdChange={setFacilitatorDraftId}
            onOpenFacilitatorSelect={handleOpenFacilitatorSelect}
            onParticipantScoreKeyDown={handleParticipantScoreKeyDown}
            onScoreDraftChange={setScoreDraft}
            onUpdateParticipantScores={updateParticipantScores}
            oversightCandidates={oversightCandidates}
            participants={participants}
            removeParticipantFromTeam={removeParticipantFromTeam}
            scoreDraft={scoreDraft}
            selectedTeam={selectedTeam}
            showFacilitatorSelect={showFacilitatorSelect}
            submissions={submissions}
          />
        )}

        {/* CONFIRMATION MODAL */}
        {confirmTarget && (
          <ConfirmActionDialog
            confirmTarget={confirmTarget}
            onClearConfirmTarget={() => setConfirmTarget(null)}
            onConfirmAction={handleConfirmAction}
          />
        )}
      </div>
    </>
  );
}

export default function ProgramWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ProgramWorkspace />
    </Suspense>
  );
}
