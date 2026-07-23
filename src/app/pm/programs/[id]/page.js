"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import { getWeekNumber } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * IMPACTOS OPERATIONAL CONTROL — PROGRAM WORKSPACE
 * Performance-first, modular data loading, and clean data-first UI.
 */

export default function ProgramWorkspace() {
  const { id } = useParams();
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
      return unique.filter((s) => approvedIds.includes(s.cid));
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

  const [toast, setToast] = useState(null);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [reviewScore, setReviewScore] = useState("");

  const configNameRef = useRef(null);
  const configDescRef = useRef(null);
  const configWeeksRef = useRef(null);
  const configStatusRef = useRef(null);
  const configStartRef = useRef(null);
  const configEndRef = useRef(null);
  const configGradingRef = useRef(null);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
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
        notify("Saved");
        fetchProgramData(true);
      } else notify(data.error || "Save failed.", "error");
    } catch (e) {
      notify("Network error.", "error");
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
              ...newTeam,
              group_name: detectedGroupName,
              program_id: id,
              member_ids: selectedParticipants,
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
            ? "Student Group initialized."
            : "Students added to group.",
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
      } else notify(data.error || "Operation failed.", "error");
    } catch (e) {
      notify("Network error.", "error");
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
        notify("Participant moved to new team.");
        fetchProgramData(true);
      } else {
        notify(data.error || "Failed to move participant.", "error");
      }
    } catch (e) {
      notify("Network error.", "error");
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
      notify("At least one KPI must be assigned.", "error");
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
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Added");
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
        });
        fetchProgramData(true);
      } else notify(data.error || "Add failed.", "error");
    } catch (e) {
      notify("Network error.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const addRequirement = async (shouldClose = true) => {
    if (!newRequirement.title.trim()) return;
    setIsSaving(true);
    try {
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
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Added");
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
      } else notify(data.error || "Failed.", "error");
    } catch (e) {
      notify("Network error.", "error");
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
        notify(`Status updated to ${status.toUpperCase()}`);
        // Sync with server just in case
        fetchProgramData(true);
      } else {
        setSessions(previousSessions);
        notify("Status update failed.", "error");
      }
    } catch (e) {
      setSessions(previousSessions);
      notify("Status update failed.", "error");
    }
  };

  const updateSessionField = async (
    sessionId,
    field,
    value,
    handlerName = null,
  ) => {
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
        // Only show notification for non-text fields to avoid spam on every keystroke
        const silentFields = ["title", "description", "notes"];
        if (!silentFields.includes(field)) {
          notify("Session field synchronized.");
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
          notify("Session expired. Please save your work and refresh.", "error");
        } else {
          notify(data.error || "Field sync failed.", "error");
        }
      }
    } catch (e) {
      notify("Field sync failed.", "error");
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
        "Please fill in Week Status, Week Rating, and Main Topic (required fields).",
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
        notify("Weekly report transmitted.");
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
      } else notify(data.error || "Failed.", "error");
    } catch (e) {
      notify("Network error.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const addKPI = async () => {
    if (user.role !== "super_admin") {
      notify("Only SuperAdmin can define strategic KPIs.", "error");
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
        notify("KPI defined.");
        setShowKPIModal(false);
        setNewKPI({ title: "" });
        fetchProgramData(true);
      } else notify(data.error || "Failed.", "error");
    } catch (e) {
      notify("Network error.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const removeKPI = async (kpiId) => {
    if (user.role !== "super_admin") {
      notify("Only SuperAdmin can decommission KPIs.", "error");
      return;
    }
    if (!confirm("Decommission this KPI?")) return;
    try {
      await fetch("/api/v2/kpis", {
        method: "DELETE",
        body: JSON.stringify({ id: kpiId }),
      });
      notify("KPI removed.");
      fetchProgramData(true);
    } catch (e) {}
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
        notify("Personnel assigned.");
        setShowStaffModal(false);
        setNewStaff({ staff_id: "", role: "staff" });
        fetchProgramData(true);
      } else notify(data.error || "Assignment failed.", "error");
    } catch (e) {
      notify("Network error.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const removeStaff = async (staffId) => {
    if (!confirm("Remove this staff member?")) return;
    try {
      const record = assignedStaff.find((s) => s.cid === staffId);
      if (record && record.id) {
        await fetch("/api/v2/program-staff", {
          method: "DELETE",
          body: JSON.stringify({ id: record.id }),
        });
        notify("Personnel removed.");
        fetchProgramData(true);
      }
    } catch (e) {}
  };

  const deleteTeam = async (teamId) => {
    if (!confirm("Decommission this student group?")) return;
    try {
      const res = await fetch("/api/pm/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId }),
      });
      if ((await res.json()).success) {
        notify("Student Group decommissioned.");
        fetchProgramData(true);
      }
    } catch (e) {
      notify("Failed to remove group.", "error");
    }
  };

  const [showArchivedSessions, setShowArchivedSessions] = useState(false);

  const deleteSession = async (sessionId) => {
    if (!confirm("Archive this session? It can be restored later.")) return;
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
      notify("Session archived.");
      fetchProgramData(true);
    } catch (e) {}
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
        notify("Submission graded successfully.");
        setShowReviewModal(false);
        fetchProgramData(true);
      } else notify(data.error || "Failed to grade", "error");
    } catch (e) {
      notify("Network error.", "error");
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
        notify(`Synchronized ${score}% marks for participant.`);
        fetchProgramData(true);
      }
    } catch (e) {
      notify("Sync failed.", "error");
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
            {t("loading")}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const allTabs = [
    { id: "overview", name: "Overview", icon: LayoutDashboard },
    {
      id: "config",
      name: "Configuration",
      icon: Shield,
      roles: ["super_admin", "program_manager"],
    },
    { id: "curriculum", name: "Curriculum", icon: FileText },
    { id: "attendance", name: "Attendance", icon: CheckCircle2 },
    { id: "reports", name: "Reports", icon: BarChart3 },
    { id: "participants", name: "Participants", icon: Users },
    { id: "submissions", name: "Submissions", icon: Activity },
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
                {program?.status?.toUpperCase() || "ACTIVE"}
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
        <div className="flex gap-1 border-b border-[var(--border-primary)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-bold uppercase tracking-wide transition-all border-b-2 ${activeTab === tab.id ? "border-[var(--brand-orange)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="pt-4">
          {activeTab === "overview" && (
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
                    Total Participants
                  </p>
                  <p className="text-[10px] text-emerald-500 font-bold mt-1">
                    {sessions.length} Session{sessions.length !== 1 ? "s" : ""}{" "}
                    · {program?.duration_weeks || "?"} Week Program
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] font-medium mt-2 leading-relaxed">
                    Active learners currently enrolled. This count drives the
                    institutional footprint and scaling metrics for this
                    specific program node.
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
                    Operational Submissions
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    Completion Rate:{" "}
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
                    Total evidence-based artifacts uploaded. Each submission is
                    a tactical requirement anchored to a curriculum week,
                    directly influencing graduation scores.
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
                    Active Student Groups
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {assignedStaff.length} Staff · {reports.length} Report
                    {reports.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] font-medium mt-2 leading-relaxed">
                    Total number of student groups currently executing the
                    curriculum. High group counts require increased personnel
                    oversight and tactical health monitoring.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "participants" && (
            <div className="space-y-6 animate-in">
              {/* SUB-TAB NAVIGATION */}
              <div className="flex gap-4 border-b border-[var(--border-primary)]/30 pb-2">
                <button
                  onClick={() => setActiveSubTab("individuals")}
                  className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeSubTab === "individuals" ? "border-[var(--brand-orange)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] opacity-50 hover:opacity-100"}`}
                >
                  Individuals ({participants.length})
                </button>
                <button
                  onClick={() => setActiveSubTab("groups")}
                  className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeSubTab === "groups" ? "border-[var(--brand-orange)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] opacity-50 hover:opacity-100"}`}
                >
                  Teams ({teams.length})
                </button>
                <button
                  onClick={() => setActiveSubTab("staff")}
                  className={`text-[10px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all ${activeSubTab === "staff" ? "border-[var(--brand-orange)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] opacity-50 hover:opacity-100"}`}
                >
                  Program Staff ({assignedStaff.length})
                </button>
              </div>

              {activeSubTab === "individuals" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-tertiary p-4 rounded-xl border border-[var(--border-primary)]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        Selection:
                      </span>
                      <span className="text-sm font-black text-[var(--brand-orange)]">
                        {selectedParticipants.length} Selected
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setSelectedParticipants(participants.map((p) => p.id))
                        }
                        className="text-[9px] font-black uppercase text-blue-500 hover:underline"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setSelectedParticipants([])}
                        className="text-[9px] font-black uppercase text-rose-500 hover:underline"
                      >
                        Clear
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
                          <Target className="w-3 h-3" /> Group Students
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
                          <th>Participant</th>
                          <th>Email</th>
                          <th>Group</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participants.map((p) => {
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
                                      ?.name || "Individual"}
                                  </span>
                                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter italic">
                                    Segment: {p.group_name || "N/A"}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span className="text-xs font-medium">
                                    Operational
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
                                    <option value="">No Team</option>
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
                          Group: {team.group_name || "N/A"}
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
                          Members
                        </span>
                      </div>
                      <div className="space-y-1 mb-6">
                        <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                          Assigned Staff
                        </p>
                        <p className="text-xs text-[var(--text-primary)] font-black uppercase tracking-tight">
                          {team.handler_name || "Unassigned"}
                        </p>
                      </div>
                      <div className="flex justify-between items-center pt-4 border-t border-[var(--border-primary)]">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                          {team.is_venture_ready ? "Venture Ready" : "In Program"}
                        </span>
                        <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedTeam(team);
                            setShowTeamDetails(true);
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          <ChevronRight className="w-3 h-3" /> View
                        </button>
                        {team.is_venture_ready && !team.venture_id && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Promote "${team.name}" to Venture OS?`)) return;
                              try {
                                const res = await fetch("/api/ventures/promote", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ team_id: team.id }),
                                });
                                const data = await res.json();
                                if (data.success) {
                                  notify("Venture promoted!");
                                  fetchProgramData(true);
                                } else {
                                  notify(data.error || "Promotion failed.", "error");
                                }
                              } catch (e) {
                                notify("Network error.", "error");
                              }
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            <Zap className="w-3 h-3" /> Promote
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
                        No student groups found.
                        <br />
                        Select participants in the Individuals tab to initialize
                        a group.
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
                        Program Staff
                      </h3>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                        Assigned mentors, assistants, and evaluators for this
                        program
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => setShowStaffModal(true)}
                        className="btn btn-primary btn-sm px-4 gap-2"
                      >
                        <UserPlus className="w-3 h-3" /> Assign Personnel
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
                          No staff members assigned yet.
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
                  Strategic Curriculum
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowArchivedSessions((p) => !p)}
                    className={`text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
                      showArchivedSessions
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                        : "bg-transparent border-white/10 text-slate-600 hover:text-slate-400"
                    }`}
                  >
                    {showArchivedSessions ? "Showing Archived" : "Archived"}
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
                      <Plus className="w-4 h-4" /> Create
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
                              WK
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
                                      State: {displayStatus}
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
                                  📌 Notes
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
                              Attendance
                            </span>
                          </button>
                          {isAssignedPm && (
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
                                Give Weekly Report
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
                              title={session.status === "locked" ? "Unlock this week" : "Lock this week"}
                              className={`btn btn-secondary !py-2 !px-4 flex items-center gap-2 transition-all ${
                                session.status === "locked"
                                  ? "border-rose-500/20 text-rose-500 hover:bg-rose-500/5"
                                  : "border-amber-500/20 text-amber-500 hover:bg-amber-500/5"
                              }`}
                            >
                              <span className="text-sm">{session.status === "locked" ? "🔓" : "🔒"}</span>
                              <span className="text-[9px] font-black uppercase italic tracking-wider">
                                {session.status === "locked" ? "Unlock" : "Lock"}
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
                                Logistics & Deployment
                              </span>
                            </div>

                            <div className="space-y-4 p-5 bg-primary rounded-2xl border border-[var(--border-primary)] shadow-sm">
                              {/* Session Title */}
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                                  Session Title
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
                                  Description
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
                                    Week
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
                                    <Clock className="w-2.5 h-2.5" /> Start Time
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
                                    <Clock className="w-2.5 h-2.5" /> End Time
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
                                  Timezone
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
                                  Assign Staff Member(s)
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
                                    Start Date
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
                                    Finish Date
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
                                  Operational State
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
                                  <option value="not started">NOT STARTED</option>
                                  <option value="pending">PENDING</option>
                                  <option value="in progress">
                                    IN PROGRESS
                                  </option>
                                  <option value="completed">COMPLETED</option>
                                  <option value="locked">🔒 LOCKED</option>
                                </select>
                              </div>
                              {session.version > 1 && (
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                                    Version: {session.version}
                                  </span>
                                  <span className="text-[7px] text-slate-500">
                                    ({session.version - 1} revision{session.version > 2 ? 's' : ''})
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
                                  Assessments & Deliverables
                                </span>
                              </div>
                              {canContribute && (
                                <button
                                  onClick={() => {
                                    setSelectedSessionId(session.id);
                                    setShowRequirementModal(true);
                                  }}
                                  className="text-[9px] font-black text-[var(--brand-orange)] uppercase hover:underline flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Add Requirement
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
                                          <span>Requirement: {req.allowed_format || "PDF"}</span>
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
                                                  Due: {due.toLocaleDateString()}
                                                </span>
                                                {isOverdue && (
                                                  <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-rose-500/20 text-rose-400">OVERDUE</span>
                                                )}
                                                {isDueSoon && (
                                                  <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-amber-500/20 text-amber-400">DUE SOON</span>
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
                                                  ? `Reminder sent to ${data.sent} participant(s)`
                                                  : "Reminder sent";
                                                notify(msg);
                                              } else {
                                                notify("Reminder failed");
                                              }
                                            } catch (e) {
                                              notify("Reminder error");
                                            }
                                          }}
                                          className="text-[7px] font-black uppercase text-[var(--brand-orange)]/60 hover:text-[var(--brand-orange)] transition-all px-2 py-1 rounded border border-[var(--brand-orange)]/20 hover:border-[var(--brand-orange)]/50"
                                          title="Send reminder to assigned participants"
                                        >
                                          <Bell className="w-3 h-3 inline mr-1" />
                                          REMIND
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
                                    No Requirements Set
                                  </p>
                                </div>
                              )}
                            </div>
                            <p className="text-[8px] font-bold text-slate-500/50 uppercase tracking-widest italic text-center px-6">
                              These items are formal evidence submitted by
                              participants for final graduation scoring.
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
                                  Weekly Resources
                                </span>
                              </div>


















































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































                             
