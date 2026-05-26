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
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

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

  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [newSession, setNewSession] = useState({
    title: "",
    week_number: 1,
    status: "pending",
    kpi_ids: [],
    handler_id: "",
    handler_name: "",
  });
  const [newRequirement, setNewRequirement] = useState({
    title: "",
    description: "",
    allowed_format: "pdf",
    kpi_ids: [],
  });
  const [newPMReport, setNewPMReport] = useState({
    summary: "",
    status: "optimal",
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
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Configuration saved.");
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
          handler_id: newSession.handler_id || null,
          handler_name: newSession.handler_name || null,
          kpi_ids: newSession.kpi_ids || [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Session added.");
        setShowSessionModal(false);
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
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Requirement anchored.");
        if (shouldClose) setShowRequirementModal(false);
        setNewRequirement({
          title: "",
          description: "",
          allowed_format: "pdf",
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
      if ((await res.json()).success) {
        notify("Session field synchronized.");
        fetchProgramData(true);
      }
    } catch (e) {
      notify("Field sync failed.", "error");
    }
  };

  const submitPMReport = async () => {
    if (!newPMReport.summary.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit_pm_report",
          program_id: id,
          session_id: selectedSessionId,
          week_number: sessions.find((s) => s.id === selectedSessionId)
            ?.week_number,
          summary: newPMReport.summary,
          status: newPMReport.status,
          pm_id: user.cid || user.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Weekly report transmitted.");
        setShowPMReportModal(false);
        setNewPMReport({ summary: "", status: "optimal" });
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
        setNewKPI({ title: "", target_value: 80 });
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

  const deleteSession = async (sessionId) => {
    if (!confirm("Decommission this node and all associated requirements?"))
      return;
    try {
      await fetch("/api/pm/curriculum", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, type: "session" }),
      });
      notify("Session removed.");
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
        const res = await fetch(`/api/pm/full-state?id=${id}&t=${timestamp}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        }).then((res) => res.json());

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
    { id: "reports", name: "Reports", icon: BarChart3 },
    { id: "participants", name: "Participants", icon: Users },
    { id: "submissions", name: "Submissions", icon: Activity },
  ];

  const tabs = allTabs.filter(
    (tab) => !tab.roles || tab.roles.includes(user.role),
  );

  const canEdit =
    user.role === "super_admin" || user.role === "program_manager";

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

          {(user.role === "super_admin" || user.role === "program_manager") && (
            <div className="flex gap-3">
              <button className="btn btn-secondary gap-2">
                <Shield className="w-4 h-4" />
                Settings
              </button>
              <button className="btn btn-primary gap-2">
                <Plus className="w-4 h-4" />
                Deploy Node
              </button>
            </div>
          )}
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
                    +12% from last cohort
                  </p>
                  <p className="text-[9px] text-slate-500/60 font-medium mt-2 leading-relaxed">
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
                  <p className="text-[9px] text-slate-500/60 font-medium mt-2 leading-relaxed">
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
                    Active Operations
                  </p>
                  <p className="text-[9px] text-slate-500/60 font-medium mt-2 leading-relaxed">
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
                  <div className="flex justify-between items-center bg-[var(--bg-tertiary)] p-4 rounded-xl border border-[var(--border-primary)]">
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
                                <div className="w-8 h-8 rounded-full bg-[var(--bg-primary)] flex items-center justify-center font-bold text-xs border border-[var(--border-primary)]">
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
                                <div className="flex justify-end gap-2">
                                  <button className="p-2 hover:text-[var(--brand-blue)]">
                                    <Mail className="w-4 h-4" />
                                  </button>
                                  <button className="p-2 hover:text-emerald-500">
                                    <MessageCircle className="w-4 h-4" />
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
                        <div className="w-12 h-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)]">
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
                                className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border-2 border-[var(--bg-secondary)] flex items-center justify-center text-[8px] font-bold"
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
                          Healthy
                        </span>
                        <button
                          onClick={() => {
                            setSelectedTeam(team);
                            setShowTeamDetails(true);
                          }}
                          className="text-[var(--brand-blue)] text-xs font-bold uppercase flex items-center gap-1"
                        >
                          Details <ChevronRight className="w-4 h-4" />
                        </button>
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
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  Strategic Curriculum
                </h3>
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
                        handler_id: "",
                        handler_name: "",
                      });
                      setShowSessionModal(true);
                    }}
                    className="btn btn-primary btn-sm gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Session
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50 transition-all shadow-xl bg-[var(--bg-secondary)] group mb-4"
                  >
                    {/* STEP 0: THE HEADER (GLOBAL STATE) — click to toggle */}
                    <div
                      onClick={() =>
                        setExpandedSessionId(
                          expandedSessionId === session.id ? null : session.id,
                        )
                      }
                      className="px-6 py-4 bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)] flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-primary)] shadow-inner">
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
                            <span
                              className={`w-2 h-2 rounded-full animate-pulse ${
                                session.status === "completed"
                                  ? "bg-emerald-500"
                                  : session.status === "in progress"
                                    ? "bg-indigo-500"
                                    : "bg-amber-500"
                              }`}
                            />
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                              State: {session.status}
                            </span>
                          </div>
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
                            setShowPMReportModal(true);
                          }}
                          className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5 transition-all"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-black uppercase italic tracking-wider">
                            Give Weekly Report
                          </span>
                        </button>
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

                          <div className="space-y-4 p-5 bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-primary)] shadow-sm">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                                Assign Staff Member
                              </label>
                              <select
                                value={session.handler_id || ""}
                                onChange={(e) => {
                                  const staff = assignedStaff.find(
                                    (s) => String(s.cid) === e.target.value,
                                  );
                                  updateSessionField(
                                    session.id,
                                    "handler_id",
                                    e.target.value,
                                    staff?.name,
                                  );
                                }}
                                className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-indigo-500 transition-all cursor-pointer"
                              >
                                <option value="">Select Member...</option>
                                {programTeamMembers.length > 0
                                  ? programTeamMembers.map((s) => (
                                      <option key={s.cid} value={s.cid}>
                                        {s.name} ({s.role})
                                      </option>
                                    ))
                                  : assignedStaff.map((s) => (
                                      <option key={s.cid} value={s.cid}>
                                        {s.name} ({s.role})
                                      </option>
                                    ))}
                              </select>
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
                                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
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
                                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
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
                                className={`w-full mt-1 px-4 py-3 rounded-xl border text-[10px] font-black uppercase outline-none transition-all cursor-pointer ${
                                  session.status === "completed"
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                    : session.status === "in progress"
                                      ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/30"
                                      : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                }`}
                              >
                                <option value="pending">PENDING</option>
                                <option value="in progress">IN PROGRESS</option>
                                <option value="completed">COMPLETED</option>
                              </select>
                            </div>
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
                            {canEdit && (
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
                                  className="flex items-center justify-between p-4 bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/30 transition-all shadow-sm"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-500/5 flex items-center justify-center">
                                      <FileText className="w-5 h-5 text-indigo-500" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-black text-[var(--text-primary)] uppercase tracking-tight">
                                        {req.title}
                                      </p>
                                      <p className="text-[8px] text-[var(--text-secondary)] font-black uppercase tracking-widest mt-0.5 italic">
                                        Requirement:{" "}
                                        {req.allowed_format || "PDF"}
                                      </p>
                                    </div>
                                  </div>
                                  {canEdit && (
                                    <button className="text-rose-500/10 hover:text-rose-500 transition-all">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
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
                            {canEdit && (
                              <label className="text-[9px] font-black text-blue-500 uppercase hover:underline cursor-pointer flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Upload
                                <input
                                  type="file"
                                  accept=".pdf"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    notify("Syncing material...", "info");
                                    try {
                                      const res = await fetch(
                                        "/api/pm/curriculum",
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            action: "anchor_material",
                                            program_id: id,
                                            session_id: session.id,
                                            file_name: file.name,
                                          }),
                                        },
                                      );
                                      if ((await res.json()).success) {
                                        notify("Material anchored.");
                                        fetchProgramData(true);
                                      }
                                    } catch (e) {
                                      notify("Upload failed.", "error");
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>

                          <div className="space-y-3">
                            {/* Institutional Assets */}
                            {(program?.knowledge_assets || []).map(
                              (kb, kIdx) => (
                                <div
                                  key={`kb-${kIdx}`}
                                  className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 flex flex-col gap-3 group/asset shadow-sm"
                                >
                                  <div className="flex items-center gap-3">
                                    <BookOpen className="w-4 h-4 text-emerald-500" />
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-black text-[var(--text-primary)] uppercase truncate leading-none">
                                        {kb.name || "Core Asset"}
                                      </p>
                                      <p className="text-[7px] text-emerald-600 font-black uppercase tracking-widest mt-1">
                                        Institutional Intelligence
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() =>
                                      setActivePDF({
                                        url: kb.url,
                                        name: kb.name,
                                      })
                                    }
                                    className="w-full py-2 bg-emerald-500/10 rounded-lg text-[9px] font-black text-emerald-600 uppercase hover:bg-emerald-500/20 transition-all border border-emerald-500/10"
                                  >
                                    View Asset
                                  </button>
                                </div>
                              ),
                            )}

                            {/* Weekly Specific */}
                            {(() => {
                              let sessionMaterials = [];
                              try {
                                sessionMaterials =
                                  typeof session.materials === "string"
                                    ? JSON.parse(session.materials || "[]")
                                    : session.materials || [];
                              } catch (e) {
                                sessionMaterials = [];
                              }

                              return sessionMaterials.map((mat, mIdx) => (
                                <div
                                  key={`mat-${mIdx}`}
                                  className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20 flex flex-col gap-3 group/asset shadow-sm"
                                >
                                  <div className="flex items-center gap-3">
                                    <Zap className="w-4 h-4 text-blue-500" />
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-black text-[var(--text-primary)] uppercase truncate leading-none">
                                        {mat.name}
                                      </p>
                                      <p className="text-[7px] text-blue-600 font-black uppercase tracking-widest mt-1">
                                        Tactical Asset
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button className="flex-1 py-2 bg-blue-500/10 rounded-lg text-[9px] font-black text-blue-600 uppercase hover:bg-blue-500/20 transition-all border border-blue-500/10">
                                      View
                                    </button>
                                    <button className="px-3 py-2 bg-rose-500/5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all border border-rose-500/10">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ));
                            })()}

                            {(!session.materials ||
                              session.materials === "[]" ||
                              (Array.isArray(session.materials) &&
                                session.materials.length === 0)) &&
                              (!program?.knowledge_assets ||
                                program.knowledge_assets.length === 0) && (
                                <div className="py-8 text-center opacity-20 italic space-y-2">
                                  <Clock className="w-6 h-6 mx-auto" />
                                  <p className="text-[9px] font-bold uppercase">
                                    No Materials
                                  </p>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
                      Assigned Materials
                    </h3>
                    <div className="card space-y-4">
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                        Assigned Assets & Curriculum PDFs
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
                                } catch (e) {}
                              }
                              if (Array.isArray(item)) item = item[0];
                              if (item && typeof item === "object") {
                                return {
                                  name:
                                    item.name ||
                                    item.NAME ||
                                    item.title ||
                                    item.TITLE ||
                                    "Program Document",
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
                                No assigned materials have been anchored to this
                                program yet.
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
                                    : "Program Document")
                                : typeof file === "string"
                                  ? file.split("/").pop()
                                  : "Program Document";
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
                                className={`w-full flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border transition-all group text-left ${isKB ? "border-emerald-500/30 hover:border-emerald-500" : "border-[var(--border-primary)] hover:border-blue-500/50"}`}
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
                                        ? "Knowledge Asset"
                                        : "Program Material"}
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
                                  OPEN
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
                    Program Identity
                  </h3>
                  <div className="card space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        Program Name
                      </label>
                      <input
                        ref={configNameRef}
                        type="text"
                        defaultValue={program?.name}
                        disabled={user.role === "program_manager"}
                        className={`w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold ${user.role === "program_manager" ? "opacity-50 cursor-not-allowed" : ""}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                        Strategic Description
                      </label>
                      <textarea
                        ref={configDescRef}
                        rows="4"
                        defaultValue={program?.description}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          Duration (Weeks)
                        </label>
                        <input
                          ref={configWeeksRef}
                          type="number"
                          defaultValue={program?.duration_weeks}
                          className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          Operational Status
                        </label>
                        <select
                          ref={configStatusRef}
                          defaultValue={program?.status}
                          className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold"
                        >
                          <option value="active">ACTIVE</option>
                          <option value="archived">ARCHIVED</option>
                          <option value="draft">DRAFT</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-white" /> Project
                          Start Date
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
                          className="w-full bg-[var(--bg-primary)] border border-emerald-500/30 rounded-lg px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-all font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-white" /> Project
                          Finish Date
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
                          className="w-full bg-[var(--bg-primary)] border border-rose-500/30 rounded-lg px-4 py-3 text-sm focus:border-rose-500 outline-none transition-all font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 mt-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-2">
                        PROGRAM MANAGER
                      </label>
                      <div className="w-full bg-[var(--bg-primary)]/50 border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--brand-orange)] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4" />
                          <span className="uppercase">
                            {program?.pm_name || "Not Assigned"}
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
                      {isSaving ? "Saving..." : "Synchronize Global Settings"}
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <Zap className="w-5 h-5 text-purple-500" />
                    Strategic KPIs
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
                    <div className="space-y-2">
                      {kpis.map((kpi) => (
                        <div
                          key={kpi.id}
                          className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)]"
                        >
                          <span className="font-bold text-sm uppercase tracking-tight">
                            {kpi.title}
                          </span>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-black text-[var(--brand-orange)]">
                              {kpi.target_value}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "reports" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  Weekly Intelligence Feed
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                    Total Signals:
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
                    <div className="p-4 bg-[var(--bg-tertiary)] flex justify-between items-center border-b border-[var(--border-primary)]">
                      <div className="flex items-center gap-4">
                        <div className="px-3 py-1 bg-[var(--brand-orange)] text-white text-[10px] font-black rounded uppercase">
                          Wk{report.week_number}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)]">
                          Submission by{" "}
                          {report.staff_name ||
                            report.teacher_name ||
                            "Staff Member"}
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
                            Challenges & Blockers
                          </p>
                          <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                            {report.challenges || "No data reported."}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1">
                            Highlights & Successes
                          </p>
                          <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                            {report.highlights || "No data reported."}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1">
                            Strategic Next Steps
                          </p>
                          <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                            {report.next_steps || "No data reported."}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)]">
                            <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase">
                              Attendance
                            </p>
                            <p className="text-sm font-black">
                              {report.attendance_count || 0}
                            </p>
                          </div>
                          <div className="p-3 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)]">
                            <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase">
                              Sessions
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
                      Awaiting initial intelligence reports...
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
                    <th>Participant</th>
                    <th>Deliverable</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <div className="flex flex-col">
                          <span className="font-black text-[var(--text-primary)]">
                            {sub.participant_name || "N/A"}
                          </span>
                          <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">
                            {sub.group_name || "Individual"}
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
                          {sub.status}
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
                          Review
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
                        No submissions detected in this sector.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
                    Document Preview
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
                  <ExternalLink className="w-4 h-4" /> Open in New Tab
                </a>
                <button
                  onClick={() => setActivePDF(null)}
                  className="btn btn-secondary !py-2 hover:bg-rose-500/10 hover:text-rose-500 border-none"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[var(--bg-tertiary)] rounded-xl overflow-hidden border border-[var(--border-primary)] relative">
              {!activePDF.url || activePDF.url === "#" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 opacity-50">
                  <FileText className="w-16 h-16 mb-4 text-[var(--text-secondary)] opacity-20" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    No Document URL Found
                  </h3>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-2 max-w-sm leading-relaxed">
                    This material was registered without a valid file path or
                    external link. The document cannot be previewed.
                  </p>
                </div>
              ) : (
                <iframe
                  src={`${activePDF.url}#toolbar=0`}
                  className="w-full h-full"
                  title="PDF Viewer"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[500] px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-widest border ${
            toast.type === "error"
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
                  Initialize Student Group
                </h3>
                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                  Create a collaborative cohort of students for targeted
                  curriculum execution.
                </p>
              </div>
              <button onClick={() => setShowTeamModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-primary)]">
                <button
                  onClick={() => setTeamAssignmentMode("new")}
                  className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${teamAssignmentMode === "new" ? "bg-[var(--brand-orange)] text-black shadow-lg shadow-orange-500/20" : "text-[var(--text-secondary)] opacity-50"}`}
                >
                  Create New
                </button>
                <button
                  onClick={() => setTeamAssignmentMode("existing")}
                  className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${teamAssignmentMode === "existing" ? "bg-[var(--brand-orange)] text-black shadow-lg shadow-orange-500/20" : "text-[var(--text-secondary)] opacity-50"}`}
                >
                  Add to Existing
                </button>
              </div>

              {teamAssignmentMode === "new" ? (
                <div className="space-y-1">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Internal Team Name (Sub-group)
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
                    placeholder="e.g. Group Teh"
                  />
                  <p className="text-[8px] font-bold text-[var(--brand-orange)] uppercase mt-1">
                    Note: This will be linked to the parent group automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Select Target Group
                  </label>
                  <select
                    value={selectedExistingTeamId}
                    onChange={(e) => setSelectedExistingTeamId(e.target.value)}
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="">Select an existing team...</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name.toUpperCase()} (Group: {t.group_name})
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
                  Assign Group Lead (Student)
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
                  <option value="">Select Lead...</option>
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
                  Assign Oversight (Staff Member / Instructor)
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
                  <option value="">No Staff Assigned (Optional)</option>
                  {assignedStaff.map((s) => (
                    <option key={s.cid} value={s.cid}>
                      {s.name} ({s.role === "teacher" ? "Instructor" : s.role})
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
                Cancel
              </button>
              <button
                onClick={deployTeam}
                disabled={isSaving || !newTeam.name.trim()}
                className="flex-1 btn btn-primary"
              >
                {isSaving ? "Initializing..." : "Initialize Group"}
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
            className="card w-full max-w-sm space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3
                className="text-base font-black uppercase tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                Add Session
              </h3>
              <button onClick={() => setShowSessionModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Session Title
                </label>
                <input
                  value={newSession.title}
                  onChange={(e) =>
                    setNewSession((p) => ({ ...p, title: e.target.value }))
                  }
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="e.g. Orientation Week"
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Week Number
                </label>
                <input
                  type="number"
                  min="1"
                  value={newSession.week_number}
                  onChange={(e) =>
                    setNewSession((p) => ({
                      ...p,
                      week_number: parseInt(e.target.value) || 1,
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
              <div className="space-y-1">
                <label
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Assign Teacher (Program Team)
                </label>
                <select
                  value={newSession.handler_id}
                  onChange={(e) => {
                    const staff = programTeamMembers.find(
                      (s) => String(s.cid) === e.target.value,
                    );
                    setNewSession((p) => ({
                      ...p,
                      handler_id: e.target.value,
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
                  <option value="">Select Teacher...</option>
                  {programTeamMembers.map((s) => (
                    <option key={s.cid} value={s.cid}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                  <Target className="w-3 h-3 text-[#FF6600]" /> Link Strategic
                  KPIs (Required)
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-[120px] overflow-y-auto p-1 custom-scrollbar text-left">
                  {kpis.map((kpi) => (
                    <button
                      key={kpi.id}
                      onClick={() => toggleKpi("session", kpi.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                        (newSession.kpi_ids || []).includes(kpi.id)
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
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSessionModal(false)}
                className="flex-1 btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={addSession}
                disabled={isSaving || !newSession.title.trim()}
                className="flex-1 btn btn-primary"
              >
                {isSaving ? "Adding..." : "Add Session"}
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
                Grade Submission
              </h3>
              <button onClick={() => setShowReviewModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl space-y-2">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                Participant
              </p>
              <p className="text-sm font-black text-[var(--text-primary)]">
                {selectedSubmission?.participant_name || "Group Submission"}
              </p>
              <a
                href={selectedSubmission?.submission_link}
                target="_blank"
                className="text-[10px] font-black text-indigo-400 uppercase italic flex items-center gap-1 mt-2"
              >
                <ExternalLink className="w-3 h-3" /> View Source Material
              </a>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Numerical Grade (Score)
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
                  placeholder="e.g. 70"
                />
                <p className="text-[9px] font-bold text-slate-500 text-center uppercase mt-2">
                  This score will be synchronized to the global graduation
                  aggregation engine.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewSubmission}
                disabled={isSaving || reviewScore === ""}
                className="flex-1 btn btn-primary"
              >
                {isSaving ? "Grading..." : "Approve & Grade"}
              </button>
            </div>
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
                Assign Personnel
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
                  Select Staff Member
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
                  <option value="">Select Member...</option>
                  {staffList.map((s) => (
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
                  Assigned Role
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
                  <option value="staff">Staff Member</option>
                  <option value="assistant">Assistant</option>
                  <option value="evaluator">Evaluator</option>
                  <option value="handler">Handler</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStaffModal(false)}
                className="flex-1 btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={assignStaff}
                disabled={isSaving || !newStaff.staff_id}
                className="flex-1 btn btn-primary"
              >
                {isSaving ? "Assigning..." : "Assign"}
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
                Define KPI Target
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
                  KPI Title
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
                  placeholder="e.g. Weekly Engagement"
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Target Value (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newKPI.target_value}
                  onChange={(e) =>
                    setNewKPI((p) => ({
                      ...p,
                      target_value: parseInt(e.target.value) || 0,
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
            <div className="flex gap-3">
              <button
                onClick={() => setShowKPIModal(false)}
                className="flex-1 btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={addKPI}
                disabled={isSaving || !newKPI.title.trim()}
                className="flex-1 btn btn-primary"
              >
                {isSaving ? "Defining..." : "Define"}
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
                Add Requirement
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
                  Requirement Title
                </label>
                <input
                  value={newRequirement.title}
                  onChange={(e) =>
                    setNewRequirement((p) => ({ ...p, title: e.target.value }))
                  }
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="e.g. Project Proposal PDF"
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Allowed Format
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
                  <option value="pdf">PDF Document</option>
                  <option value="image">Image File</option>
                  <option value="link">External Link</option>
                  <option value="video">Video Upload</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                  <Target className="w-3 h-3 text-[#FF6600]" /> Strategic Impact
                  (KPIs)
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-[100px] overflow-y-auto p-1 custom-scrollbar text-left">
                  {kpis.map((kpi) => (
                    <button
                      key={kpi.id}
                      onClick={() => toggleKpi("requirement", kpi.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                        (newRequirement.kpi_ids || []).includes(kpi.id)
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
                Cancel
              </button>
              <div className="flex-1 flex flex-col gap-2">
                <button
                  onClick={() => addRequirement(false)}
                  disabled={isSaving || !newRequirement.title.trim()}
                  className="w-full btn btn-secondary text-[9px] py-2 border-dashed"
                >
                  {isSaving ? "Saving..." : "Save & Add Another"}
                </button>
                <button
                  onClick={() => addRequirement(true)}
                  disabled={isSaving || !newRequirement.title.trim()}
                  className="w-full btn btn-primary py-3"
                >
                  {isSaving ? "Saving..." : "Save & Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PM WEEKLY REPORT MODAL */}
      {showPMReportModal && (
        <div
          className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
          onClick={() => setShowPMReportModal(false)}
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
                Weekly PM Intelligence
              </h3>
              <button onClick={() => setShowPMReportModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Project Status Summary
                </label>
                <textarea
                  value={newPMReport.summary}
                  onChange={(e) =>
                    setNewPMReport((p) => ({ ...p, summary: e.target.value }))
                  }
                  rows="5"
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg px-4 py-3 text-sm focus:border-[var(--brand-orange)] outline-none transition-all font-bold text-[var(--text-primary)]"
                  placeholder="How did this week's topic go? Any tactical successes or blockers?"
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Strategic Health
                </label>
                <select
                  value={newPMReport.status}
                  onChange={(e) =>
                    setNewPMReport((p) => ({ ...p, status: e.target.value }))
                  }
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="optimal">OPTIMAL</option>
                  <option value="stable">STABLE</option>
                  <option value="at_risk">AT RISK</option>
                  <option value="critical">CRITICAL</option>
                </select>

                <div className="mt-4 p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border-primary)] space-y-3">
                  <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] border-b border-[var(--border-primary)] pb-2">
                    Strategic Health Guide
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1" />
                      <p className="text-[9px] font-bold text-[var(--text-primary)] leading-tight uppercase tracking-tight">
                        <span className="text-emerald-500">Optimal:</span>{" "}
                        Performance exceeding expectations. Zero blockers.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1" />
                      <p className="text-[9px] font-bold text-[var(--text-primary)] leading-tight uppercase tracking-tight">
                        <span className="text-blue-500">Stable:</span> On track.
                        Minor hurdles managed successfully.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1" />
                      <p className="text-[9px] font-bold text-[var(--text-primary)] leading-tight uppercase tracking-tight">
                        <span className="text-yellow-500">At Risk:</span>{" "}
                        Warning signs. Emerging blockers requiring attention.
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1" />
                      <p className="text-[9px] font-bold text-[var(--text-primary)] leading-tight uppercase tracking-tight">
                        <span className="text-rose-500">Critical:</span> Major
                        failure. Intervention required immediately.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPMReportModal(false)}
                className="flex-1 btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={submitPMReport}
                disabled={isSaving || !newPMReport.summary.trim()}
                className="flex-1 btn btn-primary"
              >
                {isSaving ? "Transmitting..." : "Submit to Super Admin"}
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
                  {selectedTeam.name} — Team Review
                </h3>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mt-1">
                  Operational Performance & Records
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
                        <th>Team Member</th>
                        <th>Submissions</th>
                        <th className="w-48 text-center">Marks Awarded</th>
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
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)] hover:border-emerald-500/50 transition-all"
                                      >
                                        <FileText className="w-3.5 h-3.5 text-emerald-500" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                                          Artifact
                                        </span>
                                        <span className="text-[10px] font-black text-emerald-500">
                                          [{sub.score || "??"}]
                                        </span>
                                      </button>
                                    </div>
                                  ))}
                                  {participantSubmissions.length === 0 && (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-500/40 italic">
                                      No submissions found
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
                                    className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[9px] font-black uppercase outline-none focus:border-indigo-500 cursor-pointer"
                                    value={avgScore}
                                    onChange={(e) =>
                                      updateParticipantScores(
                                        p.cid || p.id,
                                        e.target.value,
                                      )
                                    }
                                  >
                                    <option value="">Audit Marks...</option>
                                    {[
                                      100, 90, 80, 70, 60, 50, 40, 30, 20, 10,
                                      0,
                                    ].map((m) => (
                                      <option key={m} value={m}>
                                        {m}% Awarded
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

                {participants.filter((p) => p.group_name === selectedTeam.name)
                  .length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-primary)] rounded-3xl opacity-30">
                    <Users className="w-12 h-12 mb-4" />
                    <p className="text-sm font-black uppercase tracking-[0.3em]">
                      No members found in this team
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-[var(--bg-tertiary)] border-t border-[var(--border-primary)] flex justify-end gap-3">
              <button
                onClick={() => setShowTeamDetails(false)}
                className="btn btn-secondary px-8"
              >
                Close Audit
              </button>
              <button className="btn btn-primary px-8 gap-2">
                <Save className="w-4 h-4" />
                Save Adjustments
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
