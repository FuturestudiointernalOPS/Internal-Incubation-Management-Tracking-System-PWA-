"use client";

import React, { useState, useEffect, use } from "react";
import {
  Users,
  FileText,
  Calendar,
  Upload,
  Link as LinkIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  FolderKanban,
  BarChart3,
  BookOpen,
  Activity,
  MessageSquare,
  ChevronRight,
  Globe,
  Eye,
  Download,
  Plus,
  Trash2,
  Loader2,
  Save,
  History,
  Flag,
  ListTodo,
  ClipboardCheck,
  Star,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppTabs from "@/components/ui/AppTabs";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppBadge from "@/components/ui/AppBadge";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import AppEmptyState from "@/components/ui/AppEmptyState";
import GlobalToast from "@/components/ui/GlobalToast";
import { useI18n } from "@/lib/i18n";

export default function TeamDashboardPage({ params }) {
  const unwrappedParams = use(params);
  const { id: teamId } = unwrappedParams;
  const router = useRouter();
  const { t } = useI18n();

  // — State —
  const [activeTab, setActiveTab] = useState("overview");
  const [team, setTeam] = useState(null);
  const [program, setProgram] = useState(null);
  const [members, setMembers] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [files, setFiles] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);
  const [submitFileUrl, setSubmitFileUrl] = useState("");
  const [submitLink, setSubmitLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Task 4.5 — Team Workspace state
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    assigned_to: "",
  });
  const [savingTask, setSavingTask] = useState(false);

  // Task 4.4 — Coaching state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewSubData, setReviewSubData] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // — Fetch all data —
  useEffect(() => {
    fetchTeamData();
    fetchUserRole();
  }, [teamId, retryCount]);

  const fetchUserRole = async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data?.user?.role) setUserRole(data.user.role);
    } catch (_) {}
  };

  const fetchTeamData = async () => {
    setLoading(true);
    try {
      // 1. Fetch team data
      const teamRes = await fetch(
        `/api/teams?program_id=all&team_id=${teamId}`,
      );
      const teamData = await teamRes.json();

      if (teamData.success && teamData.teams) {
        const found = teamData.teams.find(
          (t) => t.id === teamId || String(t.id) === String(teamId),
        );
        if (found) {
          setTeam(found);

          // 2. Fetch program info
          if (found.program_id) {
            const progRes = await fetch(`/api/programs?id=${found.program_id}`);
            const progData = await progRes.json();
            if (progData.success && progData.programs) {
              setProgram(progData.programs[0] || null);
            }

            // 3. Fetch deliverables for this program
            try {
              const delRes = await fetch(
                `/api/deliverables?program_id=${found.program_id}`,
              );
              const delData = await delRes.json();
              if (delData.success && delData.deliverables) {
                setDeliverables(delData.deliverables || []);
              }
            } catch (_) {}

            // 4. Fetch submissions for this team
            try {
              const subRes = await fetch(
                `/api/submissions?team_id=${teamId}&program_id=${found.program_id}`,
              );
              const subData = await subRes.json();
              if (subData.success && subData.submissions) {
                const subMap = {};
                for (const s of subData.submissions) {
                  const key = s.deliverable_id || s.requirement_id;
                  if (key) {
                    if (!subMap[key]) subMap[key] = [];
                    subMap[key].push(s);
                  }
                }
                setSubmissions(subMap);
              }
            } catch (_) {}

            // 5. Build deadlines calendar
            try {
              if (delData?.deliverables) {
                const now = new Date();
                const deadlines = delData.deliverables
                  .filter((d) => d.due_date || d.created_at)
                  .map((d) => ({
                    ...d,
                    _date: d.due_date
                      ? new Date(d.due_date)
                      : new Date(d.created_at),
                  }))
                  .filter((d) => d._date >= now)
                  .sort((a, b) => a._date - b._date);
                setUpcomingDeadlines(deadlines);
              }
            } catch (_) {}
          }

          // 6. Team members come from the teams API response
          if (found.members) {
            setMembers(found.members || []);
          }
        }
      }
    } catch (e) {
      console.error("Team dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  // — Fetch team tasks —
  const fetchTasks = async () => {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/team-tasks?team_id=${teamId}`);
      const data = await res.json();
      if (data.success) setTasks(data.tasks || []);
    } catch (_) {}
    setTasksLoading(false);
  };

  useEffect(() => {
    if (teamId && activeTab === "tasks") fetchTasks();
  }, [teamId, activeTab]);

  // — File upload handler —
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setSubmitFileUrl(data.url);
      } else if (data.blob?.url) {
        setSubmitFileUrl(data.blob.url);
      } else {
        setToast({
          type: "error",
          message: "Upload failed. Please try again.",
        });
      }
    } catch (_) {
      setToast({ type: "error", message: "Upload error." });
    } finally {
      setUploading(false);
    }
  };

  // — Submit deliverable —
  const handleSubmitDeliverable = async () => {
    if (!selectedDeliverable) return;
    const fileUrl = submitFileUrl || submitLink;
    if (!fileUrl) {
      setToast({ type: "error", message: "Please provide a file or link." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: team.program_id,
          deliverable_id: selectedDeliverable.id,
          team_id: teamId,
          file_url: fileUrl,
          status: "pending",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: "Submission successful!" });
        setShowSubmitModal(false);
        setSelectedDeliverable(null);
        setSubmitFileUrl("");
        setSubmitLink("");
        fetchTeamData();
      } else {
        setToast({
          type: "error",
          message: t((data.error || "Submission failed.") || "") || (data.error || "Submission failed."),
        });
      }
    } catch (_) {
      setToast({ type: "error", message: "Network error." });
    } finally {
      setSubmitting(false);
    }
  };

  // — Open submit modal —
  const openSubmitModal = (deliverable) => {
    setSelectedDeliverable(deliverable);
    setSubmitFileUrl("");
    setSubmitLink("");
    setShowSubmitModal(true);
  };

  // — Coaching review handler —
  const openReviewModal = (deliverable) => {
    const sub = getSubmissionStatus(deliverable.id);
    if (!sub) return;
    setReviewSubData({ ...sub, _deliverable: deliverable });
    setReviewFeedback(sub.feedback || "");
    setShowReviewModal(true);
  };

  const handleReviewAction = async (status, followUp) => {
    if (!reviewSubData?.id) return;
    setReviewing(true);
    try {
      const body = { id: reviewSubData.id, status, feedback: reviewFeedback };
      if (followUp && followUpDate) {
        body.follow_up = {
          scheduled_at: followUpDate,
          comment: reviewFeedback,
        };
      }
      const res = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setToast({
          type: "success",
          message: `Submission ${status.replace(/_/g, " ")}`,
        });
        setShowReviewModal(false);
        setReviewSubData(null);
        setReviewFeedback("");
        setFollowUpDate("");
        fetchTeamData();
      } else {
        setToast({ type: "error", message: t((data.error || "Review failed") || "") || (data.error || "Review failed") });
      }
    } catch (e) {
      setToast({ type: "error", message: t(e.message || "") || e.message });
    }
    setReviewing(false);
  };

  // — Task CRUD handlers —
  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) return;
    setSavingTask(true);
    try {
      const res = await fetch("/api/team-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...taskForm, team_id: teamId }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: "Task created" });
        setShowTaskModal(false);
        setTaskForm({
          title: "",
          description: "",
          priority: "medium",
          assigned_to: "",
        });
        fetchTasks();
      }
    } catch (e) {
      setToast({ type: "error", message: t(e.message || "") || e.message });
    }
    setSavingTask(false);
  };

  const handleUpdateTaskStatus = async (taskId, status) => {
    try {
      const res = await fetch("/api/team-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status }),
      });
      const data = await res.json();
      if (data.success) fetchTasks();
    } catch (_) {}
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const res = await fetch("/api/team-tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: "Task deleted" });
        fetchTasks();
      }
    } catch (e) {
      setToast({ type: "error", message: t(e.message || "") || e.message });
    }
  };

  const getSubmissionStatus = (deliverableId) => {
    const subs = submissions[deliverableId];
    if (!subs || subs.length === 0) return null;
    const latest = subs[0];
    return latest;
  };

  // — Compute progress % —
  const progressPct = (() => {
    if (deliverables.length === 0) return 0;
    let completed = 0;
    for (const d of deliverables) {
      const sub = getSubmissionStatus(d.id);
      if (sub && (sub.status === "approved" || sub.status === "completed")) {
        completed++;
      }
    }
    return Math.round((completed / deliverables.length) * 100);
  })();

  // — Tab definitions —
  const tabs = [
    { id: "overview", label: "Overview", icon: FolderKanban },
    { id: "deliverables", label: "Deliverables", icon: FileText },
    { id: "tasks", label: "Tasks", icon: ListTodo },
    { id: "files", label: "Files", icon: BookOpen },
    { id: "calendar", label: "Calendar", icon: Calendar },
  ];

  // — Empty state renderer —
  const renderEmpty = (icon, title, desc) => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--surface-3)] flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-bold text-[var(--text-primary)] mb-1">
        {title}
      </p>
      <p className="text-xs text-[var(--text-secondary)] max-w-xs">{desc}</p>
    </div>
  );

  // — Status color helpers —
  const statusColors = {
    approved: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-500",
      border: "border-emerald-500/20",
    },
    completed: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-500",
      border: "border-emerald-500/20",
    },
    pending: {
      bg: "bg-amber-500/10",
      text: "text-amber-500",
      border: "border-amber-500/20",
    },
    rejected: {
      bg: "bg-rose-500/10",
      text: "text-rose-500",
      border: "border-rose-500/20",
    },
    draft: {
      bg: "bg-indigo-500/10",
      text: "text-indigo-500",
      border: "border-indigo-500/20",
    },
  };

  // — Format date helper —
  const fmtDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // — Loading state —
  if (loading) {
    return (
      <DashboardLayout role="team">
        <div className="max-w-6xl mx-auto p-6 flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-[var(--text-secondary)]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm font-bold uppercase tracking-wider">
              Loading workspace...
            </span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // — Not found —
  if (!team) {
    return (
      <DashboardLayout role="team">
        <div className="max-w-6xl mx-auto p-6">
          <div className="text-center py-20">
            <h2 className="text-lg font-black text-[var(--text-primary)] uppercase mb-2">
              Team Not Found
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              The team you are looking for does not exist or you do not have
              access.
            </p>
            <AppButton variant="secondary" onClick={() => router.push("/")}>
              Go Home
            </AppButton>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="team">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <GlobalToast toast={toast} onClose={() => setToast(null)} />

        {/* — Header — */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-colors mb-2 uppercase tracking-wider"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">
              {team.name}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] font-bold mt-1">
              {program ? program.name : ""} — Team Workspace
            </p>
          </div>
          <div className="flex items-center gap-3">
            {program?.demo_link && (
              <a
                href={program.demo_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-primary)] hover:border-[var(--brand-orange)] transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Demo
              </a>
            )}
            {program?.pitch_deck_url && (
              <a
                href={program.pitch_deck_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)] text-xs font-bold text-[var(--text-primary)] hover:border-[var(--brand-orange)] transition-all"
              >
                <Globe className="w-3.5 h-3.5" />
                Pitch Deck
              </a>
            )}
          </div>
        </div>

        {/* — Tabs — */}
        <AppTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        {/* ============================================
            TAB: OVERVIEW
            ============================================ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Progress & Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <AppCard padding="md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-[var(--brand-orange)]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Progress
                    </p>
                    <p className="text-lg font-black text-[var(--text-primary)]">
                      {progressPct}%
                    </p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-3 h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPct}%`,
                      background: "var(--brand-orange)",
                    }}
                  />
                </div>
              </AppCard>

              <AppCard padding="md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Completed
                    </p>
                    <p className="text-lg font-black text-[var(--text-primary)]">
                      {
                        deliverables.filter((d) => {
                          const sub = getSubmissionStatus(d.id);
                          return (
                            sub &&
                            ["approved", "completed"].includes(sub.status)
                          );
                        }).length
                      }{" "}
                      / {deliverables.length}
                    </p>
                  </div>
                </div>
              </AppCard>

              <AppCard padding="md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Pending
                    </p>
                    <p className="text-lg font-black text-[var(--text-primary)]">
                      {
                        deliverables.filter((d) => {
                          const sub = getSubmissionStatus(d.id);
                          return !sub || sub.status === "pending";
                        }).length
                      }
                    </p>
                  </div>
                </div>
              </AppCard>

              <AppCard padding="md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Members
                    </p>
                    <p className="text-lg font-black text-[var(--text-primary)]">
                      {members.length}
                    </p>
                  </div>
                </div>
              </AppCard>
            </div>

            {/* Team Info + Members */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Team Info */}
              <AppCard padding="lg" className="lg:col-span-2">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider mb-4">
                  Team Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      Team Name
                    </span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {team.name}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      Program
                    </span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {program?.name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      Handler
                    </span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {team.handler_name || "Unassigned"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      Project
                    </span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {program?.project_description || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      Status
                    </span>
                    <span className="text-xs font-bold text-emerald-500 uppercase">
                      Active
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-t border-[var(--border-primary)]">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      Venture Ready
                    </span>
                    <span
                      className={`text-xs font-bold uppercase ${team.is_venture_ready ? "text-emerald-500" : "text-[var(--text-tertiary)]"}`}
                    >
                      {team.is_venture_ready ? (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" /> Ready
                        </span>
                      ) : (
                        "Not Ready"
                      )}
                    </span>
                  </div>
                  {["staff", "super_admin", "program_manager"].includes(
                    userRole,
                  ) && (
                    <div className="flex justify-end pt-2">
                      <AppButton
                        variant={
                          team.is_venture_ready ? "secondary" : "primary"
                        }
                        size="sm"
                        icon={Star}
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/teams", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: teamId,
                                name: team.name,
                                is_venture_ready: !team.is_venture_ready,
                              }),
                            });
                            if ((await res.json()).success) fetchTeamData();
                          } catch (_) {}
                        }}
                      >
                        {team.is_venture_ready
                          ? "Unmark"
                          : "Mark as Venture Ready"}
                      </AppButton>
                    </div>
                  )}
                </div>
              </AppCard>

              {/* Members */}
              <AppCard padding="lg">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider mb-4">
                  Team Members
                </h3>
                {members.length === 0 ? (
                  <p className="text-xs text-[var(--text-tertiary)] font-bold">
                    No members linked yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {members.map((m, i) => (
                      <div
                        key={m.cid || m.id || i}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-3)] transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-[10px] font-black text-[var(--brand-orange)]">
                          {(m.name || "?")[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                            {m.name || "Unnamed"}
                          </p>
                          <p className="text-[9px] text-[var(--text-tertiary)] truncate">
                            {m.email || ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AppCard>
            </div>

            {/* Quick links */}
            {upcomingDeadlines.length > 0 && (
              <AppCard padding="lg">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-[var(--brand-orange)]" />
                  Upcoming Deadlines
                </h3>
                <div className="space-y-2">
                  {upcomingDeadlines.slice(0, 5).map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-3)]"
                    >
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {d.title}
                        </p>
                        <p className="text-[9px] text-[var(--text-tertiary)]">
                          Week {d.week_number || "?"}
                        </p>
                      </div>
                      <span className="text-[10px] font-black text-amber-500 uppercase">
                        {fmtDate(d.due_date || d._date)}
                      </span>
                    </div>
                  ))}
                </div>
              </AppCard>
            )}
          </div>
        )}

        {/* ============================================
            TAB: DELIVERABLES
            ============================================ */}
        {activeTab === "deliverables" && (
          <div className="space-y-4">
            {deliverables.length === 0
              ? renderEmpty(
                  <FileText className="w-6 h-6 text-[var(--text-tertiary)]" />,
                  "No Deliverables Yet",
                  "Deliverables will appear here once they are assigned to your program.",
                )
              : deliverables.map((d) => {
                  const sub = getSubmissionStatus(d.id);
                  const statusKey = sub?.status || "pending";
                  const colors =
                    statusColors[statusKey] || statusColors.pending;
                  const isOverdue =
                    !sub && d.due_date && new Date(d.due_date) < new Date();

                  return (
                    <AppCard key={d.id} padding="lg" hover>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-black text-[var(--text-primary)]">
                              {d.title}
                            </h4>
                            {isOverdue && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-[9px] font-black text-rose-500 uppercase">
                                Overdue
                              </span>
                            )}
                          </div>
                          {d.description && (
                            <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                              {d.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-3">
                            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase">
                              Week {d.week_number || "?"}
                            </span>
                            {d.due_date && (
                              <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase">
                                Due: {fmtDate(d.due_date)}
                              </span>
                            )}
                          </div>

                          {/* Submission status */}
                          {sub && (
                            <div className="mt-3">
                              <AppStatusBadge
                                status={sub.status || "pending"}
                              />
                              {sub.file_url && (
                                <a
                                  href={sub.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 ml-3 text-[10px] font-bold text-[var(--brand-blue)] hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  View Submission
                                </a>
                              )}
                              {sub.feedback && (
                                <p className="text-[10px] text-[var(--text-secondary)] mt-2 italic">
                                  Feedback: {sub.feedback}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Version history */}
                          {submissions[d.id] &&
                            submissions[d.id].length > 1 && (
                              <details className="mt-3">
                                <summary className="text-[10px] font-bold text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--brand-orange)] transition-colors uppercase tracking-wider flex items-center gap-1">
                                  <History className="w-3 h-3" />
                                  Version History ({submissions[d.id].length})
                                </summary>
                                <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-[var(--border-primary)]">
                                  {submissions[d.id].map((v, vi) => (
                                    <div
                                      key={vi}
                                      className="text-[10px] text-[var(--text-secondary)] flex items-center gap-2"
                                    >
                                      <span className="text-[var(--text-tertiary)]">
                                        v{submissions[d.id].length - vi}
                                      </span>
                                      <span>{fmtDate(v.created_at)}</span>
                                      {v.file_url && (
                                        <a
                                          href={v.file_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[var(--brand-blue)] hover:underline"
                                        >
                                          View
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                        </div>

                        {/* Action */}
                        <div className="shrink-0 flex items-center gap-2">
                          {/* Instructor review button */}
                          {[
                            "staff",
                            "super_admin",
                            "program_manager",
                            "teacher",
                          ].includes(userRole) &&
                            sub && (
                              <AppButton
                                variant="secondary"
                                size="sm"
                                onClick={() => openReviewModal(d)}
                                title="Review submission"
                              >
                                <ClipboardCheck className="w-3.5 h-3.5" />
                              </AppButton>
                            )}
                          <AppButton
                            variant={sub ? "secondary" : "primary"}
                            size="sm"
                            onClick={() => openSubmitModal(d)}
                          >
                            {sub ? "Resubmit" : "Submit"}
                          </AppButton>
                        </div>
                      </div>
                    </AppCard>
                  );
                })}
          </div>
        )}

        {/* ============================================
            TAB: TASKS (Team Workspace)
            ============================================ */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-[var(--brand-orange)]" />
                Team Tasks
              </h3>
              <AppButton
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingTask(null);
                  setTaskForm({
                    title: "",
                    description: "",
                    priority: "medium",
                    assigned_to: "",
                  });
                  setShowTaskModal(true);
                }}
              >
                Add Task
              </AppButton>
            </div>

            {/* Progress bar */}
            {tasks.length > 0 && (
              <AppCard padding="md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Progress ({tasks.filter((t) => t.status === "done").length}/
                    {tasks.length})
                  </span>
                  <span className="text-[10px] font-black text-[var(--brand-orange)]">
                    {tasks.length > 0
                      ? Math.round(
                          (tasks.filter((t) => t.status === "done").length /
                            tasks.length) *
                            100,
                        )
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${tasks.length > 0 ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : 0}%`,
                      background: "var(--brand-orange)",
                    }}
                  />
                </div>
              </AppCard>
            )}

            {/* Task columns */}
            {tasksLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--text-tertiary)]" />
              </div>
            ) : tasks.length === 0 ? (
              renderEmpty(
                <ListTodo className="w-6 h-6 text-[var(--text-tertiary)]" />,
                "No Tasks Yet",
                "Create tasks to track your team's work.",
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    status: "todo",
                    label: "To Do",
                    icon: AlertCircle,
                    accent: "amber",
                  },
                  {
                    status: "in_progress",
                    label: "In Progress",
                    icon: Activity,
                    accent: "indigo",
                  },
                  {
                    status: "done",
                    label: "Done",
                    icon: CheckCircle2,
                    accent: "emerald",
                  },
                ].map((col) => {
                  const colTasks = tasks.filter((t) => t.status === col.status);
                  return (
                    <div key={col.status}>
                      <div className="flex items-center gap-2 mb-3">
                        <col.icon
                          className={`w-4 h-4 text-${col.accent}-500`}
                        />
                        <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                          {col.label}
                        </span>
                        <span className="text-[9px] font-bold text-[var(--text-tertiary)]">
                          {colTasks.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {colTasks.map((task) => {
                          const priorityColors = {
                            critical: {
                              bg: "bg-red-500/10",
                              text: "text-red-500",
                            },
                            high: {
                              bg: "bg-amber-500/10",
                              text: "text-amber-500",
                            },
                            medium: {
                              bg: "bg-blue-500/10",
                              text: "text-blue-500",
                            },
                            low: {
                              bg: "bg-slate-500/10",
                              text: "text-slate-500",
                            },
                          };
                          const pc =
                            priorityColors[task.priority] ||
                            priorityColors.medium;
                          return (
                            <AppCard key={task.id} padding="md" hover>
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-bold text-[var(--text-primary)] flex-1">
                                    {task.title}
                                  </p>
                                  <div className="flex items-center gap-1">
                                    {/* Status cycle button */}
                                    {task.status !== "done" && (
                                      <button
                                        onClick={() =>
                                          handleUpdateTaskStatus(
                                            task.id,
                                            task.status === "todo"
                                              ? "in_progress"
                                              : "done",
                                          )
                                        }
                                        className="p-1 rounded hover:bg-[var(--surface-3)] transition-colors text-[var(--text-tertiary)] hover:text-emerald-500"
                                        title={
                                          task.status === "todo"
                                            ? "Move to In Progress"
                                            : "Mark Done"
                                        }
                                      >
                                        <ChevronRight className="w-3 h-3" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteTask(task.id)}
                                      className="p-1 rounded hover:bg-rose-500/10 transition-colors text-[var(--text-tertiary)] hover:text-rose-500"
                                      title="Delete task"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                {task.description && (
                                  <p className="text-[10px] text-[var(--text-tertiary)] line-clamp-2">
                                    {task.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${pc.bg} ${pc.text}`}
                                  >
                                    {task.priority}
                                  </span>
                                  {task.assigned_name && (
                                    <span className="text-[9px] font-medium text-[var(--text-secondary)]">
                                      {task.assigned_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </AppCard>
                          );
                        })}
                        {colTasks.length === 0 && (
                          <div className="p-4 rounded-xl border border-dashed border-[var(--border-primary)] text-center">
                            <p className="text-[10px] text-[var(--text-tertiary)] font-bold">
                              No tasks
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================
            TAB: FILES
            ============================================ */}
        {activeTab === "files" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                Shared Files & Resources
              </h3>
            </div>
            {!program?.resources_link &&
            !program?.pitch_deck_url &&
            !program?.demo_link ? (
              renderEmpty(
                <BookOpen className="w-6 h-6 text-[var(--text-tertiary)]" />,
                "No Files Yet",
                "Shared files and resources will appear here.",
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {program?.pitch_deck_url && (
                  <AppCard padding="md" hover>
                    <a
                      href={program.pitch_deck_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-rose-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          Pitch Deck
                        </p>
                        <p className="text-[9px] text-[var(--text-tertiary)]">
                          View presentation
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--text-tertiary)] ml-auto" />
                    </a>
                  </AppCard>
                )}
                {program?.demo_link && (
                  <AppCard padding="md" hover>
                    <a
                      href={program.demo_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          Live Demo
                        </p>
                        <p className="text-[9px] text-[var(--text-tertiary)]">
                          Open application
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--text-tertiary)] ml-auto" />
                    </a>
                  </AppCard>
                )}
                {program?.resources_link && (
                  <AppCard padding="md" hover>
                    <a
                      href={program.resources_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          Resources
                        </p>
                        <p className="text-[9px] text-[var(--text-tertiary)]">
                          Shared materials
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--text-tertiary)] ml-auto" />
                    </a>
                  </AppCard>
                )}
              </div>
            )}

            {/* Submission files list */}
            {Object.values(submissions)
              .flat()
              .some((s) => s.file_url) && (
              <div className="mt-6">
                <h4 className="text-xs font-black text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                  Submitted Files
                </h4>
                <div className="space-y-2">
                  {Object.entries(submissions).map(([delId, subs]) =>
                    subs
                      .filter((s) => s.file_url)
                      .map((s, i) => (
                        <div
                          key={`${delId}-${i}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-3)]"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-[var(--text-tertiary)]" />
                            <div>
                              <p className="text-xs font-bold text-[var(--text-primary)]">
                                {deliverables.find((d) => d.id === delId)
                                  ?.title || "File"}
                              </p>
                              <p className="text-[9px] text-[var(--text-tertiary)]">
                                {fmtDate(s.created_at)}
                              </p>
                            </div>
                          </div>
                          <a
                            href={s.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-bold text-[var(--brand-blue)] hover:underline"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </a>
                        </div>
                      )),
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================
            TAB: CALENDAR
            ============================================ */}
        {activeTab === "calendar" && (
          <div className="space-y-6">
            {/* Upcoming Deadlines */}
            <AppCard padding="lg">
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <Flag className="w-4 h-4 text-[var(--brand-orange)]" />
                Upcoming Deadlines
              </h3>
              {upcomingDeadlines.length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)] font-bold">
                  No upcoming deadlines.
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingDeadlines.map((d) => {
                    const sub = getSubmissionStatus(d.id);
                    const isUrgent =
                      d._date &&
                      new Date(d._date) - new Date() < 3 * 24 * 60 * 60 * 1000;
                    return (
                      <div
                        key={d.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-3)]"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              isUrgent ? "bg-rose-500" : "bg-amber-500"
                            }`}
                          />
                          <div>
                            <p className="text-xs font-bold text-[var(--text-primary)]">
                              {d.title}
                            </p>
                            <p className="text-[9px] text-[var(--text-tertiary)]">
                              Week {d.week_number || "?"}
                              {d.description ? ` — ${d.description}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {sub ? (
                            <AppStatusBadge
                              status={sub.status}
                              variant="minimal"
                            />
                          ) : (
                            <span className="text-[10px] font-black text-amber-500 uppercase">
                              Pending
                            </span>
                          )}
                          <span className="text-[10px] font-black text-[var(--text-primary)]">
                            {fmtDate(d._date)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AppCard>

            {/* Past submissions */}
            <AppCard padding="lg">
              <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <History className="w-4 h-4 text-[var(--text-secondary)]" />
                Past Activity
              </h3>
              {Object.values(submissions).flat().length === 0 ? (
                <p className="text-xs text-[var(--text-tertiary)] font-bold">
                  No submission activity yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(submissions)
                    .flatMap(([delId, subs]) =>
                      subs.map((s) => ({ ...s, _delId: delId })),
                    )
                    .sort(
                      (a, b) => new Date(b.created_at) - new Date(a.created_at),
                    )
                    .slice(0, 10)
                    .map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-primary)]"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-4 h-4 text-[var(--text-tertiary)]" />
                          <div>
                            <p className="text-xs font-bold text-[var(--text-primary)]">
                              {deliverables.find((d) => d.id === s._delId)
                                ?.title || "Submission"}
                            </p>
                            <p className="text-[9px] text-[var(--text-tertiary)]">
                              {fmtDate(s.created_at)}
                            </p>
                          </div>
                        </div>
                        <AppStatusBadge
                          status={s.status || "pending"}
                          variant="minimal"
                        />
                      </div>
                    ))}
                </div>
              )}
            </AppCard>
          </div>
        )}

        {/* ============================================
            SUBMIT MODAL
            ============================================ */}
        {showSubmitModal && selectedDeliverable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSubmitModal(false)}
            />
            <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                  Submit Deliverable
                </h3>
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] transition-colors text-[var(--text-secondary)]"
                >
                  <ChevronRight className="w-4 h-4 rotate-45" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)] mb-1">
                    {selectedDeliverable.title}
                  </p>
                  {selectedDeliverable.description && (
                    <p className="text-[10px] text-[var(--text-tertiary)]">
                      {selectedDeliverable.description}
                    </p>
                  )}
                </div>

                {/* File Upload */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Upload File
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.jpg,.png,.mp4"
                    />
                    <div className="w-full bg-[var(--surface-2)] border border-dashed border-[var(--border-primary)] rounded-xl px-4 py-6 text-center hover:border-[var(--brand-orange)] transition-colors">
                      {uploading ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-[var(--brand-orange)]" />
                          <span className="text-xs font-bold text-[var(--text-secondary)]">
                            Uploading...
                          </span>
                        </div>
                      ) : submitFileUrl ? (
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-bold text-emerald-500">
                            File uploaded
                          </span>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-5 h-5 text-[var(--text-tertiary)] mx-auto mb-1" />
                          <span className="text-xs font-bold text-[var(--text-tertiary)]">
                            Click to upload
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Or Link */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Or Paste Link
                  </label>
                  <input
                    type="url"
                    value={submitLink}
                    onChange={(e) => setSubmitLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 transition-colors"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 px-6 pb-5">
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="px-5 py-2.5 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest rounded-xl hover:bg-[var(--surface-3)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitDeliverable}
                  disabled={submitting || (!submitFileUrl && !submitLink)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[var(--brand-orange)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================
            COACHING REVIEW MODAL
            ============================================ */}
        {showReviewModal && reviewSubData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setShowReviewModal(false);
                setShowFollowUpModal(false);
              }}
            />
            <div className="relative w-full max-w-lg bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                  Review Submission
                </h3>
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setShowFollowUpModal(false);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] transition-colors text-[var(--text-secondary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">
                    {reviewSubData._deliverable?.title || "Deliverable"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <AppStatusBadge
                      status={reviewSubData.status || "pending"}
                      variant="minimal"
                    />
                    {reviewSubData.file_url && (
                      <a
                        href={reviewSubData.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-[var(--brand-blue)] hover:underline"
                      >
                        View File <ExternalLink className="w-3 h-3 inline" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Feedback
                  </label>
                  <textarea
                    value={reviewFeedback}
                    onChange={(e) => setReviewFeedback(e.target.value)}
                    placeholder="Write feedback for the team..."
                    rows={3}
                    className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 transition-colors resize-none"
                  />
                </div>

                {showFollowUpModal && (
                  <div className="space-y-2 p-3 rounded-xl bg-[var(--surface-3)]">
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Schedule Follow-up
                    </label>
                    <input
                      type="datetime-local"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60 transition-colors"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 px-6 pb-5 flex-wrap">
                <AppButton
                  variant="primary"
                  size="sm"
                  icon={CheckCircle2}
                  onClick={() => handleReviewAction("approved")}
                  disabled={reviewing}
                >
                  Accept
                </AppButton>
                <AppButton
                  variant="secondary"
                  size="sm"
                  icon={History}
                  onClick={() => handleReviewAction("revision_requested")}
                  disabled={reviewing}
                >
                  Request Revision
                </AppButton>
                <AppButton
                  variant="secondary"
                  size="sm"
                  icon={X}
                  onClick={() => handleReviewAction("rejected")}
                  disabled={reviewing}
                  style={{ color: "var(--chart-danger)" }}
                >
                  Reject
                </AppButton>
                {showFollowUpModal ? (
                  <AppButton
                    variant="primary"
                    size="sm"
                    icon={Calendar}
                    onClick={() => handleReviewAction("follow_up", true)}
                    disabled={reviewing || !followUpDate}
                  >
                    {reviewing ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                      </>
                    ) : (
                      "Confirm Follow-up"
                    )}
                  </AppButton>
                ) : (
                  <AppButton
                    variant="secondary"
                    size="sm"
                    icon={Calendar}
                    onClick={() => setShowFollowUpModal(true)}
                    disabled={reviewing}
                  >
                    Schedule Follow-up
                  </AppButton>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================
            TASK CREATION MODAL
            ============================================ */}
        {showTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowTaskModal(false)}
            />
            <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                  {editingTask ? "Edit Task" : "New Task"}
                </h3>
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] transition-colors text-[var(--text-secondary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Title
                  </label>
                  <input
                    value={taskForm.title}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, title: e.target.value })
                    }
                    placeholder="Task title..."
                    className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                    Description
                  </label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, description: e.target.value })
                    }
                    placeholder="Optional description..."
                    rows={2}
                    className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--brand-orange)]/60 transition-colors resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Priority
                    </label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) =>
                        setTaskForm({ ...taskForm, priority: e.target.value })
                      }
                      className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                      Assign To
                    </label>
                    <select
                      value={taskForm.assigned_to}
                      onChange={(e) =>
                        setTaskForm({
                          ...taskForm,
                          assigned_to: e.target.value,
                        })
                      }
                      className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]/60 transition-colors appearance-none cursor-pointer"
                    >
                      <option value="">Anyone</option>
                      {members.map((m) => (
                        <option key={m.cid || m.id} value={m.cid || m.id}>
                          {m.name || m.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 pb-5">
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="px-5 py-2.5 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest rounded-xl hover:bg-[var(--surface-3)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTask}
                  disabled={savingTask || !taskForm.title.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[var(--brand-orange)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {savingTask ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Create
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
