"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  Briefcase,
  Activity,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Shield,
  Target,
  Zap,
  Rocket,
  Clock,
  AlertCircle,
  Trash2,
  LayoutDashboard,
  X,
  Save,
  BarChart3,
  User,
  Paperclip,
  BookOpen,
  CheckSquare,
  Square,
  UserPlus,
  Calendar,
  RefreshCw,
  Bell,
  Copy,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import { getWeekNumber } from "@/lib/constants";
import { FacilitatorsPanel } from "@/components/pm/FacilitatorsPanel";

export const dynamic = "force-dynamic";

/**
 * IMPACTOS OPERATIONAL CONTROL — PROGRAM WORKSPACE
 * Performance-first, modular data loading, and clean data-first UI.
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
  const [user, setUser] = useState({});
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
  const [events, setEvents] = useState([]);
  const [assignedStaff, setAssignedStaff] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
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

  // Compute program team members from Super Admin's approved list (assigned_assistant_id)
  const programTeamMembers = React.useMemo(() => {
    if (!program?.assigned_assistant_id) return [];
    try {
      const raw = program.assigned_assistant_id;
      let approvedIds = [];
      // Handle both JSON array string and single CID string
      if (typeof raw === "string") {
        if (raw.startsWith("[")) {
          approvedIds = JSON.parse(raw);
        } else {
          approvedIds = [raw];
        }
      } else if (Array.isArray(raw)) {
        approvedIds = raw;
      }
      if (!Array.isArray(approvedIds)) return [];
      const allAvailable = [...staffList, ...assignedStaff];
      const unique = Array.from(
        new Map(allAvailable.map((s) => [s.cid, s])).values(),
      );
      return unique.filter((s) => approvedIds.includes(s.cid) && s.role !== "investor");
    } catch (e) {
      return [];
    }
  }, [program?.assigned_assistant_id, staffList, assignedStaff]);

  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamAssignmentMode, setTeamAssignmentMode] = useState("new"); // 'new' or 'existing'
  const [selectedExistingTeamId, setSelectedExistingTeamId] = useState("");
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialSessionId, setMaterialSessionId] = useState(null);
  const [materialName, setMaterialName] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");

  const [showRequirementModal, setShowRequirementModal] = useState(false);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [newKPI, setNewKPI] = useState({ title: "" });
  const [showPMReportModal, setShowPMReportModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedSessionForAttendance, setSelectedSessionForAttendance] =
    useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [pmReportAttachments, setPmReportAttachments] = useState({
    type: "text",
    content: "",
  });
  const [showTeamDetails, setShowTeamDetails] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [promoteTarget, setPromoteTarget] = useState(null); // { team, action: 'approve' | 'promote' }

  // Load existing attendance when modal opens
  useEffect(() => {
    if (!showAttendanceModal || !selectedSessionForAttendance) return;
    const loadAttendance = async () => {
      try {
        const res = await fetch(
          `/api/attendance?session_id=${selectedSessionForAttendance.id}&program_id=${id}`
        );
        const data = await res.json();
        if (data.success && data.attendance) {
          const records = {};
          data.attendance.forEach((a) => {
            records[a.participant_id] = a.status;
          });
          setAttendanceRecords(records);
        }
      } catch (_) {}
    };
    loadAttendance();
  }, [showAttendanceModal, selectedSessionForAttendance, id]);

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
  const [newRequirementLink, setNewRequirementLink] = useState({
    type: "text",
    content: "",
  });
  const [newRequirement, setNewRequirement] = useState({
    title: "",
    description: "",
    allowed_format: "pdf",
    kpi_ids: [],
    due_date: "",
    assignee_type: "all",
    assignee_id: "",
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
  const [showFollowupFields, setShowFollowupFields] = useState(false);
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

  const notify = (msg, type = "success") => {
    window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type, message: msg } }));
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/pm/programs", {
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
      const data = await res.json();
      if (data.success) {
        notify(t("pmMisc.workspace.saved"));
        fetchProgramData(true);
      } else notify(t((data.error || t("pmMisc.workspace.saveFailed")) || "") || (data.error || t("pmMisc.workspace.saveFailed")), "error");
    } catch (e) {
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
      const firstPar = participants.find(
        (p) => p.id === selectedParticipants[0],
      );
      const detectedGroupName = firstPar?.group_name || "Individual";

      const payload =
        teamAssignmentMode === "new"
          ? {
            name: newTeam.name,
            group_name: detectedGroupName,
            program_id: id,
            member_ids: selectedParticipants,
            ...(newTeam.handler_name ? { handler_name: newTeam.handler_name } : {}),
            ...(newTeam.staff_id ? { handler_id: newTeam.staff_id } : {}),
            ...(newTeam.leader_id ? { leader_id: newTeam.leader_id } : {}),
          }
          : {
            team_id: selectedExistingTeamId,
            member_ids: selectedParticipants,
          };

      const res = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
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
      } else notify(t((data.error || t("pmMisc.workspace.operationFailed")) || "") || (data.error || t("pmMisc.workspace.operationFailed")), "error");
    } catch (e) {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const changeParticipantTeam = async (participantId, newTeamId) => {
    if (!participantId || !newTeamId) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/pm/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: newTeamId,
          member_ids: [participantId],
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("pmMisc.workspace.participantMoved"));
        fetchProgramData(true);
      } else {
        notify(t((data.error || t("pmMisc.workspace.moveParticipantFailed")) || "") || (data.error || t("pmMisc.workspace.moveParticipantFailed")), "error");
      }
    } catch (e) {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
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
      const res = await fetch("/api/pm/curriculum", {
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
      const data = await res.json();
      if (data.success) {
        notify(t("pmMisc.workspace.added"));
        setShowSessionModal(false);
        setNewSession({
          title: "",
          week_number:
            sessions.length > 0
              ? Math.max(...sessions.map((s) => s.week_number || 0)) + 1
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
      } else notify(t((data.error || t("pmMisc.workspace.addFailed")) || "") || (data.error || t("pmMisc.workspace.addFailed")), "error");
    } catch (e) {
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
      // Derive grading from linked KPIs
      const linkedKpis = kpis.filter(k => (newRequirement.kpi_ids || []).includes(k.id));
      const avgWeight = linkedKpis.length > 0
        ? parseFloat((linkedKpis.reduce((s, k) => s + (parseFloat(k.weight) || 0), 0) / linkedKpis.length).toFixed(2))
        : 1;

      const res = await fetch("/api/pm/curriculum", {
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
          weight: avgWeight,
        }),
      });
      const data = await res.json();
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
        });
        fetchProgramData(true);
      } else notify(t((data.error || t("pmMisc.workspace.failed")) || "") || (data.error || t("pmMisc.workspace.failed")), "error");
    } catch (e) {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSessionStatus = async (sessionId, status) => {
    // Optimistic Update
    const previousSessions = [...sessions];
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, status } : s)),
    );

    try {
      const res = await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_status",
          program_id: id,
          id: sessionId,
          status,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("pmMisc.workspace.statusUpdatedTo", { status: status.toUpperCase() }));
        // Sync with server just in case
        fetchProgramData(true);
      } else {
        setSessions(previousSessions);
        notify(t("pmMisc.workspace.statusUpdateFailed"), "error");
      }
    } catch (e) {
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
      prev.map((s) =>
        s.id === sessionId ? { ...s, [field]: value } : s,
      ),
    );

    try {
      const res = await fetch("/api/pm/curriculum", {
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
      const data = await res.json();
      if (data.success) {
        const silentFields = ["title", "description", "notes"];
        if (!silentFields.includes(field)) {
          notify(t("pmMisc.workspace.sessionFieldSynced"));
        }
        fetchProgramData(true);

        // When a staff member is assigned, create a task for their calendar
        if (field === "handler_id" && value && handlerName) {
          const session = sessions.find((s) => s.id === sessionId);
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
        if (res.status === 401) {
          notify(t("pmMisc.workspace.sessionExpired"), "error");
        } else {
          notify(t((data.error || t("pmMisc.workspace.fieldSyncFailed")) || "") || (data.error || t("pmMisc.workspace.fieldSyncFailed")), "error");
        }
      }
    } catch (e) {
      notify(t("pmMisc.workspace.fieldSyncFailed"), "error");
    }
  };

  const submitPMReport = async () => {
    // Validate required fields
    if (
      !newPMReport.week_status ||
      !newPMReport.week_rating ||
      !newPMReport.main_topic?.trim()
    ) {
      notify(
        t("pmMisc.workspace.reportRequiredFields"),
        "error",
      );
      return;
    }
    setIsSaving(true);
    try {
      const body = {
        action: "submit_pm_report",
        program_id: id,
        session_id: selectedSessionId,
        week_number: sessions.find((s) => s.id === selectedSessionId)
          ?.week_number,
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
      };
      const res = await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("pmMisc.workspace.reportTransmitted"));
        setShowPMReportModal(false);
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
      } else notify(t((data.error || t("pmMisc.workspace.failed")) || "") || (data.error || t("pmMisc.workspace.failed")), "error");
    } catch (e) {
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
      const res = await fetch("/api/v2/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newKPI, program_id: id }),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("pmMisc.workspace.kpiDefined"));
        setShowKPIModal(false);
        setNewKPI({ title: "" });
        fetchProgramData(true);
      } else notify(t((data.error || t("pmMisc.workspace.failed")) || "") || (data.error || t("pmMisc.workspace.failed")), "error");
    } catch (e) {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const removeKPI = (kpiId) => {
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
    } catch (e) { }
  };

  const assignStaff = async () => {
    if (!newStaff.staff_id) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/v2/program-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newStaff, program_id: id }),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("pmMisc.workspace.personnelAssigned"));
        setShowStaffModal(false);
        setNewStaff({ staff_id: "", role: "staff" });
        fetchProgramData(true);
      } else notify(t((data.error || t("pmMisc.workspace.assignmentFailed")) || "") || (data.error || t("pmMisc.workspace.assignmentFailed")), "error");
    } catch (e) {
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
      const record = assignedStaff.find((s) => s.cid === staffId);
      if (record && record.id) {
        await fetch("/api/v2/program-staff", {
          method: "DELETE",
          body: JSON.stringify({ id: record.id }),
        });
        notify(t("pmMisc.workspace.personnelRemoved"));
        fetchProgramData(true);
      }
    } catch (e) { }
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
      const res = await fetch("/api/pm/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId }),
      });
      if ((await res.json()).success) {
        notify(t("pmMisc.workspace.groupDecommissioned"));
        fetchProgramData(true);
      }
    } catch (e) {
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
    } catch (e) { }
  };

  const handleReviewSubmission = async () => {
    if (!selectedSubmission) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSubmission.id,
          status: "approved",
          score: parseInt(reviewScore) || 0,
          feedback: "Graded via PM Dashboard",
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("pmMisc.workspace.submissionGraded"));
        setShowReviewModal(false);
        setShowFollowupFields(false);
        setFollowupDate("");
        setFollowupTime("");
        fetchProgramData(true);
      } else notify(t((data.error || t("pmMisc.workspace.gradeFailed")) || "") || (data.error || t("pmMisc.workspace.gradeFailed")), "error");
    } catch (e) {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
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
      const res = await fetch("/api/submissions", {
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
      const data = await res.json();
      if (data.success) {
        notify(t("pmMisc.workspace.followupScheduled"));
        setShowReviewModal(false);
        setShowFollowupFields(false);
        setFollowupDate("");
        setFollowupTime("");
        fetchProgramData(true);
      } else notify(t((data.error || t("pmMisc.workspace.followupScheduleFailed")) || "") || (data.error || t("pmMisc.workspace.followupScheduleFailed")), "error");
    } catch (e) {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const updateParticipantScores = async (participantId, score) => {
    if (!score) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: participantId,
          program_id: id,
          score: parseInt(score),
        }),
      });
      if ((await res.json()).success) {
        notify(t("pmMisc.workspace.scoresSynced", { score }));
        fetchProgramData(true);
      }
    } catch (e) {
      notify(t("pmMisc.workspace.syncFailed"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const fetchProgramData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const timestamp = new Date().getTime();
        const res = await fetch(
          `/api/pm/full-state?id=${id}&metrics=true&t=${timestamp}`,
          {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
          },
        ).then((res) => res.json());

        if (res.success) {
          setProgram(res.program);
          setSessions(res.sessions || []);
          setTeams(res.teams || []);
          setParticipants(res.participants || []);
          setSubmissions(res.submissions || []);
          setRequirements(res.documents || []);
          setKpis(res.kpis || []);
          setEvents(res.events || []);
          setAssignedStaff(res.assignedStaff || []);
          setStaffList(res.staffList || []);
          setReports(res.reports || []);
          setFamilies(res.families || []);
        }
      } catch (error) {
        console.error("Operational Fetch Failure:", error);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    fetchProgramData();
  }, [fetchProgramData]);

  if (loading) {
    return (
      <DashboardLayout role={user.role || "program_manager"}>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="w-12 h-12 border-4 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">
            {t("common.loading")}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const allTabs = [
    { id: "overview", name: t("pmMisc.workspace.tabOverview"), icon: LayoutDashboard },
    {
      id: "config",
      name: t("pmMisc.workspace.tabConfiguration"),
      icon: Shield,
      roles: ["super_admin", "program_manager"],
    },
    { id: "curriculum", name: t("pmMisc.workspace.tabCurriculum"), icon: FileText },
    { id: "attendance", name: t("pmMisc.workspace.tabAttendance"), icon: CheckCircle2 },
    { id: "reports", name: t("pmMisc.workspace.tabReports"), icon: BarChart3 },
    { id: "participants", name: t("pmMisc.workspace.tabParticipants"), icon: Users },
    { id: "submissions", name: t("pmMisc.workspace.tabSubmissions"), icon: Activity },
    {
      id: "facilitators",
      name: t("pmMisc.workspace.tabFacilitators"),
      icon: UserPlus,
    },
  ];

  const tabs = allTabs.filter(
    (tab) => !tab.roles || tab.roles.includes(user.role),
  );

  const canEdit =
    user.role === "super_admin" || user.role === "program_manager";
  const isAssignedPm =
    user.role === "super_admin" ||
    (program?.assigned_pm_id &&
      (user.cid === program.assigned_pm_id ||
        user.id === program.assigned_pm_id));
  const isTeamMember = programTeamMembers.some(
    (m) => m.cid === (user.cid || user.id),
  );
  const canContribute = canEdit || isTeamMember;

  // curriculum content moved inline below

  return (
    <DashboardLayout role={user.role || "program_manager"}>
      <div className="space-y-8 animate-in">
        {/* HEADER SECTION */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="status-badge bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                {{
                  active: t("pmMisc.workspace.programStatusActive"),
                  archived: t("pmMisc.workspace.programStatusArchived"),
                  draft: t("pmMisc.workspace.programStatusDraft"),
                }[program?.status] || t("pmMisc.workspace.programStatusActive")}
              </span>
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {program?.id}
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              {program?.name}
            </h1>
            <p className="text-[var(--text-secondary)] text-sm max-w-2xl">
              {program?.description}
            </p>
          </div>
        </header>

        {/* TAB NAVIGATION */}
        <div className="flex gap-1 border-b border-[var(--border-primary)] overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.href) router.push(tab.href);
                else setActiveTab(tab.id);
              }}
              className={`px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all border-b-2 whitespace-nowrap shrink-0 ${activeTab === tab.id ? "border-[var(--brand-orange)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="pt-4">
          {activeTab === "overview" && (
            <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card space-y-4 border-l-4 border-blue-500">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-bold">
                    {participants.length}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider">
                    {t("pmMisc.workspace.overviewTotalParticipants")}
                  </p>
                  <p className="text-[10px] text-emerald-500 font-bold mt-1">
                    {sessions.length}{" "}
                    {t(sessions.length !== 1 ? "pmMisc.workspace.sessions" : "pmMisc.workspace.session")}{" "}
                    · {t("pmMisc.workspace.weekProgram", { weeks: program?.duration_weeks || "?" })}
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] font-medium mt-2 leading-relaxed">
                    {t("pmMisc.workspace.overviewParticipantsDesc")}
                  </p>
                </div>
              </div>

              <div className="card space-y-4 border-l-4 border-orange-500">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                    <Activity className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-bold">
                    {submissions.length}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider">
                    {t("pmMisc.workspace.overviewOperationalSubmissions")}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {t("pmMisc.workspace.overviewCompletionRate")}{" "}
                    {participants.length > 0
                      ? Math.round(
                        (submissions.length /
                          (participants.length * sessions.length || 1)) *
                        100,
                      )
                      : 0}
                    %
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] font-medium mt-2 leading-relaxed">
                    {t("pmMisc.workspace.overviewSubmissionsDesc")}
                  </p>
                </div>
              </div>

              <div className="card space-y-4 border-l-4 border-purple-500">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
                    <Target className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-bold">{teams.length}</span>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-[var(--text-secondary)] tracking-wider">
                    {t("pmMisc.workspace.overviewActiveStudentGroups")}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {assignedStaff.length} {t("pmMisc.workspace.staff")} · {reports.length}{" "}
                    {t(reports.length !== 1 ? "pmMisc.workspace.reports" : "pmMisc.workspace.report")}
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] font-medium mt-2 leading-relaxed">
                    {t("pmMisc.workspace.overviewGroupsDesc")}
                  </p>
                </div>
              </div>
            </div>

            {/* REGISTRATION LINK */}
            {families.length > 0 && families[0]?.registration_id && (
              <div className="card mt-6 border-l-4 border-emerald-500">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <p className="text-xs font-black uppercase text-[var(--text-secondary)] tracking-wider">
                      {t("pmMisc.workspace.registrationLink")}
                    </p>
                    <p className="text-[9px] text-emerald-500 font-medium mt-1">
                      {t("pmMisc.workspace.registrationLinkHint")}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <code className="text-[10px] font-mono bg-black/30 px-3 py-2 rounded-lg border border-[var(--border-primary)] truncate max-w-[450px] block" style={{ color: "var(--text-primary)" }}>
                        {typeof window !== "undefined" ? window.location.origin : ""}/register-participant?group_id={families[0]?.registration_id && encodeURIComponent(families[0].registration_id)}
                      </code>
                      <button
                        onClick={() => {
                          const fid = families[0]?.registration_id;
                          if (!fid) return;
                          navigator.clipboard.writeText(
                            `${window.location.origin}/register-participant?group_id=${encodeURIComponent(fid)}`
                          );
                          window.dispatchEvent(new CustomEvent("impactos:notify", { detail: { type: "success", message: t("pmMisc.workspace.registrationLinkCopied") } }));
                        }}
                        className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all border border-emerald-500/20"
                        title={t("pmMisc.workspace.copyRegistrationLink")}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </>
          )}

          {activeTab === "participants" && (
            <div className="space-y-6 animate-in">
              {/* SUB-TAB NAVIGATION */}
              <div className="flex gap-4 border-b border-[var(--border-primary)]/30 pb-2">
                <button
                  onClick={() => setActiveSubTab("individuals")}
                  className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeSubTab === "individuals" ? "border-[var(--brand-orange)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] opacity-50 hover:opacity-100"}`}
                >
                  {t("pmMisc.workspace.subTabIndividuals")} ({participants.filter(p => p.status !== 'archived').length})
                </button>
                <button
                  onClick={() => setActiveSubTab("groups")}
                  className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeSubTab === "groups" ? "border-[var(--brand-orange)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] opacity-50 hover:opacity-100"}`}
                >
                  {t("pmMisc.workspace.subTabTeams")} ({teams.length})
                </button>
                <button
                  onClick={() => setActiveSubTab("staff")}
                  className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeSubTab === "staff" ? "border-[var(--brand-orange)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] opacity-50 hover:opacity-100"}`}
                >
                  {t("pmMisc.workspace.subTabProgramStaff")} ({assignedStaff.length})
                </button>
              </div>

              {activeSubTab === "individuals" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-tertiary p-4 rounded-xl border border-[var(--border-primary)]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.selection")}:
                      </span>
                      <span className="text-sm font-black text-[var(--brand-orange)]">
                        {selectedParticipants.length} {t("pmMisc.workspace.selected")}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setSelectedParticipants(participants.filter(p => p.status !== 'archived').map((p) => p.id))
                        }
                        className="text-[9px] font-black uppercase text-blue-500 hover:underline"
                      >
                        {t("pmMisc.workspace.selectAll")}
                      </button>
                      <button
                        onClick={() => setSelectedParticipants([])}
                        className="text-[9px] font-black uppercase text-rose-500 hover:underline"
                      >
                        {t("pmMisc.workspace.clear")}
                      </button>
                      {selectedParticipants.length > 0 && canEdit && (
                        <button
                          onClick={() => {
                            setNewTeam({
                              name: "",
                              handler_name: "",
                              member_ids: selectedParticipants,
                            });
                            setShowTeamModal(true);
                          }}
                          className="btn btn-primary btn-sm py-1 px-4 gap-2"
                        >
                          <Target className="w-3 h-3" /> {t("pmMisc.workspace.groupStudents")}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="w-10">
                            <div className="flex items-center justify-center">
                              <CheckSquare className="w-4 h-4 opacity-20" />
                            </div>
                          </th>
                          <th>{t("pmMisc.workspace.tableParticipant")}</th>
                          <th>{t("pmMisc.workspace.tableEmail")}</th>
                          <th>{t("pmMisc.workspace.tableGroup")}</th>
                          <th>{t("pmMisc.workspace.tableStatus")}</th>
                          <th className="text-right">{t("pmMisc.workspace.tableActions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participants.filter(p => p.status !== 'archived').map((p) => {
                          const isSelected = selectedParticipants.includes(
                            p.id,
                          );
                          return (
                            <tr
                              key={p.id}
                              className={isSelected ? "bg-orange-500/5" : ""}
                            >
                              <td className="text-center">
                                <button
                                  onClick={() => {
                                    if (isSelected)
                                      setSelectedParticipants(
                                        selectedParticipants.filter(
                                          (id) => id !== p.id,
                                        ),
                                      );
                                    else
                                      setSelectedParticipants([
                                        ...selectedParticipants,
                                        p.id,
                                      ]);
                                  }}
                                  className={`p-2 transition-colors ${isSelected ? "text-[var(--brand-orange)]" : "text-slate-500 opacity-20 hover:opacity-100"}`}
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5" />
                                  ) : (
                                    <Square className="w-5 h-5" />
                                  )}
                                </button>
                              </td>
                              <td className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-xs border border-[var(--border-primary)]">
                                  {p.name.charAt(0)}
                                </div>
                                <span className="font-bold">{p.name}</span>
                              </td>
                              <td>{p.email}</td>
                              <td>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black uppercase text-blue-500 tracking-widest">
                                    {teams.find((t) => t.id === p.v2_team_id)
                                      ?.name || t("pmMisc.workspace.individual")}
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter italic">
                                    {t("pmMisc.workspace.segment")}: {p.group_name || t("pmMisc.workspace.na")}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span className="text-xs font-medium">
                                    {t("pmMisc.workspace.operational")}
                                  </span>
                                </div>
                              </td>
                              <td className="text-right">
                                <div className="flex justify-end gap-2 items-center">
                                  <select
                                    className="text-[10px] font-black uppercase bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1"
                                    value={p.v2_team_id || ""}
                                    onChange={(e) => {
                                      const newTeamId = e.target.value;
                                      if (newTeamId && newTeamId !== (p.v2_team_id || "")) {
                                        changeParticipantTeam(p.id, newTeamId);
                                      }
                                    }}
                                  >
                                    <option value="">{t("pmMisc.workspace.teamNoTeam")}</option>
                                    {teams.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button className="p-2 hover:text-[var(--brand-blue)]">
                                    <Mail className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeSubTab === "groups" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className="card group hover:border-[var(--brand-orange)] transition-all"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-xl bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)]">
                          <Target className="w-6 h-6" />
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => deleteTeam(team.id)}
                            className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="mb-4">
                        <h3 className="text-xl font-black uppercase tracking-tighter">
                          {team.name}
                        </h3>
                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-0.5 italic">
                          {t("pmMisc.workspace.group")}: {team.group_name || t("pmMisc.workspace.na")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="flex -space-x-2">
                          {participants
                            .filter((p) => p.v2_team_id === team.id)
                            .slice(0, 3)
                            .map((p) => (
                              <div
                                key={p.id}
                                className="w-6 h-6 rounded-full bg-tertiary border-2 border-[var(--bg-secondary)] flex items-center justify-center text-[8px] font-bold"
                              >
                                {p.name.charAt(0)}
                              </div>
                            ))}
                        </div>
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                          {
                            participants.filter((p) => p.v2_team_id === team.id)
                              .length
                          }{" "}
                          {t("pmMisc.workspace.members")}
                        </span>
                      </div>
                      <div className="space-y-1 mb-6">
                        <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                          {t("pmMisc.workspace.assignedStaffLabel")}
                        </p>
                        <p className="text-xs text-[var(--text-primary)] font-black uppercase tracking-tight">
                          {team.handler_name || t("pmMisc.workspace.unassigned")}
                        </p>
                      </div>
                      <div className="flex justify-between items-center pt-4 border-t border-[var(--border-primary)]">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                          {team.is_venture_ready ? t("pmMisc.workspace.ventureReady") : t("pmMisc.workspace.inProgram")}
                        </span>
                        <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedTeam(team);
                            setShowTeamDetails(true);
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          <ChevronRight className="w-3 h-3" /> {t("pmMisc.workspace.view")}
                        </button>
                        {!team.is_venture_ready && (
                          <button
                            onClick={() => setPromoteTarget({ team, action: "approve" })}
                            className="btn btn-primary btn-sm"
                          >
                            <CheckCircle2 className="w-3 h-3" /> {t("pmMisc.workspace.approve")}
                          </button>
                        )}
                        {team.is_venture_ready && !team.venture_id && (
                          <button
                            onClick={() => setPromoteTarget({ team, action: "promote" })}
                            className="btn btn-primary btn-sm"
                          >
                            <Zap className="w-3 h-3" /> {t("pmMisc.workspace.promote")}
                          </button>
                        )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {teams.length === 0 && (
                    <div className="card border-dashed flex flex-col items-center justify-center gap-3 opacity-40 min-h-[160px] col-span-full py-8 text-center">
                      <Target className="w-8 h-8 text-[var(--text-secondary)]" />
                      <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.noGroupsFound")}
                        <br />
                        {t("pmMisc.workspace.noGroupsFoundHint")}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {activeSubTab === "staff" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-black uppercase tracking-tighter">
                        {t("pmMisc.workspace.subTabProgramStaff")}
                      </h3>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                        {t("pmMisc.workspace.programStaffDesc")}
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => setShowStaffModal(true)}
                        className="btn btn-primary btn-sm px-4 gap-2"
                      >
                        <UserPlus className="w-3 h-3" /> {t("pmMisc.workspace.assignPersonnel")}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {assignedStaff.map((staff) => (
                      <div
                        key={staff.cid}
                        className="card flex items-center justify-between p-4 hover:border-[var(--brand-orange)] transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] flex items-center justify-center text-xs font-black uppercase border border-[var(--brand-orange)]/20">
                            {staff.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight">
                              {staff.name}
                            </p>
                            <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
                              {staff.role}
                            </p>
                          </div>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => removeStaff(staff.cid)}
                            className="text-rose-500 hover:scale-110 transition-transform"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {assignedStaff.length === 0 && (
                      <div className="card border-dashed flex flex-col items-center justify-center gap-3 opacity-40 min-h-[120px] col-span-full py-8 text-center">
                        <Users className="w-8 h-8 text-[var(--text-secondary)]" />
                        <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("pmMisc.workspace.noStaffAssigned")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "curriculum" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-4 pb-6 border-b border-[var(--border-primary)]">
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  {t("pmMisc.workspace.curriculumTitle")}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowArchivedSessions((p) => !p)}
                    className={`text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${showArchivedSessions
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                      : "bg-transparent border-white/10 text-slate-600 hover:text-slate-400"
                      }`}
                  >
                    {showArchivedSessions ? t("pmMisc.workspace.showingArchived") : t("pmMisc.workspace.archived")}
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => {
                        const nextWK =
                          sessions.length > 0
                            ? Math.max(
                              ...sessions.map((s) => s.week_number || 0),
                            ) + 1
                            : 1;
                        setNewSession({
                          title: "",
                          week_number: nextWK,
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
                      }}
                      className="btn btn-primary btn-sm gap-2"
                    >
                      <Plus className="w-4 h-4" /> {t("pmMisc.workspace.create")}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-4 mt-4">
                {(sessions || [])
                  .filter(
                    (s) => showArchivedSessions || s.status !== "archived",
                  )
                  .map((session) => (
                    <div
                      key={session.id}
                      className="card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50 transition-all shadow-xl bg-secondary group"
                    >
                      {/* STEP 0: THE HEADER (GLOBAL STATE) — click to toggle */}
                      <div
                        onClick={() =>
                          setExpandedSessionId(
                            expandedSessionId === session.id
                              ? null
                              : session.id,
                          )
                        }
                        className="px-6 py-4 bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)] flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-primary border border-[var(--border-primary)] shadow-inner">
                            <span className="text-[10px] font-black text-[var(--text-secondary)] opacity-50">
                              {t("pmMisc.workspace.weekAbbr")}
                            </span>
                            <span className="text-sm font-black text-[var(--brand-orange)] -mt-1">
                              {session.week_number}
                            </span>
                          </div>
                          <div>
                            <h4 className="text-base font-black text-[var(--text-primary)] uppercase tracking-tight">
                              {session.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              {(() => {
                                const now = new Date();
                                const today = new Date(
                                  now.getFullYear(),
                                  now.getMonth(),
                                  now.getDate(),
                                );
                                let displayStatus = session.status;
                                let statusColor = "bg-amber-500";
                                if (session.status === "locked") {
                                  displayStatus = "locked";
                                  statusColor = "bg-rose-500";
                                } else if (session.scheduled_date) {
                                  const schedDate = new Date(
                                    session.scheduled_date,
                                  );
                                  const schedDay = new Date(
                                    schedDate.getFullYear(),
                                    schedDate.getMonth(),
                                    schedDate.getDate(),
                                  );
                                  if (session.status === "completed") {
                                    displayStatus = "completed";
                                    statusColor = "bg-emerald-500";
                                  } else if (schedDay <= today && session.status !== "not started") {
                                    displayStatus = "active";
                                    statusColor = "bg-indigo-500";
                                  } else if (session.status === "not started") {
                                    displayStatus = "not started";
                                    statusColor = "bg-slate-500";
                                  } else {
                                    displayStatus = "pending";
                                    statusColor = "bg-amber-500";
                                  }
                                } else {
                                  if (session.status === "completed") {
                                    displayStatus = "completed";
                                    statusColor = "bg-emerald-500";
                                  } else if (
                                    session.status === "in progress" ||
                                    session.status === "active"
                                  ) {
                                    displayStatus = "active";
                                    statusColor = "bg-indigo-500";
                                  } else {
                                    displayStatus = "pending";
                                    statusColor = "bg-amber-500";
                                  }
                                }
                                return (
                                  <>
                                    <span
                                      className={`w-2 h-2 rounded-full animate-pulse ${statusColor}`}
                                    />
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                                      {t("pmMisc.workspace.state")}: {{
                                        locked: t("pmMisc.workspace.sessionStatusLocked"),
                                        completed: t("pmMisc.workspace.sessionStatusCompleted"),
                                        active: t("pmMisc.workspace.sessionStatusActive"),
                                        "not started": t("pmMisc.workspace.sessionStatusNotStarted"),
                                        pending: t("pmMisc.workspace.sessionStatusPending"),
                                      }[displayStatus] || displayStatus}
                                    </span>
                                  </>
                                );
                              })()}
                              {session.scheduled_date && (
                                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest ml-2">
                                  📅{" "}
                                  {new Date(
                                    session.scheduled_date,
                                  ).toLocaleDateString()}
                                </span>
                              )}
                              {session.timezone && session.timezone !== 'UTC' && (
                                <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                                  {session.timezone}
                                </span>
                              )}
                              {session.notes && (
                                <span
                                  className="text-[9px] font-black text-amber-400 uppercase tracking-widest ml-2"
                                  title={session.notes}
                                >
                                  📌 {t("pmMisc.workspace.notes")}
                                </span>
                              )}
                            </div>
                            {session.handler_name && (
                              <div className="flex items-center gap-1 mt-1">
                                <Users className="w-3 h-3 text-slate-500" />
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                  {session.handler_name}
                                </span>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-2 mt-3">
                              {(() => {
                                try {
                                  const ids =
                                    typeof session.kpi_ids === "string"
                                      ? JSON.parse(session.kpi_ids)
                                      : session.kpi_ids || [];
                                  return kpis
                                    .filter((k) => ids.includes(k.id))
                                    .map((k) => (
                                      <span
                                        key={k.id}
                                        className="px-2 py-0.5 bg-[#FF6600]/10 border border-[#FF6600]/20 text-[#FF6600] text-[8px] font-black uppercase tracking-widest rounded-md"
                                      >
                                        {k.title}
                                      </span>
                                    ));
                                } catch (e) {
                                  return null;
                                }
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedSessionId(
                                expandedSessionId === session.id
                                  ? null
                                  : session.id,
                              );
                            }}
                            title={t("pmMisc.workspace.sessionDetailsTitle")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${expandedSessionId === session.id ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)] text-[var(--brand-orange)]" : "bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]/50 hover:text-[var(--text-primary)]"}`}
                          >
                            <ChevronRight className={`w-3 h-3 transition-transform ${expandedSessionId === session.id ? "rotate-90" : ""}`} />
                            {expandedSessionId === session.id ? t("pmMisc.workspace.hideDetails") : t("pmMisc.workspace.viewDetails")}
                          </button>
                        </div>

                        <div
                          className="flex items-center gap-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSessionId(session.id);
                              setSelectedSessionForAttendance(session);
                              setShowAttendanceModal(true);
                            }}
                            className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/5 transition-all"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black uppercase italic tracking-wider">
                              {t("pmMisc.workspace.attendance")}
                            </span>
                          </button>
                          {canContribute && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSessionId(session.id);
                                setShowPMReportModal(true);
                              }}
                              className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5 transition-all"
                            >
                              <Activity className="w-3.5 h-3.5" />
                              <span className="text-[9px] font-black uppercase italic tracking-wider">
                                {t("pmMisc.workspace.giveWeeklyReport")}
                              </span>
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newStatus = session.status === "locked" ? "not started" : "locked";
                                updateSessionStatus(session.id, newStatus);
                              }}
                              title={session.status === "locked" ? t("pmMisc.workspace.unlockWeek") : t("pmMisc.workspace.lockWeek")}
                              className={`btn btn-secondary !py-2 !px-4 flex items-center gap-2 transition-all ${
                                session.status === "locked"
                                  ? "border-rose-500/20 text-rose-500 hover:bg-rose-500/5"
                                  : "border-amber-500/20 text-amber-500 hover:bg-amber-500/5"
                              }`}
                            >
                              <span className="text-sm">{session.status === "locked" ? "🔓" : "🔒"}</span>
                              <span className="text-[9px] font-black uppercase italic tracking-wider">
                                {session.status === "locked" ? t("pmMisc.workspace.unlock") : t("pmMisc.workspace.lock")}
                              </span>
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                              }}
                              className="p-2 text-rose-500/20 hover:text-rose-500 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        className={`p-6 ${expandedSessionId !== session.id ? "hidden" : ""}`}
                      >
                        <div className="space-y-8">
                          {/* PHASE 1: LOGISTICS (THE SETUP) */}
                          <div className="space-y-6">
                            <div className="flex items-center gap-2 pb-3 border-b border-indigo-500/20">
                              <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[9px] font-black text-indigo-500 border border-indigo-500/20 shadow-sm">
                                1
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">
                                {t("pmMisc.workspace.curriculumLogistics")}
                              </span>
                            </div>

                            <div className={`space-y-4 p-5 bg-primary rounded-2xl border border-[var(--border-primary)] shadow-sm ${!canEdit ? "pointer-events-none opacity-60" : ""}`}>
                              {/* Session Title */}
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                                  {t("pmMisc.workspace.sessionTitle")}
                                </label>
                                <input
                                  type="text"
                                  value={session.title || ""}
                                  onChange={(e) =>
                                    updateSessionField(
                                      session.id,
                                      "title",
                                      e.target.value,
                                    )
                                  }
                                  disabled={session.status === "locked"}
                                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                              </div>

                              {/* Description */}
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                                  {t("pmMisc.workspace.description")}
                                </label>
                                <textarea
                                  value={session.description || ""}
                                  onBlur={(e) =>
                                    updateSessionField(
                                      session.id,
                                      "description",
                                      e.target.value,
                                    )
                                  }
                                  onChange={(e) => {
                                    // Update local state only, save on blur
                                    const updated = sessions.map(s => s.id === session.id ? {...s, description: e.target.value} : s);
                                    setSessions(updated);
                                  }}
                                  rows={2}
                                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-indigo-500 transition-all resize-none"
                                />
                              </div>

                              {/* Week Number + Start/End Time */}
                              <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                                    {t("pmMisc.workspace.week")}
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={session.week_number || 1}
                                    onChange={(e) =>
                                      updateSessionField(
                                        session.id,
                                        "week_number",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" /> {t("pmMisc.workspace.startTime")}
                                  </label>
                                  <input
                                    type="time"
                                    value={session.start_time || ""}
                                    onChange={(e) =>
                                      updateSessionField(
                                        session.id,
                                        "start_time",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" /> {t("pmMisc.workspace.endTime")}
                                  </label>
                                  <input
                                    type="time"
                                    value={session.end_time || ""}
                                    onChange={(e) =>
                                      updateSessionField(
                                        session.id,
                                        "end_time",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                                  />
                                </div>
                              </div>

                              {/* Timezone */}
                              <div className="space-y-1 mt-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                                  {t("pmMisc.workspace.timezone")}
                                </label>
                                <select
                                  value={session.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC')}
                                  onChange={(e) =>
                                    updateSessionField(session.id, "timezone", e.target.value)
                                  }
                                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                                >
                                  {["UTC", "Africa/Porto-Novo", "Europe/Paris", "America/New_York", "Asia/Dubai", "Europe/London"].map(tz => (
                                    <option key={tz} value={tz}>{tz}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                                  {t("pmMisc.workspace.assignStaffMembers")}
                                </label>
                                <div className="space-y-2 p-3 bg-tertiary border border-[var(--border-primary)] rounded-xl max-h-40 overflow-y-auto custom-scrollbar">
                                  {(programTeamMembers.length > 0
                                    ? programTeamMembers
                                    : assignedStaff
                                  ).map((s) => {
                                    const stringId = String(s.cid);
                                    let isSelected = false;
                                    try {
                                      const ids = JSON.parse(
                                        session.handler_id || "[]",
                                      );
                                      isSelected = Array.isArray(ids)
                                        ? ids.includes(stringId)
                                        : session.handler_id === stringId;
                                    } catch (e) {
                                      isSelected = session.handler_id === stringId;
                                    }
                                    return (
                                      <label
                                        key={s.cid}
                                        className="flex items-center gap-2 cursor-pointer"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            let currentIds = [];
                                            try {
                                              currentIds = JSON.parse(
                                                session.handler_id || "[]",
                                              );
                                              if (!Array.isArray(currentIds))
                                                currentIds = session.handler_id
                                                  ? [session.handler_id]
                                                  : [];
                                            } catch (err) {
                                              currentIds = session.handler_id
                                                ? [session.handler_id]
                                                : [];
                                            }

                                            let newIds;
                                            if (checked) {
                                              newIds = [
                                                ...new Set([...currentIds, stringId]),
                                              ];
                                            } else {
                                              newIds = currentIds.filter(
                                                (id) => id !== stringId,
                                              );
                                            }

                                            const staffList =
                                              programTeamMembers.length > 0
                                                ? programTeamMembers
                                                : assignedStaff;
                                            const selectedStaff = staffList.filter(
                                              (staff) =>
                                                newIds.includes(String(staff.cid)),
                                            );
                                            const selectedNames = selectedStaff.map(
                                              (staff) => staff.name,
                                            );

                                            updateSessionField(
                                              session.id,
                                              "handler_id",
                                              JSON.stringify(newIds),
                                              JSON.stringify(selectedNames),
                                            );
                                          }}
                                          className="rounded border-[var(--border-primary)] bg-[var(--surface-2)] text-indigo-500"
                                        />
                                        <span className="text-[11px] font-bold text-[var(--text-primary)]">
                                          {s.name} ({s.role})
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1 flex items-center gap-1">
                                    <Calendar className="w-2.5 h-2.5 text-white" />{" "}
                                    {t("pmMisc.workspace.startDate")}
                                  </label>
                                  <input
                                    type="date"
                                    value={
                                      session.scheduled_date
                                        ? new Date(session.scheduled_date)
                                          .toISOString()
                                          .split("T")[0]
                                        : ""
                                    }
                                    onChange={(e) =>
                                      updateSessionField(
                                        session.id,
                                        "scheduled_date",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1 flex items-center gap-1">
                                    <Calendar className="w-2.5 h-2.5 text-white" />{" "}
                                    {t("pmMisc.workspace.finishDate")}
                                  </label>
                                  <input
                                    type="date"
                                    value={
                                      session.end_date
                                        ? new Date(session.end_date)
                                          .toISOString()
                                          .split("T")[0]
                                        : ""
                                    }
                                    onChange={(e) =>
                                      updateSessionField(
                                        session.id,
                                        "end_date",
                                        e.target.value,
                                      )
                                    }
                                    className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                                  />
                                </div>
                              </div>

                              <div className="pt-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                                  {t("pmMisc.workspace.operationalState")}
                                </label>
                                <select
                                  value={session.status}
                                  onChange={(e) =>
                                    updateSessionStatus(
                                      session.id,
                                      e.target.value,
                                    )
                                  }
                                  disabled={session.status === "locked"}
                                  className={`w-full mt-1 px-4 py-3 rounded-xl border text-[10px] font-black uppercase outline-none transition-all cursor-pointer ${
                                    session.status === "locked"
                                      ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                                      : session.status === "completed"
                                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                        : session.status === "in progress"
                                          ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/30"
                                          : session.status === "not started"
                                            ? "bg-slate-500/10 text-slate-400 border-slate-500/30"
                                            : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                  }`}
                                >
                                  <option value="not started">{t("pmMisc.workspace.sessionStatusNotStarted")}</option>
                                  <option value="pending">{t("pmMisc.workspace.sessionStatusPending")}</option>
                                  <option value="in progress">
                                    {t("pmMisc.workspace.sessionStatusInProgress")}
                                  </option>
                                  <option value="completed">{t("pmMisc.workspace.sessionStatusCompleted")}</option>
                                  <option value="locked">{t("pmMisc.workspace.sessionStatusLockedOption")}</option>
                                </select>
                              </div>
                              {session.version > 1 && (
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                                    {t("pmMisc.workspace.version")}: {session.version}
                                  </span>
                                  <span className="text-[7px] text-slate-500">
                                    ({session.version - 1} {t(session.version > 2 ? "pmMisc.workspace.revisions" : "pmMisc.workspace.revision")})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* SEPARATOR */}
                          <div className="w-full h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

                          {/* PHASE 2: CURRICULUM (THE CORE) */}
                          <div className="space-y-6">
                            <div className="flex items-center justify-between pb-3 border-b border-[var(--brand-orange)]/20">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[9px] font-black text-[var(--brand-orange)] border border-[var(--brand-orange)]/20 shadow-sm">
                                  2
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-orange)]">
                                  {t("pmMisc.workspace.curriculumAssessments")}
                                </span>
                              </div>
                              {canEdit && (
                                <button
                                  onClick={() => {
                                    setSelectedSessionId(session.id);
                                    // Pre-populate KPIs from the session (handle JSON string or array)
                                    let sessionKpiIds = session.kpi_ids || [];
                                    if (typeof sessionKpiIds === "string") {
                                      try { sessionKpiIds = JSON.parse(sessionKpiIds); } catch (_) { sessionKpiIds = []; }
                                    }
                                    if (!Array.isArray(sessionKpiIds)) sessionKpiIds = [];
                                    setNewRequirement((p) => ({ ...p, kpi_ids: sessionKpiIds }));
                                    setShowRequirementModal(true);
                                  }}
                                  className="text-[9px] font-black text-[var(--brand-orange)] uppercase hover:underline flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> {t("pmMisc.workspace.addRequirement")}
                                </button>
                              )}
                            </div>

                            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                              {requirements
                                .filter((r) => r.session_id === session.id)
                                .map((req) => (
                                  <div
                                    key={req.id}
                                    className="flex items-center justify-between p-4 bg-primary rounded-2xl border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all shadow-sm"
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className="w-9 h-9 rounded-xl bg-indigo-500/5 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-indigo-500" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-black text-[var(--text-primary)] uppercase tracking-tight">
                                          {req.title}
                                        </p>
                                        <p className="text-[8px] text-[var(--text-secondary)] font-black uppercase tracking-widest mt-0.5 italic flex items-center gap-2">
                                          <span>{t("pmMisc.workspace.requirement")}: {req.allowed_format || "PDF"}</span>
                                          {req.due_date && (() => {
                                            const now = new Date();
                                            const due = new Date(req.due_date);
                                            const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
                                            const isOverdue = diffDays < 0;
                                            const isDueSoon = diffDays >= 0 && diffDays <= 3;
                                            return (
                                              <>
                                                <span>•</span>
                                                <span className={isOverdue ? "text-rose-500" : isDueSoon ? "text-amber-500" : "text-amber-500/60"}>
                                                  {t("pmMisc.workspace.due")}: {due.toLocaleDateString()}
                                                </span>
                                                {isOverdue && (
                                                  <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-rose-500/20 text-rose-400">{t("pmMisc.workspace.overdue")}</span>
                                                )}
                                                {isDueSoon && (
                                                  <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-amber-500/20 text-amber-400">{t("pmMisc.workspace.dueSoon")}</span>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {req.due_date && canEdit && (
                                        <button
                                          onClick={async () => {
                                            try {
                                              const res = await fetch("/api/pm/curriculum", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                  action: "send_reminder",
                                                  requirement_id: req.id,
                                                  program_id: id,
                                                }),
                                              });
                                              const data = await res.json();
                                              if (data.success) {
                                                const msg = data.sent > 0
                                                  ? t("pmMisc.workspace.reminderSentTo", { count: data.sent })
                                                  : t("pmMisc.workspace.reminderSent");
                                                notify(msg);
                                              } else {
                                                notify(t("pmMisc.workspace.reminderFailed"));
                                              }
                                            } catch (e) {
                                              notify(t("pmMisc.workspace.reminderError"));
                                            }
                                          }}
                                          className="text-[7px] font-black uppercase text-[var(--brand-orange)]/60 hover:text-[var(--brand-orange)] transition-all px-2 py-1 rounded border border-[var(--brand-orange)]/20 hover:border-[var(--brand-orange)]/50"
                                          title={t("pmMisc.workspace.sendReminderTitle")}
                                        >
                                          <Bell className="w-3 h-3 inline mr-1" />
                                          {t("pmMisc.workspace.remind")}
                                        </button>
                                      )}
                                      {canEdit && (
                                        <button className="text-rose-500/10 hover:text-rose-500 transition-all">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              {requirements.filter(
                                (r) => r.session_id === session.id,
                              ).length === 0 && (
                                  <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-primary)] rounded-3xl opacity-30">
                                    <Shield className="w-10 h-10 mb-2" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest">
                                      {t("pmMisc.workspace.noRequirementsSet")}
                                    </p>
                                  </div>
                                )}
                            </div>
                            <p className="text-[8px] font-bold text-slate-500/50 uppercase tracking-widest italic text-center px-6">
                              {t("pmMisc.workspace.curriculumEvidenceNote")}
                            </p>
                          </div>

                          {/* SEPARATOR */}
                          <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

                          {/* PHASE 3: RESOURCES (THE SUPPORT) */}
                          <div className="space-y-6">
                            <div className="flex items-center justify-between pb-3 border-b border-blue-500/20">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[9px] font-black text-blue-500 border border-blue-500/20 shadow-sm">
                                  3
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">
                                  {t("pmMisc.workspace.curriculumWeeklyResources")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {activeTab === "attendance" && (
            <div className="space-y-6 animate-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-primary)]">
                  {t("pmMisc.workspace.attendanceOverview")}
                </h3>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)]">
                {t("pmMisc.workspace.attendanceSelectWeek")}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sessions
                  .filter((s) => s.type === "session")
                  .sort((a, b) => (a.week_number || 0) - (b.week_number || 0))
                  .map((session) => (
                    <div
                      key={session.id}
                      className="card border border-[var(--border-primary)] hover:border-indigo-500/30 transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedSessionForAttendance(session);
                        setShowAttendanceModal(true);
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-lg font-black text-indigo-400">
                          {session.week_number || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                            {session.title}
                          </p>
                          <p className="text-[8px] text-[var(--text-secondary)] uppercase tracking-wider">
                            {t("pmMisc.workspace.week")} {session.week_number}
                          </p>
                        </div>
                      </div>
                      {session.scheduled_date && (
                        <p className="text-[9px] text-[var(--text-secondary)] mb-2">
                          {new Date(session.scheduled_date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                      <button
                        className="w-full py-2 rounded-lg bg-indigo-500/10 text-indigo-400 text-[9px] font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all"
                      >
                        {t("pmMisc.workspace.openAttendance")}
                      </button>
                    </div>
                  ))}
                {sessions.filter((s) => s.type === "session").length === 0 && (
                  <div className="col-span-3 py-12 text-center">
                    <p className="text-[11px] text-slate-500">{t("pmMisc.workspace.noSessionsYet")}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "config" && (
            <div className="space-y-8 animate-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  {/* STRATEGIC MATERIALS (PDFs) — MOVED TO TOP FOR VISIBILITY */}
                  <div className="space-y-6 mb-8">
                    <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-500" />
                      {t("pmMisc.workspace.configAssignedMaterials")}
                    </h3>
                    <div className="card space-y-4">
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                        {t("pmMisc.workspace.configAssignedAssets")}
                      </p>
                      <div className="grid grid-cols-1 gap-3">
                        {(() => {
                          let materials = [];
                          const raw = program?.materials;
                          const kbAssets = program?.knowledge_assets || [];

                          if (raw) {
                            if (Array.isArray(raw))
                              materials = raw.filter(
                                (i) => i && i !== "[]" && i !== "",
                              );
                            else if (typeof raw === "string") {
                              if (raw.startsWith("[") || raw.startsWith("{")) {
                                try {
                                  let parsed = JSON.parse(raw);
                                  if (typeof parsed === "string")
                                    parsed = JSON.parse(parsed);
                                  materials = Array.isArray(parsed)
                                    ? parsed.filter(
                                      (i) => i && i !== "[]" && i !== "",
                                    )
                                    : [parsed];
                                } catch (e) {
                                  materials = raw === "[]" ? [] : [raw];
                                }
                              } else {
                                materials =
                                  raw === "" || raw === "[]" ? [] : [raw];
                              }
                            }
                          }

                          // Merge with Knowledge Base Assets with safe mapping
                          const allMaterials = [
                            ...materials.map((m) => {
                              let item = m;
                              // Handle stringified JSON inside array items
                              if (typeof item === "string") {
                                try {
                                  let p = JSON.parse(item);
                                  if (typeof p === "string") p = JSON.parse(p);
                                  if (Array.isArray(p)) item = p[0];
                                  else item = p;
                                } catch (e) { }
                              }
                              if (Array.isArray(item)) item = item[0];
                              if (item && typeof item === "object") {
                                return {
                                  name:
                                    item.name ||
                                    item.NAME ||
                                    item.title ||
                                    item.TITLE ||
                                    t("pmMisc.workspace.programDocument"),
                                  url:
                                    item.url ||
                                    item.URL ||
                                    item.path ||
                                    item.PATH ||
                                    "",
                                  source: "curriculum",
                                };
                              }
                              if (typeof m === "string" && m.trim())
                                return {
                                  url: m,
                                  name: m.split("/").pop(),
                                  source: "curriculum",
                                };
                              return null;
                            }),
                            ...kbAssets.map((a) => {
                              if (typeof a === "object" && a !== null)
                                return { ...a, source: "knowledge" };
                              if (typeof a === "string" && a.trim())
                                return {
                                  url: a,
                                  name: a.split("/").pop(),
                                  source: "knowledge",
                                };
                              return null;
                            }),
                          ].filter(
                            (item) =>
                              item && (item.name || item.url || item.path),
                          );

                          if (allMaterials.length === 0) {
                            return (
                              <p className="text-xs italic text-[var(--text-secondary)] opacity-40 p-4 border border-dashed border-[var(--border-primary)] rounded-xl text-center">
                                {t("pmMisc.workspace.noMaterialsAnchored")}
                              </p>
                            );
                          }

                          return allMaterials.map((file, idx) => {
                            const url =
                              typeof file === "object"
                                ? file.url || file.URL || file.path || ""
                                : typeof file === "string"
                                  ? file
                                  : "";
                            const rawName =
                              typeof file === "object"
                                ? file.name ||
                                file.NAME ||
                                file.title ||
                                file.TITLE ||
                                (typeof (file.url || file.URL) === "string"
                                  ? (file.url || file.URL).split("/").pop()
                                  : t("pmMisc.workspace.programDocument"))
                                : typeof file === "string"
                                  ? file.split("/").pop()
                                  : t("pmMisc.workspace.programDocument");
                            const name = rawName
                              .replace(/\.[^.]+$/, "") // strip extension (.pdf, .docx…)
                              .replace(/[_\-]+/g, " ") // underscores/hyphens → spaces
                              .replace(/\s+/g, " ") // collapse extra spaces
                              .trim()
                              .toLowerCase()
                              .replace(/\b\w/g, (c) => c.toUpperCase()); // Title Case
                            const isKB = file.source === "knowledge";

                            // Items without valid URL will still show name, OPEN will use in-app viewer

                            return (
                              <div
                                key={idx}
                                className={`w-full flex items-center justify-between p-4 bg-tertiary rounded-xl border transition-all group text-left ${isKB ? "border-emerald-500/30 hover:border-emerald-500" : "border-[var(--border-primary)] hover:border-blue-500/50"}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`p-2 rounded-lg ${isKB ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"}`}
                                  >
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-xs uppercase tracking-tight truncate max-w-[200px] block">
                                      {name}
                                    </span>
                                    <span
                                      className={`text-[8px] font-black uppercase tracking-widest ${isKB ? "text-emerald-500" : "text-blue-500"}`}
                                    >
                                      {isKB
                                        ? t("pmMisc.workspace.knowledgeAsset")
                                        : t("pmMisc.workspace.programMaterial")}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setActivePDF({ url: url || "#", name });
                                  }}
                                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${isKB ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black border border-emerald-500/20" : "bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-black border border-blue-500/20"}`}
                                >
                                  {t("pmMisc.workspace.open")}
                                </button>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[var(--brand-orange)]" />
                    {t("pmMisc.workspace.configProgramIdentity")}
                  </h3>
                  <div className="card space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.programName")}
                      </label>
                      <input
                        ref={configNameRef}
                        type="text"
                        defaultValue={program?.name}
                        disabled={user.role === "program_manager"}
                        className={`w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold ${user.role === "program_manager" ? "opacity-50 cursor-not-allowed" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.conceptNote")}
                      </label>
                      <textarea
                        ref={configDescRef}
                        rows="4"
                        defaultValue={program?.description}
                        className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("pmMisc.workspace.durationWeeks")}
                        </label>
                        <input
                          ref={configWeeksRef}
                          type="number"
                          defaultValue={program?.duration_weeks}
                          className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("pmMisc.workspace.operationalStatus")}
                        </label>
                        <select
                          ref={configStatusRef}
                          defaultValue={program?.status}
                          className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold"
                        >
                          <option value="active">{t("pmMisc.workspace.programStatusActive")}</option>
                          <option value="archived">{t("pmMisc.workspace.programStatusArchived")}</option>
                          <option value="draft">{t("pmMisc.workspace.programStatusDraft")}</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-purple-500 flex items-center gap-2">
                          <Shield className="w-3 h-3 text-white" /> {t("pmMisc.workspace.gradingMode")}
                        </label>
                        <select
                          ref={configGradingRef}
                          defaultValue={program?.grading_mode || "graded"}
                          className="w-full bg-primary border border-purple-500/30 rounded-lg px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all font-bold"
                        >
                          <option value="graded">
                            {t("pmMisc.workspace.gradingGraded")}
                          </option>
                          <option value="review">{t("pmMisc.workspace.gradingReviewOnly")}</option>
                          <option value="followup">
                            {t("pmMisc.workspace.gradingFollowup")}
                          </option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-white" />{" "}
                          {t("pmMisc.workspace.projectStartDate")}
                        </label>
                        <input
                          ref={configStartRef}
                          type="date"
                          defaultValue={
                            program?.start_date
                              ? new Date(program.start_date)
                                .toISOString()
                                .split("T")[0]
                              : ""
                          }
                          className="w-full bg-primary border border-emerald-500/30 rounded-lg px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-white" />{" "}
                          {t("pmMisc.workspace.projectFinishDate")}
                        </label>
                        <input
                          ref={configEndRef}
                          type="date"
                          defaultValue={
                            program?.end_date
                              ? new Date(program.end_date)
                                .toISOString()
                                .split("T")[0]
                              : ""
                          }
                          className="w-full bg-primary border border-rose-500/30 rounded-lg px-4 py-3 text-sm focus:border-rose-500 outline-none transition-all font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 mt-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                        {t("pmMisc.workspace.programManager")}
                      </label>
                      <div className="w-full bg-primary/50 border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--brand-orange)] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4" />
                          <span className="uppercase">
                            {program?.pm_name || t("pmMisc.workspace.notAssigned")}
                          </span>
                        </div>
                        <Shield className="w-4 h-4 opacity-30" />
                      </div>
                    </div>
                    <button
                      onClick={saveConfig}
                      disabled={isSaving}
                      className="btn btn-primary w-full py-4 mt-4 gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {isSaving ? t("pmMisc.workspace.saving") : t("pmMisc.workspace.syncGlobalSettings")}
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-500" />
                    {t("pmMisc.workspace.configStrategicKpis")}
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch(
                            `/api/kpi-progress?program_id=${id}`,
                          );
                          const data = await res.json();
                          if (data.success) {
                            notify(t("pmMisc.workspace.kpiRecalculated"));
                            fetchProgramData(true);
                          }
                        } catch (_) {
                          notify(t("pmMisc.workspace.recalculationFailed"), "error");
                        }
                      }}
                      className="ml-auto text-[8px] font-black text-purple-400 uppercase hover:underline flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-purple-500/10 transition-all"
                    >
                      <RefreshCw className="w-3 h-3" /> {t("pmMisc.workspace.recalculate")}
                    </button>
                  </h3>
                  <div className="card space-y-4">
                    {/* READ-ONLY KNOWLEDGE BASE FOR PM */}
                    {program?.note_title && (
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-3 mb-6">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-emerald-500" />
                          <h4 className="text-[11px] font-black uppercase text-white tracking-tight">
                            {program.note_title}
                          </h4>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                          {program.note_description}
                        </p>
                        <div className="space-y-2 pt-2 border-t border-emerald-500/10">
                          {program.knowledge_assets?.map((asset, idx) => (
                            <button
                              key={idx}
                              onClick={() =>
                                setActivePDF({
                                  url: asset.url,
                                  name: asset.name,
                                })
                              }
                              className="w-full flex items-center justify-between p-2 hover:bg-emerald-500/10 rounded-lg transition-all group"
                            >
                              <span className="text-[9px] font-bold text-slate-300 uppercase truncate">
                                {asset.name}
                              </span>
                              <ExternalLink className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {kpis.map((kpi, kpiIdx) => {
                        const progPct = kpi.progress || 0;
                        return (
                          <div
                            key={kpi.id}
                            className="card !p-4 hover:border-[var(--brand-orange)]/30 transition-all group"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                                {t("pmMisc.workspace.kpi")} {kpiIdx + 1}
                              </span>
                              <span className="text-sm font-black text-[var(--brand-orange)]">
                                {progPct}%
                              </span>
                            </div>
                            <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-tight mb-3 group-hover:text-[var(--brand-orange)] transition-colors">
                              {kpi.title}
                            </p>
                            <div className="w-full h-2 bg-[var(--border-primary)]/20 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[var(--brand-orange)] to-orange-400 rounded-full transition-all duration-700"
                                style={{ width: `${progPct}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[7px] font-bold text-slate-500">
                                {t("pmMisc.workspace.weight")}: {kpi.weight || 0}%
                              </span>
                              {kpi.linkedSessions > 0 && (
                                <span className="text-[7px] font-bold text-slate-500">
                                  {kpi.completedSessions}/{kpi.linkedSessions}{" "}
                                  {t("pmMisc.workspace.sessionsLower")}
                                </span>
                              )}
                              {kpi.linkedDocs > 0 && (
                                <span className="text-[7px] font-bold text-slate-500">
                                  {kpi.completedDocs}/{kpi.linkedDocs} {t("pmMisc.workspace.docsLower")}
                                </span>
                              )}
                              {kpi.linkedSessions === 0 &&
                                kpi.linkedDocs === 0 && (
                                  <span className="text-[7px] font-bold text-slate-600 italic">
                                    {t("pmMisc.workspace.noLinkedItems")}
                                  </span>
                                )}
                            </div>
                          </div>
                        );
                      })}
                      {kpis.length === 0 && (
                        <div className="col-span-full p-8 text-center">
                          <p className="text-[10px] text-[var(--text-secondary)] italic">
                            {t("pmMisc.workspace.noKpisConfigured")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="space-y-6">
              {/* Export Bar */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] mr-2">{t("pmMisc.workspace.exportLabel")}</span>
                {[
                  { label: t("pmMisc.workspace.exportParticipantsCsv"), type: "participants", format: "csv" },
                  { label: t("pmMisc.workspace.exportParticipantsXlsx"), type: "participants", format: "xlsx" },
                  { label: t("pmMisc.workspace.exportAttendanceCsv"), type: "attendance", format: "csv" },
                  { label: t("pmMisc.workspace.exportSubmissionsCsv"), type: "submissions", format: "csv" },
                  { label: t("pmMisc.workspace.exportTeamsCsv"), type: "teams", format: "csv" },
                  { label: t("pmMisc.workspace.exportCalendarIcal"), type: "ical", format: "ical" },
                  { label: t("pmMisc.workspace.exportParticipantsPdf"), type: "participants", format: "pdf" },
                ].map(({ label, type, format }) => (
                  <button
                    key={`${type}-${format}`}
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/pm/export?type=${type}&program_id=${id}&format=${format}`, {
                          credentials: "include",
                        });
                        if (!res.ok) throw new Error("Export failed");
                        if (format === "pdf") {
                          const { rows: data, filename } = await res.json();
                          const { default: jsPDF } = await import("jspdf");
                          const doc = new jsPDF({ orientation: "landscape" });
                          doc.setFontSize(12);
                          doc.text(`${type.toUpperCase()} - Talent for Startups`, 10, 10);
                          if (data && data.length > 0) {
                            const headers = Object.keys(data[0]);
                            let y = 20;
                            doc.setFontSize(7);
                            // Header row
                            headers.forEach((h, i) => doc.text(String(h), 10 + i * 35, y));
                            y += 5;
                            // Data rows (max 40 rows per page)
                            data.slice(0, 80).forEach((row, ri) => {
                              if (y > 180) { doc.addPage(); y = 15; }
                              headers.forEach((h, i) => {
                                const val = String(row[h] ?? "").substring(0, 20);
                                doc.text(val, 10 + i * 35, y);
                              });
                              y += 4;
                            });
                          }
                          doc.save(filename);
                        } else {
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          const ext = format === "xlsx" ? "xlsx" : "csv";
                          a.href = url;
                          a.download = `${type}-${id}.${ext}`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }
                        notify(t("pmMisc.workspace.exported", { label }));
                      } catch (e) {
                        notify(t("pmMisc.workspace.exportFailed"), "error");
                      }
                    }}
                    className={`px-3 py-1.5 text-[8px] font-black uppercase rounded-lg border transition-all ${
                      format === "xlsx"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                        : format === "pdf"
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                          : "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] border-[var(--brand-orange)]/20 hover:bg-[var(--brand-orange)]/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  {t("pmMisc.workspace.reportsWeeklyFeed")}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                    {t("pmMisc.workspace.totalSignals")}
                  </span>
                  <span className="text-sm font-black">{reports.length}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {reports.map((report, i) => (
                  <div
                    key={report.id || i}
                    className="card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)] transition-all"
                  >
                    <div className="p-4 bg-tertiary flex justify-between items-center border-b border-[var(--border-primary)]">
                      <div className="flex items-center gap-4">
                        <div className="px-3 py-1 bg-[var(--brand-orange)] text-white text-[10px] font-black rounded uppercase">
                          Wk{report.week_number}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)]">
                          {t("pmMisc.workspace.submissionBy", { name: report.staff_name || report.teacher_name || t("pmMisc.workspace.staffMember") })}
                        </span>
                      </div>
                      <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] mb-1">
                            {t("pmMisc.workspace.reportChallenges")}
                          </p>
                          <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                            {report.challenges || t("pmMisc.workspace.noDataReported")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1">
                            {t("pmMisc.workspace.reportHighlights")}
                          </p>
                          <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                            {report.highlights || t("pmMisc.workspace.noDataReported")}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1">
                            {t("pmMisc.workspace.reportNextSteps")}
                          </p>
                          <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                            {report.planned_adjustments || report.next_steps || t("pmMisc.workspace.noDataReported")}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="p-3 bg-primary rounded-lg border border-[var(--border-primary)]">
                            <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase">
                              {t("pmMisc.workspace.attendance")}
                            </p>
                            <p className="text-sm font-black">
                              {report.attendance_count || 0}
                            </p>
                          </div>
                          <div className="p-3 bg-primary rounded-lg border border-[var(--border-primary)]">
                            <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase">
                              {t("pmMisc.workspace.sessions")}
                            </p>
                            <p className="text-sm font-black">
                              {report.sessions_completed || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {reports.length === 0 && (
                  <div className="py-20 text-center card border-dashed opacity-40">
                    <BarChart3 className="w-10 h-10 mx-auto mb-4 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest">
                      {t("pmMisc.workspace.awaitingReports")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "submissions" && (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("pmMisc.workspace.tableParticipant")}</th>
                    <th>{t("pmMisc.workspace.tableDeliverable")}</th>
                    <th>{t("pmMisc.workspace.tableDate")}</th>
                    <th>{t("pmMisc.workspace.tableStatus")}</th>
                    <th className="text-right">{t("pmMisc.workspace.tableAction")}</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-black text-[var(--text-primary)]">
                            {sub.participant_name || t("pmMisc.workspace.na")}
                          </span>
                          <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">
                            {sub.group_name || t("pmMisc.workspace.individual")}
                          </span>
                        </div>
                      </td>
                      <td>{sub.deliverable_title}</td>
                      <td className="text-[10px] opacity-60 font-bold">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <span
                          className={`px-2 py-1 rounded text-[9px] font-black uppercase ${sub.status === "approved" ? "bg-emerald-500/10 text-emerald-500" : "bg-orange-500/10 text-orange-500"}`}
                        >
                          {{
                            approved: t("pmMisc.workspace.submissionStatusApproved"),
                            pending: t("pmMisc.workspace.submissionStatusPending"),
                            submitted: t("pmMisc.workspace.submissionStatusSubmitted"),
                            rejected: t("pmMisc.workspace.submissionStatusRejected"),
                            revision_requested: t("pmMisc.workspace.submissionStatusRevision"),
                            pending_followup: t("pmMisc.workspace.submissionStatusFollowup"),
                          }[sub.status] || sub.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => {
                            setSelectedSubmission(sub);
                            setReviewScore(sub.score || 0);
                            setShowReviewModal(true);
                          }}
                          className="text-[var(--brand-blue)] text-[10px] font-black uppercase italic"
                        >
                          {t("pmMisc.workspace.review")}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {submissions.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="py-20 text-center opacity-30 italic"
                      >
                        {t("pmMisc.workspace.noSubmissions")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "facilitators" && <FacilitatorsPanel programId={id} />}
        </div>

        {/* PDF VIEWER MODAL */}
        {activePDF && (
          <div
            className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in"
            onClick={() => setActivePDF(null)}
          >
            <div
              className="card w-full max-w-5xl h-[90vh] flex flex-col space-y-4 shadow-2xl border-[var(--border-primary)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase text-[var(--text-primary)]">
                      {activePDF.name}
                    </h3>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                      {t("pmMisc.workspace.documentPreview")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={activePDF.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary !py-2 text-[10px] gap-2"
                  >
                    <ExternalLink className="w-4 h-4" /> {t("pmMisc.workspace.openInNewTab")}
                  </a>
                  <button
                    onClick={() => setActivePDF(null)}
                    className="btn btn-secondary !py-2 hover:bg-rose-500/10 hover:text-rose-500 border-none"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-tertiary rounded-xl overflow-hidden border border-[var(--border-primary)] relative">
                {!activePDF.url || activePDF.url === "#" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 opacity-50">
                    <FileText className="w-16 h-16 mb-4 text-[var(--text-secondary)] opacity-20" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.workspace.noDocumentUrl")}
                    </h3>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-2 max-w-sm leading-relaxed">
                      {t("pmMisc.workspace.noDocumentUrlDesc")}
                    </p>
                  </div>
                ) : (
                  <iframe
                    src={`${activePDF.url}#toolbar=0`}
                    className="w-full h-full"
                    title={t("pmMisc.workspace.pdfViewer")}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* TOAST */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-[500] px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-widest border ${toast.type === "error"
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
          >
            {toast.msg}
          </div>
        )}

        {/* DEPLOY STUDENT GROUP MODAL */}
        {showTeamModal && (
          <div
            className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
            onClick={() => setShowTeamModal(false)}
          >
            <div
              className="card w-full max-w-sm space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h3
                    className="text-base font-black uppercase tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {t("pmMisc.workspace.teamModalTitle")}
                  </h3>
                  <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                    {t("pmMisc.workspace.teamModalDesc")}
                  </p>
                </div>
                <button onClick={() => setShowTeamModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex bg-primary p-1 rounded-xl border border-[var(--border-primary)]">
                  <button
                    onClick={() => setTeamAssignmentMode("new")}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${teamAssignmentMode === "new" ? "bg-[var(--brand-orange)] text-black shadow-lg shadow-orange-500/20" : "text-[var(--text-secondary)] opacity-50"}`}
                  >
                    {t("pmMisc.workspace.createNew")}
                  </button>
                  <button
                    onClick={() => setTeamAssignmentMode("existing")}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${teamAssignmentMode === "existing" ? "bg-[var(--brand-orange)] text-black shadow-lg shadow-orange-500/20" : "text-[var(--text-secondary)] opacity-50"}`}
                  >
                    {t("pmMisc.workspace.addToExisting")}
                  </button>
                </div>

                {teamAssignmentMode === "new" ? (
                  <div className="space-y-1">
                    <label
                      className="text-[10px] font-black uppercase tracking-widest"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {t("pmMisc.workspace.teamInternalName")}
                    </label>
                    <input
                      value={newTeam.name}
                      onChange={(e) =>
                        setNewTeam((p) => ({ ...p, name: e.target.value }))
                      }
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                      placeholder={t("pmMisc.workspace.teamNamePlaceholder")}
                    />
                    <p className="text-[8px] font-bold text-[var(--brand-orange)] uppercase mt-1">
                      {t("pmMisc.workspace.teamNoteAutoLink")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label
                      className="text-[10px] font-black uppercase tracking-widest"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {t("pmMisc.workspace.selectTargetGroup")}
                    </label>
                    <select
                      value={selectedExistingTeamId}
                      onChange={(e) =>
                        setSelectedExistingTeamId(e.target.value)
                      }
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="">{t("pmMisc.workspace.selectExistingTeam")}</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name.toUpperCase()} ({t("pmMisc.workspace.group")}: {t.group_name})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("pmMisc.workspace.assignGroupLead")}
                  </label>
                  <select
                    value={newTeam.leader_id}
                    onChange={(e) =>
                      setNewTeam((p) => ({ ...p, leader_id: e.target.value }))
                    }
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="">{t("pmMisc.workspace.selectLead")}</option>
                    {participants
                      .filter((p) => newTeam.member_ids.includes(p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("pmMisc.workspace.assignOversight")}
                  </label>
                  <select
                    value={newTeam.staff_id}
                    onChange={(e) => {
                      const staff = assignedStaff.find(
                        (s) => String(s.cid) === e.target.value,
                      );
                      setNewTeam((p) => ({
                        ...p,
                        staff_id: e.target.value,
                        handler_name: staff?.name || "",
                      }));
                    }}
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="">{t("pmMisc.workspace.noStaffAssignedOptional")}</option>
                    {assignedStaff.map((s) => (
                      <option key={s.cid} value={s.cid}>
                        {s.name} ({s.role === "teacher" ? t("pmMisc.workspace.instructor") : s.role}
                        )
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTeamModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  {t("pmMisc.workspace.cancel")}
                </button>
                 <button
                  onClick={deployTeam}
                  disabled={isSaving || (teamAssignmentMode === "new" && !newTeam.name.trim()) || (teamAssignmentMode === "existing" && !selectedExistingTeamId)}
                  className="flex-1 btn btn-primary"
                >
                  {isSaving ? t("pmMisc.workspace.initializing") : t("pmMisc.workspace.initializeGroup")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD SESSION MODAL */}
        {showSessionModal && (
          <div
            className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
            onClick={() => setShowSessionModal(false)}
          >
            <div
              className="card w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-4 border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-[var(--brand-orange)]" />
                  </div>
                  <div>
                    <h3
                      className="text-sm font-black uppercase tracking-tight"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {t("pmMisc.workspace.newSessionTitle")}
                    </h3>
                    <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">
                      {t("pmMisc.workspace.week")} {newSession.week_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSessionModal(false)}
                  className="p-2 hover:bg-[var(--surface-2)] rounded-lg transition-all"
                >
                  <X
                    className="w-4 h-4"
                    style={{ color: "var(--text-tertiary)" }}
                  />
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label
                    className="text-[9px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("pmMisc.workspace.sessionTitle")}
                  </label>
                  <input
                    value={newSession.title}
                    onChange={(e) =>
                      setNewSession((p) => ({ ...p, title: e.target.value }))
                    }
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold transition-all focus:border-[var(--brand-orange)]"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                    placeholder={t("pmMisc.workspace.sessionTitlePlaceholder")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {t("pmMisc.workspace.startDate")}
                    </label>
                    <input
                      type="date"
                      value={newSession.scheduled_date}
                      onChange={(e) =>
                        setNewSession((p) => ({
                          ...p,
                          scheduled_date: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {t("pmMisc.workspace.finishDate")}
                    </label>
                    <input
                      type="date"
                      value={newSession.end_date}
                      onChange={(e) =>
                        setNewSession((p) => ({
                          ...p,
                          end_date: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {t("pmMisc.workspace.startTime")}
                    </label>
                    <input
                      type="time"
                      value={newSession.start_time}
                      onChange={(e) =>
                        setNewSession((p) => ({
                          ...p,
                          start_time: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {t("pmMisc.workspace.endTime")}
                    </label>
                    <input
                      type="time"
                      value={newSession.end_time}
                      onChange={(e) =>
                        setNewSession((p) => ({
                          ...p,
                          end_time: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("pmMisc.workspace.assignTeachers")}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto p-1 custom-scrollbar">
                    {programTeamMembers.map((staff) => {
                      const isSelected = (
                        newSession.handler_ids || []
                      ).includes(String(staff.cid));
                      return (
                        <button
                          key={staff.cid}
                          type="button"
                          onClick={() => {
                            const ids = newSession.handler_ids || [];
                            const names = newSession.handler_names || [];
                            const cidStr = String(staff.cid);
                            if (ids.includes(cidStr)) {
                              const idx = ids.indexOf(cidStr);
                              setNewSession((p) => ({
                                ...p,
                                handler_ids: ids.filter((id) => id !== cidStr),
                                handler_names: names.filter(
                                  (_, i) => i !== idx,
                                ),
                              }));
                            } else {
                              setNewSession((p) => ({
                                ...p,
                                handler_ids: [...ids, cidStr],
                                handler_names: [...names, staff.name],
                              }));
                            }
                          }}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-bold transition-all text-left ${isSelected
                            ? "bg-[#FF6600]/10 border-[#FF6600] text-white"
                            : "bg-black/20 border-white/5 text-slate-400 hover:border-white/20"
                            }`}
                        >
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[7px]">
                            {staff.name?.charAt(0)}
                          </div>
                          <span className="truncate">{staff.name}</span>
                        </button>
                      );
                    })}
                    {programTeamMembers.length === 0 && (
                      <p className="text-[10px] text-slate-600 italic col-span-full px-2">
                        {t("pmMisc.workspace.noStaffAssignedHint")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("pmMisc.workspace.sessionNotes")}
                  </label>
                  <textarea
                    value={newSession.notes}
                    onChange={(e) =>
                      setNewSession((p) => ({
                        ...p,
                        notes: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold resize-none"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                    placeholder={t("pmMisc.workspace.sessionNotesPlaceholder")}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("pmMisc.workspace.extraCourseMaterials")}
                  </label>
                  {/* Material type selector */}
                  <div className="flex gap-1 bg-primary rounded-lg p-1 border border-[var(--border-primary)] w-fit">
                    {[
                      { id: "text", label: t("pmMisc.workspace.materialTypeText"), icon: FileText },
                      { id: "link", label: t("pmMisc.workspace.materialTypeLink"), icon: Plus },
                      { id: "upload", label: t("pmMisc.workspace.materialTypeFile"), icon: Paperclip },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setNewSessionMaterial({
                            type: opt.id,
                            content: "",
                            name: "",
                          })
                        }
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${newSessionMaterial.type === opt.id
                          ? "bg-[var(--brand-orange)] text-black"
                          : "text-slate-500 hover:text-white"
                          }`}
                      >
                        <opt.icon className="w-3 h-3" />
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Material input */}
                  <div className="flex gap-2">
                    {newSessionMaterial.type === "text" && (
                      <input
                        value={newSessionMaterial.content}
                        onChange={(e) =>
                          setNewSessionMaterial((p) => ({
                            ...p,
                            content: e.target.value,
                            name: "Text Note",
                          }))
                        }
                        placeholder={t("pmMisc.workspace.textNotePlaceholder")}
                        className="flex-1 rounded-lg px-4 py-3 text-sm outline-none font-bold"
                        style={{
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-primary)",
                          color: "var(--text-primary)",
                        }}
                      />
                    )}
                    {newSessionMaterial.type === "link" && (
                      <input
                        type="url"
                        value={newSessionMaterial.content}
                        onChange={(e) =>
                          setNewSessionMaterial((p) => ({
                            ...p,
                            content: e.target.value,
                            name:
                              e.target.value.split("/").pop() ||
                              "External Link",
                          }))
                        }
                        placeholder="https://..."
                        className="flex-1 rounded-lg px-4 py-3 text-sm outline-none font-bold"
                        style={{
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border-primary)",
                          color: "var(--text-primary)",
                        }}
                      />
                    )}
                    {newSessionMaterial.type === "upload" && (
                      <div className="flex-1 relative group">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file)
                              setNewSessionMaterial((p) => ({
                                ...p,
                                content: file.name,
                                name: file.name,
                              }));
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        />
                        <div
                          className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed text-sm font-bold"
                          style={{
                            background: "var(--bg-primary)",
                            borderColor: "var(--border-primary)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          <Paperclip className="w-4 h-4" />
                          {newSessionMaterial.content || t("pmMisc.workspace.clickToAttach")}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!newSessionMaterial.content.trim()) return;
                        setNewSession((p) => ({
                          ...p,
                          extra_materials: [
                            ...(p.extra_materials || []),
                            { ...newSessionMaterial },
                          ],
                        }));
                        setNewSessionMaterial({
                          type: "text",
                          content: "",
                          name: "",
                        });
                      }}
                      className="px-4 rounded-lg bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                    >
                      {t("pmMisc.workspace.add")}
                    </button>
                  </div>

                  {/* Added materials list */}
                  {(newSession.extra_materials || []).length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {(newSession.extra_materials || []).map((mat, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg"
                          style={{
                            background: "var(--bg-tertiary)",
                            border: "1px solid var(--border-primary)",
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {mat.type === "text" && (
                              <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                            )}
                            {mat.type === "link" && (
                              <Plus className="w-3 h-3 text-emerald-500 shrink-0" />
                            )}
                            {mat.type === "upload" && (
                              <Paperclip className="w-3 h-3 text-[#FF6600] shrink-0" />
                            )}
                            <span className="text-[10px] font-bold truncate text-[var(--text-primary)]">
                              {mat.name || mat.content}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setNewSession((p) => ({
                                ...p,
                                extra_materials: (
                                  p.extra_materials || []
                                ).filter((_, i) => i !== idx),
                              }))
                            }
                            className="text-rose-500 hover:scale-110 transition-all shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                    <Target className="w-3 h-3 text-[#FF6600]" /> {t("pmMisc.workspace.linkStrategicKpis")}
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-[120px] overflow-y-auto p-1 custom-scrollbar text-left">
                    {kpis.map((kpi) => (
                      <button
                        key={kpi.id}
                        onClick={() => toggleKpi("session", kpi.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${(newSession.kpi_ids || []).includes(kpi.id)
                          ? "bg-[#FF6600]/10 border-[#FF6600] text-white"
                          : "bg-black/20 border-white/5 text-slate-500 hover:border-white/20"
                          }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-tight">
                          {kpi.title}
                        </span>
                        {(newSession.kpi_ids || []).includes(kpi.id) && (
                          <CheckCircle2 className="w-3 h-3 text-[#FF6600]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 mt-4 pt-4 border-t border-[var(--border-primary)]">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                    <FileText className="w-3 h-3 text-indigo-400" /> {t("pmMisc.workspace.deliverablesRequirements")}
                  </label>
                  
                  {/* List of added requirements */}
                  {(newSession.requirements || []).length > 0 && (
                    <div className="space-y-2 mb-3">
                      {(newSession.requirements || []).map((req, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px]">
                          <div>
                            <span className="font-bold text-indigo-400 uppercase">{req.title}</span>
                            <span className="text-slate-400 ml-2">({req.allowed_format})</span>
                          </div>
                          <button type="button" onClick={() => setNewSession(p => ({ ...p, requirements: p.requirements.filter((_, i) => i !== idx) }))} className="text-rose-500 hover:scale-110">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline Form to add a new requirement */}
                  <div className="p-3 bg-[var(--surface-1)] rounded-xl border border-[var(--border-primary)] space-y-3">
                    <input
                      value={newRequirement.title}
                      onChange={(e) => setNewRequirement(p => ({ ...p, title: e.target.value }))}
                      placeholder={t("pmMisc.workspace.requirementTitlePlaceholder")}
                      className="w-full rounded-lg px-3 py-2 text-[11px] font-bold outline-none transition-colors"
                      style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newRequirement.allowed_format}
                        onChange={(e) => setNewRequirement(p => ({ ...p, allowed_format: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-[10px] font-bold outline-none transition-colors"
                        style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                      >
                        <option value="pdf">{t("pmMisc.workspace.formatPdf")}</option>
                        <option value="image">{t("pmMisc.workspace.formatImage")}</option>
                        <option value="link">{t("pmMisc.workspace.formatLink")}</option>
                        <option value="video">{t("pmMisc.workspace.formatVideo")}</option>
                      </select>
                      <input
                        type="date"
                        value={newRequirement.due_date || ""}
                        onChange={(e) => setNewRequirement(p => ({ ...p, due_date: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-[10px] font-bold outline-none transition-colors"
                        style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newRequirement.assignee_type || "all"}
                        onChange={(e) => setNewRequirement(p => ({ ...p, assignee_type: e.target.value, assignee_id: "" }))}
                        className="w-full rounded-lg px-3 py-2 text-[10px] font-bold outline-none transition-colors"
                        style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                      >
                        <option value="all">{t("pmMisc.workspace.assigneeAll")}</option>
                        <option value="team">{t("pmMisc.workspace.assigneeTeam")}</option>
                        <option value="individual">{t("pmMisc.workspace.assigneeIndividual")}</option>
                      </select>
                      <div className="flex items-center text-[9px] text-slate-400 italic px-2">
                        * {t("pmMisc.workspace.evaluatedViaSessionKpis")}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!newRequirement.title.trim()}
                      onClick={() => {
                        setNewSession(p => ({ ...p, requirements: [...(p.requirements || []), { ...newRequirement, kpi_ids: p.kpi_ids || [] }] }));
                        setNewRequirement({ title: "", description: "", allowed_format: "pdf", kpi_ids: [], due_date: "", assignee_type: "all", assignee_id: "" });
                      }}
                      className="w-full py-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500/30 disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-3 h-3 inline mr-1" /> {t("pmMisc.workspace.addDeliverable")}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSessionModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  {t("pmMisc.workspace.cancel")}
                </button>
                <button
                  onClick={addSession}
                  disabled={isSaving || !newSession.title.trim() || (kpis.length > 0 && (!newSession.kpi_ids || newSession.kpi_ids.length === 0))}
                  className="flex-1 btn btn-primary"
                >
                  {isSaving ? t("pmMisc.workspace.creating") : t("pmMisc.workspace.createSession")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REVIEW & GRADE MODAL */}
        {showReviewModal && (
          <div
            className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
            onClick={() => setShowReviewModal(false)}
          >
            <div
              className="card w-full max-w-md space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h3
                  className="text-base font-black uppercase tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t("pmMisc.workspace.gradeSubmission")}
                </h3>
                <button onClick={() => setShowReviewModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-tertiary border border-[var(--border-primary)] rounded-xl space-y-2">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                  {t("pmMisc.workspace.tableParticipant")}
                </p>
                <p className="text-sm font-black text-[var(--text-primary)]">
                  {selectedSubmission?.participant_name || t("pmMisc.workspace.groupSubmission")}
                </p>
                <a
                  href={selectedSubmission?.file_url || selectedSubmission?.submission_url || selectedSubmission?.submission_link || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-black text-indigo-400 uppercase italic flex items-center gap-1 mt-2 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> {t("pmMisc.workspace.viewSourceMaterial")}
                </a>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("pmMisc.workspace.numericalGrade")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={reviewScore}
                    onChange={(e) => setReviewScore(e.target.value)}
                    className="w-full rounded-lg px-4 py-3 text-2xl outline-none font-black text-center text-[var(--brand-orange)]"
                    style={{
                      background: "var(--bg-primary)",
                      border: "2px solid var(--border-primary)",
                    }}
                    placeholder={t("pmMisc.workspace.gradeScorePlaceholder")}
                  />
                  <p className="text-[9px] font-bold text-slate-500 text-center uppercase mt-2">
                    {t("pmMisc.workspace.scoreSyncNote")}
                  </p>
                </div>
              </div>
              {!showFollowupFields ? (
                <>
                  <button
                    onClick={() => setShowFollowupFields(true)}
                    className="w-full py-2.5 rounded-xl border border-dashed border-indigo-400/40 text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-400/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-3.5 h-3.5" /> {t("pmMisc.workspace.scheduleFollowup")}
                  </button>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowReviewModal(false)}
                      className="flex-1 btn btn-secondary"
                    >
                      {t("pmMisc.workspace.cancel")}
                    </button>
                    <button
                      onClick={handleReviewSubmission}
                      disabled={isSaving || reviewScore === ""}
                      className="flex-1 btn btn-primary"
                    >
                      {isSaving ? t("pmMisc.workspace.grading") : t("pmMisc.workspace.approveAndGrade")}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4 pt-2 border-t border-[var(--border-primary)]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                    <Calendar className="w-3 h-3 inline mr-1" /> {t("pmMisc.workspace.scheduleFollowupMeeting")}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("pmMisc.workspace.dateRequired")}</label>
                      <input type="date" value={followupDate}
                        onChange={(e) => setFollowupDate(e.target.value)}
                        className="w-full rounded-lg px-3 py-2.5 text-xs outline-none font-bold"
                        style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("pmMisc.workspace.timeRequired")}</label>
                      <input type="time" value={followupTime}
                        onChange={(e) => setFollowupTime(e.target.value)}
                        className="w-full rounded-lg px-3 py-2.5 text-xs outline-none font-bold"
                        style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("pmMisc.workspace.durationMinutes")}</label>
                    <select value={followupDuration} onChange={(e) => setFollowupDuration(e.target.value)}
                      className="w-full rounded-lg px-3 py-2.5 text-xs outline-none font-bold"
                      style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    >
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">60 min</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("pmMisc.workspace.meetingLinkOptional")}</label>
                    <input type="url" value={followupMeetingLink}
                      onChange={(e) => setFollowupMeetingLink(e.target.value)}
                      placeholder="https://meet.google.com/..."
                      className="w-full rounded-lg px-3 py-2.5 text-xs outline-none font-bold"
                      style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("pmMisc.workspace.notesOptional")}</label>
                    <textarea value={followupNotes}
                      onChange={(e) => setFollowupNotes(e.target.value)}
                      placeholder={t("pmMisc.workspace.followupNotesPlaceholder")} rows={2}
                      className="w-full rounded-lg px-3 py-2.5 text-xs outline-none font-bold resize-none"
                      style={{ background: "var(--bg-primary)", border: "1px solid var(--border-primary)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { setShowFollowupFields(false); setFollowupDate(""); setFollowupTime(""); }}
                      className="flex-1 py-2.5 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all"
                    >
                      {t("pmMisc.workspace.back")}
                    </button>
                    <button onClick={handleScheduleFollowup}
                      disabled={isSaving || !followupDate || !followupTime}
                      className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                      {isSaving ? t("pmMisc.workspace.scheduling") : <><Calendar className="w-3 h-3" /> {t("pmMisc.workspace.confirmFollowup")}</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ASSIGN STAFF MODAL */}
        {showStaffModal && (
          <div
            className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
            onClick={() => setShowStaffModal(false)}
          >
            <div
              className="card w-full max-w-sm space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h3
                  className="text-base font-black uppercase tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t("pmMisc.workspace.assignPersonnel")}
                </h3>
                <button onClick={() => setShowStaffModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("pmMisc.workspace.selectStaffMember")}
                  </label>
                  <select
                    value={newStaff.staff_id}
                    onChange={(e) =>
                      setNewStaff((p) => ({ ...p, staff_id: e.target.value }))
                    }
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="">{t("pmMisc.workspace.selectMember")}</option>
                    {staffList
                      .filter((s) => s.role !== "super_admin")
                      .map((s) => (
                        <option key={s.cid} value={s.cid}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("pmMisc.workspace.assignedRole")}
                  </label>
                  <select
                    value={newStaff.role}
                    onChange={(e) =>
                      setNewStaff((p) => ({ ...p, role: e.target.value }))
                    }
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="staff">{t("pmMisc.workspace.roleStaffMember")}</option>
                    <option value="assistant">{t("pmMisc.workspace.roleAssistant")}</option>
                    <option value="evaluator">{t("pmMisc.workspace.roleEvaluator")}</option>
                    <option value="handler">{t("pmMisc.workspace.roleHandler")}</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowStaffModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  {t("pmMisc.workspace.cancel")}
                </button>
                <button
                  onClick={assignStaff}
                  disabled={isSaving || !newStaff.staff_id}
                  className="flex-1 btn btn-primary"
                >
                  {isSaving ? t("pmMisc.workspace.assigning") : t("pmMisc.workspace.assign")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DEFINE KPI MODAL */}
        {showKPIModal && (
          <div
            className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
            onClick={() => setShowKPIModal(false)}
          >
            <div
              className="card w-full max-w-sm space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h3
                  className="text-base font-black uppercase tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t("pmMisc.workspace.defineKpiTarget")}
                </h3>
                <button onClick={() => setShowKPIModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("pmMisc.workspace.kpiTitle")}
                  </label>
                  <input
                    value={newKPI.title}
                    onChange={(e) =>
                      setNewKPI((p) => ({ ...p, title: e.target.value }))
                    }
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                    placeholder={t("pmMisc.workspace.kpiTitlePlaceholder")}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowKPIModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  {t("pmMisc.workspace.cancel")}
                </button>
                <button
                  onClick={addKPI}
                  disabled={isSaving || !newKPI.title.trim()}
                  className="flex-1 btn btn-primary"
                >
                  {isSaving ? t("pmMisc.workspace.defining") : t("pmMisc.workspace.define")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ANCHOR REQUIREMENT MODAL */}
        {showRequirementModal && (
          <div
            className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
            onClick={() => setShowRequirementModal(false)}
          >
            <div
              className="card w-full max-w-sm space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h3
                  className="text-base font-black uppercase tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t("pmMisc.workspace.addRequirement")}
                </h3>
                <button onClick={() => setShowRequirementModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t("pmMisc.workspace.requirementTitle")}
                  </label>
                  <input
                    value={newRequirement.title}
                    onChange={(e) =>
                      setNewRequirement((p) => ({
                        ...p,
                        title: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                    placeholder={t("pmMisc.workspace.requirementTitleExample")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      className="text-[10px] font-black uppercase tracking-widest"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {t("pmMisc.workspace.allowedFormat")}
                    </label>
                    <select
                      value={newRequirement.allowed_format}
                      onChange={(e) =>
                        setNewRequirement((p) => ({
                          ...p,
                          allowed_format: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="pdf">{t("pmMisc.workspace.formatPdf")}</option>
                      <option value="image">{t("pmMisc.workspace.formatImage")}</option>
                      <option value="link">{t("pmMisc.workspace.formatLink")}</option>
                      <option value="video">{t("pmMisc.workspace.formatVideo")}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label
                      className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Calendar className="w-3 h-3" /> {t("pmMisc.workspace.dueDate")}
                    </label>
                    <input
                      type="date"
                      value={newRequirement.due_date || ""}
                      onChange={(e) =>
                        setNewRequirement((p) => ({
                          ...p,
                          due_date: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>

                {/* Grading — derived from linked KPIs */}
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-2">
                    <Target className="w-3 h-3 inline mr-1" /> {t("pmMisc.workspace.gradingFromKpis")}
                  </p>
                  {(() => {
                    const linked = kpis.filter(k => (newRequirement.kpi_ids || []).includes(k.id));
                    if (linked.length === 0) {
                      return <p className="text-[8px] text-slate-500 italic">{t("pmMisc.workspace.gradingKpiHint")}</p>;
                    }
                    const avgWeight = (linked.reduce((s, k) => s + (parseFloat(k.weight) || 0), 0) / linked.length).toFixed(1);
                    return <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div><span className="text-slate-500">{t("pmMisc.workspace.kpisLinked")}</span> <span className="font-bold text-purple-400">{linked.length}</span></div>
                      <div><span className="text-slate-500">{t("pmMisc.workspace.avgWeight")}</span> <span className="font-bold text-purple-400">{avgWeight}%</span></div>
                    </div>;
                  })()}
                </div>

                <div className="space-y-1">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <Users className="w-3 h-3" /> {t("pmMisc.workspace.assignTo")}
                  </label>
                  <select
                    value={newRequirement.assignee_type || "all"}
                    onChange={(e) =>
                      setNewRequirement((p) => ({
                        ...p,
                        assignee_type: e.target.value,
                        assignee_id: "",
                      }))
                    }
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="all">{t("pmMisc.workspace.assigneeAll")}</option>
                    <option value="team">{t("pmMisc.workspace.assigneeTeam")}</option>
                    <option value="individual">{t("pmMisc.workspace.assigneeIndividual")}</option>
                  </select>
                </div>

                {newRequirement.assignee_type === "team" && (
                  <div className="space-y-1">
                    <select
                      value={newRequirement.assignee_id || ""}
                      onChange={(e) =>
                        setNewRequirement((p) => ({
                          ...p,
                          assignee_id: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="">{t("pmMisc.workspace.selectTeam")}</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {newRequirement.assignee_type === "individual" && (
                  <div className="space-y-1">
                    <select
                      value={newRequirement.assignee_id || ""}
                      onChange={(e) =>
                        setNewRequirement((p) => ({
                          ...p,
                          assignee_id: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="">{t("pmMisc.workspace.selectParticipant")}</option>
                      {participants.slice(0, 50).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                    <Target className="w-3 h-3 text-[#FF6600]" /> {t("pmMisc.workspace.strategicImpact")}
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-[100px] overflow-y-auto p-1 custom-scrollbar text-left">
                    {kpis.map((kpi) => (
                      <button
                        key={kpi.id}
                        onClick={() => toggleKpi("requirement", kpi.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${(newRequirement.kpi_ids || []).includes(kpi.id)
                          ? "bg-[#FF6600]/10 border-[#FF6600] text-white"
                          : "bg-black/20 border-white/5 text-slate-500 hover:border-white/20"
                          }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-tight">
                          {kpi.title}
                        </span>
                        {(newRequirement.kpi_ids || []).includes(kpi.id) && (
                          <CheckCircle2 className="w-3 h-3 text-[#FF6600]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRequirementModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  {t("pmMisc.workspace.cancel")}
                </button>
                <div className="flex-1 flex flex-col gap-2">
                  <button
                    onClick={() => addRequirement(false)}
                    disabled={isSaving || !newRequirement.title.trim() || (newRequirement.kpi_ids || []).length === 0}
                    className="w-full btn btn-secondary text-[9px] py-2 border-dashed"
                  >
                    {isSaving ? t("pmMisc.workspace.saving") : t("pmMisc.workspace.saveAndAddAnother")}
                  </button>
                  <button
                    onClick={() => addRequirement(true)}
                    disabled={isSaving || !newRequirement.title.trim() || (newRequirement.kpi_ids || []).length === 0}
                    className="w-full btn btn-primary py-3"
                  >
                    {isSaving ? t("pmMisc.workspace.saving") : t("pmMisc.workspace.saveAndClose")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ATTENDANCE MODAL */}
        {showAttendanceModal && selectedSessionForAttendance && (
          <div
            className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
            onClick={() => setShowAttendanceModal(false)}
          >
            <div
              className="card w-full max-w-2xl space-y-6 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center">
                <h3
                  className="text-base font-black uppercase tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t("pmMisc.workspace.attendance")} — {selectedSessionForAttendance.title}
                </h3>
                <button onClick={() => setShowAttendanceModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {participants.filter(p => p.status !== 'archived').map((p) => {
                  const status = attendanceRecords[p.id] || "present";
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-4 bg-primary rounded-xl border border-[var(--border-primary)]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[10px] font-black uppercase">
                          {p.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[var(--text-primary)]">
                            {p.name}
                          </p>
                          <p className="text-[9px] text-[var(--text-secondary)]">
                            {p.email}
                          </p>
                        </div>
                      </div>
                      <select
                        value={status}
                        onChange={(e) =>
                          setAttendanceRecords((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border outline-none ${status === "present"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          : status === "absent"
                            ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                            : status === "excused"
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                              : "bg-blue-500/10 text-blue-500 border-blue-500/30"
                          }`}
                      >
                        <option value="present">{t("pmMisc.workspace.attendancePresent")}</option>
                        <option value="absent">{t("pmMisc.workspace.attendanceAbsent")}</option>
                        <option value="excused">{t("pmMisc.workspace.attendanceExcused")}</option>
                        <option value="late">{t("pmMisc.workspace.attendanceLate")}</option>
                      </select>
                    </div>
                  );
                })}
                {participants.length === 0 && (
                  <p className="text-center text-[var(--text-secondary)] italic py-8">
                    {t("pmMisc.workspace.noParticipantsEnrolled")}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  {t("pmMisc.workspace.cancel")}
                </button>
                <button
                  onClick={async () => {
                    if (!selectedSessionForAttendance) return;
                    setIsSaving(true);
                    try {
                      const today = new Date().toISOString().split("T")[0];
                      const records = participants.map((p) => {
                        const pid = p.user_id || p.cid || p.id;
                        return {
                          session_id: selectedSessionForAttendance.id,
                          program_id: id,
                          participant_id: pid,
                          status: attendanceRecords[pid] || "present",
                          date: today,
                        };
                      });
                      const res = await fetch("/api/attendance", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(records),
                      });
                      const data = await res.json();
                      if (!data.success) throw new Error(t((data.error || "Unknown error") || "") || (data.error || "Unknown error"));
                      notify(t("pmMisc.workspace.attendanceRecorded", { count: data.upserted }));
                      setShowAttendanceModal(false);
                      setAttendanceRecords({});
                    } catch (e) {
                      notify(t("pmMisc.workspace.attendanceSaveFailed"), "error");
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  disabled={isSaving}
                  className="flex-1 btn btn-primary"
                >
                  {isSaving ? t("pmMisc.workspace.saving") : t("pmMisc.workspace.saveAttendance")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PM WEEKLY REPORT MODAL — Structured Reporting Flow */}
        {showPMReportModal && (
          <div
            className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
            onClick={() => setShowPMReportModal(false)}
          >
            <div
              className="card w-full max-w-lg space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center sticky top-0 bg-secondary z-10 pb-4 border-b border-[var(--border-primary)]">
                <h3
                  className="text-base font-black uppercase tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t("pmMisc.workspace.reportWeeklyReport")}
                </h3>
                <button onClick={() => setShowPMReportModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-8">
                {/* ────────── SECTION 1: WEEKLY OVERVIEW ────────── */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-[var(--brand-orange)]/20">
                    <div className="w-5 h-5 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[8px] font-black text-[var(--brand-orange)] border border-[var(--brand-orange)]/20">
                      1
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--brand-orange)]">
                      {t("pmMisc.workspace.reportWeeklyOverview")}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Week Status — Required */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.weekStatus")} <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          "successful",
                          "partially_completed",
                          "not_completed",
                        ].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setNewPMReport((p) => ({
                                ...p,
                                week_status: opt,
                              }))
                            }
                            className={`px-4 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${newPMReport.week_status === opt
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                              : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                              }`}
                          >
                            {{
                              successful: t("pmMisc.workspace.weekStatusSuccessful"),
                              partially_completed: t("pmMisc.workspace.weekStatusPartiallyCompleted"),
                              not_completed: t("pmMisc.workspace.weekStatusNotCompleted"),
                            }[opt] || opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Overall Week Rating — Required */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.overallWeekRating")}{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {["excellent", "good", "fair", "poor"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setNewPMReport((p) => ({
                                ...p,
                                week_rating: opt,
                              }))
                            }
                            className={`px-4 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${newPMReport.week_rating === opt
                              ? opt === "excellent"
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                : opt === "good"
                                  ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                                  : opt === "fair"
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                    : "bg-rose-500/10 border-rose-500/30 text-rose-500"
                              : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                              }`}
                          >
                            {{
                              excellent: t("pmMisc.workspace.ratingExcellent"),
                              good: t("pmMisc.workspace.ratingGood"),
                              fair: t("pmMisc.workspace.ratingFair"),
                              poor: t("pmMisc.workspace.ratingPoor"),
                            }[opt] || opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Main Topic — Required */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.mainTopic")}{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newPMReport.main_topic}
                        onChange={(e) =>
                          setNewPMReport((p) => ({
                            ...p,
                            main_topic: e.target.value,
                          }))
                        }
                        placeholder={t("pmMisc.workspace.mainTopicPlaceholder")}
                        className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-[var(--brand-orange)] transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* ────────── ASSIGNMENT TRACKING ────────── */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-violet-500/20">
                    <div className="w-5 h-5 rounded-full bg-violet-500/10 flex items-center justify-center text-[8px] font-black text-violet-500 border border-violet-500/20">
                      +
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-500">
                      {t("pmMisc.workspace.assignmentTracking")}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Was An Assignment Given? — Required */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.assignmentGiven")}{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setNewPMReport((p) => ({
                              ...p,
                              assignment_given: true,
                            }))
                          }
                          className={`px-5 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${newPMReport.assignment_given === true
                            ? "bg-violet-500/10 border-violet-500/30 text-violet-500"
                            : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                            }`}
                        >
                          {t("pmMisc.workspace.yes")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNewPMReport((p) => ({
                              ...p,
                              assignment_given: false,
                              assignment_kpi_ids: [],
                              assignment_objective: "",
                              assignment_outcome: "",
                            }))
                          }
                          className={`px-5 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${newPMReport.assignment_given === false
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                            : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                            }`}
                        >
                          {t("pmMisc.workspace.no")}
                        </button>
                      </div>
                    </div>

                    {newPMReport.assignment_given && (
                      <>
                        {/* Select Related KPI(s) — Required */}
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                            {t("pmMisc.workspace.selectRelatedKpis")}{" "}
                            <span className="text-rose-500">*</span>
                          </label>
                          {kpis.length === 0 ? (
                            <p className="text-[10px] text-slate-500 italic px-2">
                              {t("pmMisc.workspace.noKpisForProgram")}
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 gap-1.5 max-h-[160px] overflow-y-auto p-1 custom-scrollbar">
                              {kpis.map((kpi, kpiIdx2) => {
                                const kpiShare2 = Math.floor(100 / kpis.length);
                                const kpiPct2 =
                                  kpiIdx2 === kpis.length - 1
                                    ? 100 - kpiShare2 * (kpis.length - 1)
                                    : kpiShare2;
                                const isSelected = (
                                  newPMReport.assignment_kpi_ids || []
                                ).includes(kpi.id);
                                return (
                                  <button
                                    key={kpi.id}
                                    type="button"
                                    onClick={() =>
                                      setNewPMReport((p) => ({
                                        ...p,
                                        assignment_kpi_ids: isSelected
                                          ? p.assignment_kpi_ids.filter(
                                            (id) => id !== kpi.id,
                                          )
                                          : [...p.assignment_kpi_ids, kpi.id],
                                      }))
                                    }
                                    className={`flex items-center justify-between p-2.5 rounded-lg border text-[10px] font-bold uppercase tracking-tight transition-all text-left ${isSelected
                                      ? "bg-violet-500/10 border-violet-500/30 text-violet-500"
                                      : "bg-black/20 border-white/5 text-slate-400 hover:border-white/20"
                                      }`}
                                  >
                                    <span>{kpi.title}</span>
                                    <span className="text-[8px] opacity-50">
                                      {kpiPct2}%
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Assignment Objective — Required */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                            {t("pmMisc.workspace.assignmentObjective")}{" "}
                            <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newPMReport.assignment_objective}
                            onChange={(e) =>
                              setNewPMReport((p) => ({
                                ...p,
                                assignment_objective: e.target.value,
                              }))
                            }
                            placeholder={t("pmMisc.workspace.assignmentObjectivePlaceholder")}
                            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-violet-500 transition-all"
                          />
                        </div>

                        {/* Expected Outcome — Optional */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                            {t("pmMisc.workspace.expectedOutcome")}
                          </label>
                          <textarea
                            value={newPMReport.assignment_outcome}
                            onChange={(e) =>
                              setNewPMReport((p) => ({
                                ...p,
                                assignment_outcome: e.target.value,
                              }))
                            }
                            rows={2}
                            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-violet-500 transition-all resize-none"
                            placeholder={t("pmMisc.workspace.expectedOutcomePlaceholder")}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* ────────── SECTION 2: PARTICIPATION ────────── */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-indigo-500/20">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-[8px] font-black text-indigo-500 border border-indigo-500/20">
                      2
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500">
                      {t("pmMisc.workspace.participation")}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Attendance Level */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.attendanceLevel")}
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {["high", "moderate", "low"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setNewPMReport((p) => ({
                                ...p,
                                attendance_level: opt,
                              }))
                            }
                            className={`px-4 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${newPMReport.attendance_level === opt
                              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500"
                              : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                              }`}
                          >
                            {{
                              high: t("pmMisc.workspace.levelHigh"),
                              moderate: t("pmMisc.workspace.levelModerate"),
                              low: t("pmMisc.workspace.levelLow"),
                            }[opt] || opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Participation Level */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.participationLevel")}
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {["very_active", "active", "passive"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setNewPMReport((p) => ({
                                ...p,
                                participation_level: opt,
                              }))
                            }
                            className={`px-4 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${newPMReport.participation_level === opt
                              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500"
                              : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                              }`}
                          >
                            {{
                              very_active: t("pmMisc.workspace.participationVeryActive"),
                              active: t("pmMisc.workspace.participationActive"),
                              passive: t("pmMisc.workspace.participationPassive"),
                            }[opt] || opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Participants/Groups Need Attention — Toggle + conditional note */}
                    <div className="space-y-2 p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("pmMisc.workspace.participantsNeedAttention")}
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setNewPMReport((p) => ({
                              ...p,
                              participants_need_attention:
                                !p.participants_need_attention,
                            }))
                          }
                          className={`w-10 h-5 rounded-full transition-all relative ${newPMReport.participants_need_attention
                            ? "bg-amber-500"
                            : "bg-white/10"
                            }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${newPMReport.participants_need_attention
                              ? "left-5"
                              : "left-0.5"
                              }`}
                          />
                        </button>
                      </div>
                      {newPMReport.participants_need_attention && (
                        <textarea
                          value={newPMReport.participants_attention_notes}
                          onChange={(e) =>
                            setNewPMReport((p) => ({
                              ...p,
                              participants_attention_notes: e.target.value,
                            }))
                          }
                          rows={2}
                          className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none font-bold text-[var(--text-primary)] focus:border-amber-500 transition-all resize-none"
                          placeholder={t("pmMisc.workspace.shortNotePlaceholder")}
                        />
                      )}
                    </div>

                    {/* Standout Participants — Toggle + conditional note */}
                    <div className="space-y-2 p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("pmMisc.workspace.standoutParticipants")}
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setNewPMReport((p) => ({
                              ...p,
                              standout_participants: !p.standout_participants,
                            }))
                          }
                          className={`w-10 h-5 rounded-full transition-all relative ${newPMReport.standout_participants
                            ? "bg-emerald-500"
                            : "bg-white/10"
                            }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${newPMReport.standout_participants
                              ? "left-5"
                              : "left-0.5"
                              }`}
                          />
                        </button>
                      </div>
                      {newPMReport.standout_participants && (
                        <textarea
                          value={newPMReport.standout_notes}
                          onChange={(e) =>
                            setNewPMReport((p) => ({
                              ...p,
                              standout_notes: e.target.value,
                            }))
                          }
                          rows={2}
                          className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none font-bold text-[var(--text-primary)] focus:border-emerald-500 transition-all resize-none"
                          placeholder={t("pmMisc.workspace.shortNotePlaceholder")}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* ────────── SECTION 3: DELIVERY FEEDBACK ────────── */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-blue-500/20">
                    <div className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[8px] font-black text-blue-500 border border-blue-500/20">
                      3
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500">
                      {t("pmMisc.workspace.deliveryFeedback")}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Session Delivery Quality */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.sessionDeliveryQuality")}
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {["excellent", "good", "fair", "poor"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setNewPMReport((p) => ({
                                ...p,
                                delivery_quality: opt,
                              }))
                            }
                            className={`px-4 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${newPMReport.delivery_quality === opt
                              ? opt === "excellent"
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                : opt === "good"
                                  ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                                  : opt === "fair"
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                                    : "bg-rose-500/10 border-rose-500/30 text-rose-500"
                              : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                              }`}
                          >
                            {{
                              excellent: t("pmMisc.workspace.ratingExcellent"),
                              good: t("pmMisc.workspace.ratingGood"),
                              fair: t("pmMisc.workspace.ratingFair"),
                              poor: t("pmMisc.workspace.ratingPoor"),
                            }[opt] || opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Participant Understanding */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.participantUnderstanding")}
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {["high", "moderate", "low"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setNewPMReport((p) => ({
                                ...p,
                                participant_understanding: opt,
                              }))
                            }
                            className={`px-4 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${newPMReport.participant_understanding === opt
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                              : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                              }`}
                          >
                            {{
                              high: t("pmMisc.workspace.levelHigh"),
                              moderate: t("pmMisc.workspace.levelModerate"),
                              low: t("pmMisc.workspace.levelLow"),
                            }[opt] || opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Delivery Challenges — Toggle + conditional note */}
                    <div className="space-y-2 p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("pmMisc.workspace.deliveryChallenges")}
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setNewPMReport((p) => ({
                              ...p,
                              delivery_challenges: !p.delivery_challenges,
                            }))
                          }
                          className={`w-10 h-5 rounded-full transition-all relative ${newPMReport.delivery_challenges
                            ? "bg-rose-500"
                            : "bg-white/10"
                            }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${newPMReport.delivery_challenges
                              ? "left-5"
                              : "left-0.5"
                              }`}
                          />
                        </button>
                      </div>
                      {newPMReport.delivery_challenges && (
                        <textarea
                          value={newPMReport.delivery_challenge_note}
                          onChange={(e) =>
                            setNewPMReport((p) => ({
                              ...p,
                              delivery_challenge_note: e.target.value,
                            }))
                          }
                          rows={2}
                          className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none font-bold text-[var(--text-primary)] focus:border-rose-500 transition-all resize-none"
                          placeholder={t("pmMisc.workspace.shortNotePlaceholder")}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* ────────── SECTION 4: ISSUES & SUPPORT ────────── */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-rose-500/20">
                    <div className="w-5 h-5 rounded-full bg-rose-500/10 flex items-center justify-center text-[8px] font-black text-rose-500 border border-rose-500/20">
                      4
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-500">
                      {t("pmMisc.workspace.issuesAndSupport")}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Had Issues — Toggle */}
                    <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          {t("pmMisc.workspace.wereThereIssues")}
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setNewPMReport((p) => ({
                              ...p,
                              had_issues: !p.had_issues,
                            }))
                          }
                          className={`w-10 h-5 rounded-full transition-all relative ${newPMReport.had_issues
                            ? "bg-rose-500"
                            : "bg-white/10"
                            }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${newPMReport.had_issues ? "left-5" : "left-0.5"
                              }`}
                          />
                        </button>
                      </div>

                      {newPMReport.had_issues && (
                        <div className="mt-3 space-y-3">
                          {/* Issue Types — Multi-select chips */}
                          <div>
                            <label className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-60 mb-1.5 block">
                              {t("pmMisc.workspace.issueTypes")}
                            </label>
                            <div className="flex gap-1.5 flex-wrap">
                              {[
                                "technical",
                                "attendance",
                                "participation",
                                "curriculum",
                                "behavioral",
                                "other",
                              ].map((type) => {
                                const isSelected =
                                  newPMReport.issue_types.includes(type);
                                return (
                                  <button
                                    key={type}
                                    type="button"
                                    onClick={() =>
                                      setNewPMReport((p) => ({
                                        ...p,
                                        issue_types: isSelected
                                          ? p.issue_types.filter(
                                            (t) => t !== type,
                                          )
                                          : [...p.issue_types, type],
                                      }))
                                    }
                                    className={`px-3 py-1.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${isSelected
                                      ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                                      : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                                      }`}
                                  >
                                    {{
                                      technical: t("pmMisc.workspace.issueTechnical"),
                                      attendance: t("pmMisc.workspace.issueAttendance"),
                                      participation: t("pmMisc.workspace.issueParticipation"),
                                      curriculum: t("pmMisc.workspace.issueCurriculum"),
                                      behavioral: t("pmMisc.workspace.issueBehavioral"),
                                      other: t("pmMisc.workspace.issueOther"),
                                    }[type] || type}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Requires Super Admin Attention — Toggle */}
                          <div className="flex items-center justify-between">
                            <label className="text-[8px] font-black uppercase tracking-widest text-amber-500">
                              {t("pmMisc.workspace.requiresSuperAdmin")}
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setNewPMReport((p) => ({
                                  ...p,
                                  requires_admin_attention:
                                    !p.requires_admin_attention,
                                }))
                              }
                              className={`w-10 h-5 rounded-full transition-all relative ${newPMReport.requires_admin_attention
                                ? "bg-amber-500"
                                : "bg-white/10"
                                }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${newPMReport.requires_admin_attention
                                  ? "left-5"
                                  : "left-0.5"
                                  }`}
                              />
                            </button>
                          </div>

                          {/* Additional Note */}
                          <textarea
                            value={newPMReport.additional_issue_note}
                            onChange={(e) =>
                              setNewPMReport((p) => ({
                                ...p,
                                additional_issue_note: e.target.value,
                              }))
                            }
                            rows={2}
                            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none font-bold text-[var(--text-primary)] focus:border-rose-500 transition-all resize-none"
                            placeholder={t("pmMisc.workspace.additionalNotePlaceholder")}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ────────── SECTION 5: NEXT WEEK ────────── */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/20">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-[8px] font-black text-emerald-500 border border-emerald-500/20">
                      5
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500">
                      {t("pmMisc.workspace.nextWeek")}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Program On Track — Required */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.programOnTrack")}{" "}
                        <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setNewPMReport((p) => ({
                              ...p,
                              program_on_track: true,
                            }))
                          }
                          className={`px-5 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${newPMReport.program_on_track === true
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                            : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                            }`}
                        >
                          {t("pmMisc.workspace.yes")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNewPMReport((p) => ({
                              ...p,
                              program_on_track: false,
                            }))
                          }
                          className={`px-5 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${newPMReport.program_on_track === false
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                            : "bg-transparent border-white/10 text-slate-500 hover:border-white/30"
                            }`}
                        >
                          {t("pmMisc.workspace.no")}
                        </button>
                      </div>
                    </div>

                    {/* Planned Adjustments */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        {t("pmMisc.workspace.plannedAdjustments")}
                      </label>
                      <textarea
                        value={newPMReport.planned_adjustments}
                        onChange={(e) =>
                          setNewPMReport((p) => ({
                            ...p,
                            planned_adjustments: e.target.value,
                          }))
                        }
                        rows={2}
                        className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-[var(--brand-orange)] transition-all resize-none"
                        placeholder={t("pmMisc.workspace.plannedAdjustmentsPlaceholder")}
                      />
                    </div>
                  </div>
                </div>

                {/* ────────── NOTES (free text for PM) ────────── */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-500/20">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                      {t("pmMisc.workspace.strategicHealthNotes")}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.workspace.strategicHealth")}
                    </label>
                    <select
                      value={newPMReport.status}
                      onChange={(e) =>
                        setNewPMReport((p) => ({
                          ...p,
                          status: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <option value="optimal">{t("pmMisc.workspace.healthOptimal")}</option>
                      <option value="stable">{t("pmMisc.workspace.healthStable")}</option>
                      <option value="at_risk">{t("pmMisc.workspace.healthAtRisk")}</option>
                      <option value="critical">{t("pmMisc.workspace.healthCritical")}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.workspace.additionalNotes")}
                    </label>
                    <textarea
                      value={newPMReport.summary}
                      onChange={(e) =>
                        setNewPMReport((p) => ({
                          ...p,
                          summary: e.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm outline-none font-bold text-[var(--text-primary)] focus:border-[var(--brand-orange)] transition-all resize-none"
                      placeholder={t("pmMisc.workspace.additionalNotesPlaceholder")}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 sticky bottom-0 bg-secondary pt-4 border-t border-[var(--border-primary)]">
                <button
                  onClick={() => setShowPMReportModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  {t("pmMisc.workspace.cancel")}
                </button>
                <button
                  onClick={submitPMReport}
                  disabled={isSaving}
                  className="flex-1 btn btn-primary"
                >
                  {isSaving ? t("pmMisc.workspace.submitting") : t("pmMisc.workspace.submitReport")}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* TEAM DETAILS MODAL */}
        {showTeamDetails && selectedTeam && (
          <div
            className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowTeamDetails(false)}
          >
            <div
              className="card w-full max-w-5xl max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-indigo-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 border-b border-[var(--border-primary)] bg-gradient-to-r from-[var(--bg-secondary)] to-[var(--bg-tertiary)] flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight text-[var(--text-primary)] flex items-center gap-3">
                    <Target className="w-6 h-6 text-[var(--brand-orange)]" />
                    {selectedTeam.name} — {t("pmMisc.workspace.teamReview")}
                  </h3>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mt-1">
                    {t("pmMisc.workspace.teamReviewSubtitle")}
                  </p>
                </div>
                <button
                  onClick={() => setShowTeamDetails(false)}
                  className="p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div className="grid grid-cols-1 gap-8">
                  {/* Participant Table */}
                  <div className="table-container !border-none !shadow-none">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{t("pmMisc.workspace.teamMember")}</th>
                          <th>{t("pmMisc.workspace.submissions")}</th>
                          <th className="w-48 text-center">{t("pmMisc.workspace.marksAwarded")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participants
                          .filter((p) => p.v2_team_id === selectedTeam.id)
                          .map((p) => {
                            const participantSubmissions = submissions.filter(
                              (s) =>
                                String(s.participant_id) ===
                                String(p.cid || p.id),
                            );
                            const avgScore =
                              participantSubmissions.length > 0
                                ? Math.round(
                                  participantSubmissions.reduce(
                                    (acc, s) => acc + (s.score || 0),
                                    0,
                                  ) / participantSubmissions.length,
                                )
                                : 0;

                            return (
                              <tr
                                key={p.id}
                                className="hover:bg-indigo-500/5 transition-colors"
                              >
                                <td className="py-6">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black text-sm border border-indigo-500/20">
                                      {p.name.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
                                        {p.name}
                                      </p>
                                      <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase opacity-60">
                                        {p.email}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div className="flex flex-wrap gap-2">
                                    {participantSubmissions.map((sub) => (
                                      <div
                                        key={sub.id}
                                        className="group relative"
                                      >
                                        <button
                                          onClick={() =>
                                            setActivePDF({
                                              url: sub.file_url,
                                              name: `Submission_${sub.id}`,
                                            })
                                          }
                                          className="flex items-center gap-1.5 px-3 py-1.5 bg-tertiary rounded-lg border border-[var(--border-primary)] hover:border-emerald-500/50 transition-all"
                                        >
                                          <FileText className="w-3.5 h-3.5 text-emerald-500" />
                                          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                                            {t("pmMisc.workspace.artifact")}
                                          </span>
                                          <span className="text-[10px] font-black text-emerald-500">
                                            [{sub.score || "??"}]
                                          </span>
                                        </button>
                                      </div>
                                    ))}
                                    {participantSubmissions.length === 0 && (
                                      <span className="text-[9px] font-black uppercase tracking-widest text-rose-500/40 italic">
                                        {t("pmMisc.workspace.noSubmissionsFound")}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="text-center">
                                  <div className="inline-flex flex-col items-center gap-2">
                                    <div
                                      className={`text-2xl font-black ${avgScore >= 70 ? "text-emerald-500" : avgScore >= 40 ? "text-amber-500" : "text-rose-500"}`}
                                    >
                                      {avgScore}%
                                    </div>
                                    <select
                                      className="bg-tertiary border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[9px] font-black uppercase outline-none focus:border-indigo-500 cursor-pointer"
                                      value={avgScore}
                                      onChange={(e) =>
                                        updateParticipantScores(
                                          p.cid || p.id,
                                          e.target.value,
                                        )
                                      }
                                    >
                                      <option value="">{t("pmMisc.workspace.auditMarks")}</option>
                                      {[
                                        100, 90, 80, 70, 60, 50, 40, 30, 20, 10,
                                        0,
                                      ].map((m) => (
                                        <option key={m} value={m}>
                                          {m}% {t("pmMisc.workspace.awarded")}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {participants.filter(
                    (p) => p.group_name === selectedTeam.name,
                  ).length === 0 && (
                      <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-primary)] rounded-3xl opacity-30">
                        <Users className="w-12 h-12 mb-4" />
                        <p className="text-sm font-black uppercase tracking-[0.3em]">
                          {t("pmMisc.workspace.noMembersInTeam")}
                        </p>
                      </div>
                    )}
                </div>
              </div>

              <div className="p-6 bg-tertiary border-t border-[var(--border-primary)] flex justify-end gap-3">
                <button
                  onClick={() => setShowTeamDetails(false)}
                  className="btn btn-secondary px-8"
                >
                  {t("pmMisc.workspace.closeAudit")}
                </button>
                <button className="btn btn-primary px-8 gap-2">
                  <Save className="w-4 h-4" />
                  {t("pmMisc.workspace.saveAdjustments")}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Team Details Modal */}
      {showTeamDetails && selectedTeam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => { setShowTeamDetails(false); setSelectedTeam(null); }}
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div
            className="bg-[#0f172a] border border-gray-800 rounded-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-[var(--brand-orange)]" />
                {selectedTeam.name}
              </h2>
              <button onClick={() => { setShowTeamDetails(false); setSelectedTeam(null); }} className="p-2 hover:bg-white/5 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t("pmMisc.workspace.program")}</p>
                  <p className="font-medium">{program?.name || t("pmMisc.workspace.na")}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t("pmMisc.workspace.tableStatus")}</p>
                  <span className={"text-xs px-2.5 py-1 rounded-full " + (selectedTeam.is_venture_ready ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400")}>
                    {selectedTeam.is_venture_ready ? t("pmMisc.workspace.ventureReady") : t("pmMisc.workspace.inProgram")}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t("pmMisc.workspace.teamLead")}</p>
                  <p className="font-medium">{selectedTeam.leader_name || selectedTeam.leader_id || t("pmMisc.workspace.na")}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t("pmMisc.workspace.handler")}</p>
                  <p className="font-medium">{selectedTeam.handler_name || t("pmMisc.workspace.unassigned")}</p>
                </div>
                {selectedTeam.venture_id && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">{t("pmMisc.workspace.ventureId")}</p>
                    <p className="font-mono text-sm text-[var(--brand-orange)]">{selectedTeam.venture_id}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-800">
                <h3 className="text-sm font-medium mb-3">
                  {t("pmMisc.workspace.members")} ({participants.filter(p => p.v2_team_id === selectedTeam.id).length})
                </h3>
                <div className="space-y-2">
                  {participants
                    .filter(p => p.v2_team_id === selectedTeam.id)
                    .map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#020617]">
                        <div className="w-8 h-8 rounded-full bg-tertiary flex items-center justify-center text-xs font-bold">
                          {p.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.email}</p>
                        </div>
                      </div>
                    ))}
                  {participants.filter(p => p.v2_team_id === selectedTeam.id).length === 0 && (
                    <p className="text-sm text-gray-500">{t("pmMisc.workspace.noMembersAssigned")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Approve/Promote */}
      {promoteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setPromoteTarget(null)}
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div
            className="bg-[#0f172a] border border-gray-800 rounded-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {promoteTarget.action === "approve" ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{t("pmMisc.workspace.approveTeam")}</h3>
                      <p className="text-sm text-gray-400">
                        {t("pmMisc.workspace.approveTeamConfirm", { teamName: promoteTarget.team.name })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPromoteTarget(null)}
                      className="flex-1 px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm hover:bg-[#1e293b]"
                    >
                      {t("pmMisc.workspace.cancel")}
                    </button>
                    <button
                      onClick={async () => {
                        const team = promoteTarget.team;
                        setPromoteTarget(null);
                        try {
                          const res = await fetch("/api/pm/teams", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              team_id: team.id,
                              action: "set_venture_ready",
                              is_venture_ready: true,
                            }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            notify(t("pmMisc.workspace.teamApproved"));
                            fetchProgramData(true);
                          } else {
                            notify(t((data.error || t("pmMisc.workspace.approvalFailed")) || "") || (data.error || t("pmMisc.workspace.approvalFailed")), "error");
                          }
                        } catch (e) {
                          notify(t("pmMisc.workspace.networkError"), "error");
                        }
                      }}
                      className="flex-1 px-4 py-2.5 bg-emerald-500 rounded-lg text-sm font-medium hover:bg-emerald-600"
                    >
                      {t("pmMisc.workspace.approve")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-[var(--brand-orange)]/10 rounded-xl">
                      <Zap className="w-6 h-6 text-[var(--brand-orange)]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{t("pmMisc.workspace.promoteToVenture")}</h3>
                      <p className="text-sm text-gray-400">
                        {t("pmMisc.workspace.promoteConfirm", { teamName: promoteTarget.team.name })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPromoteTarget(null)}
                      className="flex-1 px-4 py-2.5 bg-[#020617] border border-gray-800 rounded-lg text-sm hover:bg-[#1e293b]"
                    >
                      {t("pmMisc.workspace.cancel")}
                    </button>
                    <button
                      onClick={async () => {
                        const team = promoteTarget.team;
                        setPromoteTarget(null);
                        try {
                          const res = await fetch("/api/ventures/promote", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ team_id: team.id }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            notify(t("pmMisc.workspace.venturePromoted"));
                            fetchProgramData(true);
                          } else {
                            notify(t((data.error || t("pmMisc.workspace.promotionFailed")) || "") || (data.error || t("pmMisc.workspace.promotionFailed")), "error");
                          }
                        } catch (e) {
                          notify(t("pmMisc.workspace.networkError"), "error");
                        }
                      }}
                      className="flex-1 px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-lg text-sm font-bold hover:opacity-90"
                    >
                      {t("pmMisc.workspace.promote")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center p-6"
          onClick={() => setConfirmTarget(null)}
        >
          <div
            className="card w-full max-w-sm space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-500" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold">{t("pmMisc.workspace.confirmAction")}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {confirmTarget.message}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 px-4 py-2.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg text-sm font-bold hover:opacity-80"
              >
                {t("pmMisc.workspace.cancel")}
              </button>
              <button
                onClick={() => {
                  confirmTarget.onConfirm();
                  setConfirmTarget(null);
                }}
                className="flex-1 px-4 py-2.5 bg-rose-500 text-white rounded-lg text-sm font-bold hover:bg-rose-600"
              >
                {t("pmMisc.workspace.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
    </DashboardLayout>
  );
}

export default function ProgramWorkspacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-primary flex items-center justify-center"><div className="w-8 h-8 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" /></div>}>
      <ProgramWorkspace />
    </Suspense>
  );
}
