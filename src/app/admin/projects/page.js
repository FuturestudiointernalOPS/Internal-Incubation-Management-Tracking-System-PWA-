"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3,
  Search,
  Filter,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
  ListTodo,
  Shield,
  RefreshCw,
  TrendingUp,
  Users,
  Target,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";

/**
 * SUPER ADMIN PROJECTS DASHBOARD
 *
 * Full visibility into all projects with task/blocker aggregation.
 * Shows: project progress, task completion rate, blocker count, timeline health.
 */

const STATUS_COLORS = {
  Active: "text-emerald-500",
  Completed: "text-purple-500",
  Paused: "text-amber-500",
};

const STATUS_BG = {
  Active: "bg-emerald-500/10",
  Completed: "bg-purple-500/10",
  Paused: "bg-amber-500/10",
};

export default function AdminProjects() {
  const router = useRouter();
  const { t } = useI18n();
  const [projects, setProjects] = useState([]);
  const [totals, setTotals] = useState({
    totalTasks: 0,
    completedTasks: 0,
    totalBlockers: 0,
    activeBlockers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [analytics, setAnalytics] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(null);
  const [allStaff, setAllStaff] = useState([]);
  const [projectMembers, setProjectMembers] = useState({});
  const [newProject, setNewProject] = useState({
    name: "",
    type: "",
    lead: "",
  });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editProject, setEditProject] = useState({
    id: null,
    name: "",
    type: "",
    status: "Active",
    lead: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (toast) setTimeout(() => setToast(null), 3000);
  }, [toast]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const projRes = await fetch("/api/admin/projects");
      const projData = await projRes.json();
      if (projData.success) {
        setProjects(projData.projects || []);
        setTotals(projData.totals || {});
      }
      // Analytics endpoint is optional - silently handle if not available
      try {
        const analyticsRes = await fetch("/api/admin/analytics");
        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json();
          if (analyticsData.success) setAnalytics(analyticsData.analytics);
        }
      } catch (e) {
        /* analytics unavailable */
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      if (data.success)
        setAllStaff(
          data.contacts?.filter(
            (c) => c.status === "active" && c.role !== "participant",
          ) || [],
        );
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchMembers = useCallback(async (projectId) => {
    try {
      const res = await fetch(`/api/projects/members?project_id=${projectId}`);
      const data = await res.json();
      if (data.success)
        setProjectMembers((prev) => ({
          ...prev,
          [projectId]: data.members || [],
        }));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSaveProject = async () => {
    if (!editProject.name.trim() || !editProject.id) return;
    setSavingEdit(true);
    try {
      await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editProject.id,
          name: editProject.name.trim(),
          type: editProject.type || null,
          status: editProject.status,
          assigned_pm_id: editProject.lead || null,
        }),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProject.name.trim(),
          type: newProject.type || null,
          assigned_pm_id: newProject.lead || null,
          status: "Active",
        }),
      });
      const data = await res.json();
      if (data.success && data.project_id) {
        // Add selected members
        let memberError = false;
        for (const memberId of selectedMembers) {
          try {
            await fetch("/api/projects/members", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                project_id: data.project_id,
                user_cid: memberId,
                role: "member",
              }),
            });
          } catch (e) {
            memberError = true;
          }
        }
        setShowCreateModal(false);
        setNewProject({ name: "", type: "", lead: "" });
        setSelectedMembers([]);
        fetchData();
        setToast({
          type: "success",
          msg: `Project "${newProject.name.trim()}" created successfully!`,
        });
      } else {
        setToast({
          type: "error",
          msg: data.error || "Failed to create project.",
        });
      }
    } catch (e) {
      setToast({ type: "error", msg: "Network error creating project." });
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveMember = async (projectId, userCid) => {
    try {
      await fetch(
        `/api/projects/members?project_id=${projectId}&user_cid=${userCid}`,
        { method: "DELETE" },
      );
      fetchMembers(projectId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddMember = async (projectId, userCid) => {
    try {
      await fetch("/api/projects/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          user_cid: userCid,
          role: "member",
        }),
      });
      fetchMembers(projectId);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch = p.name
        ?.toLowerCase()
        .includes(search.toLowerCase());
      const matchesStatus = filterStatus === "all" || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [projects, search, filterStatus]);

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20 text-left">
        {/* HEADER */}
        {/* Toast notification */}
        {toast && (
          <div
            className={`fixed top-6 right-6 z-[999] px-5 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest animate-in ${toast.type === "success" ? "bg-emerald-500 text-black" : "bg-rose-500 text-white"}`}
          >
            {toast.msg}
          </div>
        )}

        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <button
              onClick={() => router.push("/admin")}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
              {t("navigation.dashboard")}
            </button>
            <div className="flex items-center gap-2 mt-2">
              <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">
                Internal Operations
              </span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Projects
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
              <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-xs font-black">
                {projects.length} Projects
              </span>
            </div>
            <button
              onClick={() => {
                setShowCreateModal(true);
                fetchStaff();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Create Project
            </button>
            <button
              onClick={fetchData}
              className="p-2 rounded-xl hover:bg-white/5 transition-all"
              title={t("common.refresh")}
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </header>

        {/* ANALYTICS ROW */}
        {analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="card flex items-center gap-3 p-3">
              <div className="p-2 rounded-xl bg-white/5">
                <ListTodo className="w-3.5 h-3.5 text-[var(--text-primary)]" />
              </div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                  {t("reports.tasks")}
                </p>
                <p className="text-base font-black">{analytics.tasks.total}</p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-3">
              <div className="p-2 rounded-xl bg-emerald-500/10">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                  {t("reports.completed")}
                </p>
                <p className="text-base font-black text-emerald-500">
                  {analytics.completionRate}%
                </p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-3">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                  {t("reports.carriedOver")}
                </p>
                <p className="text-base font-black text-amber-500">
                  {analytics.carryoverRate}%
                </p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-3">
              <div className="p-2 rounded-xl bg-rose-500/10">
                <Shield className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                  {t("reports.active")}
                </p>
                <p className="text-base font-black text-rose-500">
                  {analytics.blockers.active}
                </p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-3">
              <div className="p-2 rounded-xl bg-blue-500/10">
                <Users className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                  {t("reports.teamMembers")}
                </p>
                <p className="text-base font-black text-blue-500">
                  {analytics.activeUsers}
                </p>
              </div>
            </div>
            <div className="card flex items-center gap-3 p-3">
              <div className="p-2 rounded-xl bg-indigo-500/10">
                <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div>
                <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                  {t("admin.activePrograms")}
                </p>
                <p className="text-base font-black text-indigo-500">
                  {analytics.projects}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Paused">Paused</option>
            </select>
          </div>
        </div>

        {/* PROJECTS TABLE */}
        {loading ? (
          <TableSkeleton rows={6} />
        ) : filteredProjects.length === 0 ? (
          <div className="card py-32 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
            <Briefcase className="w-16 h-16 mb-4" />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              No projects found
            </p>
            <p className="text-[9px] text-slate-500 mt-2">
              Projects appear here once tasks are linked to them.
            </p>
          </div>
        ) : (
          <div className="card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Project
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Status
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Tasks
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Completed
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Blockers
                    </th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project) => (
                    <tr
                      key={project.id}
                      className="border-b border-[var(--border-primary)]/50 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() =>
                        router.push(`/admin/projects/${project.id}`)
                      }
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setShowMemberModal(project.id);
                        setEditProject({
                          id: project.id,
                          name: project.name || "",
                          type: project.type || "",
                          status: project.status || "Active",
                          lead: project.assigned_pm_id || "",
                        });
                        fetchMembers(project.id);
                        fetchStaff();
                      }}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)]">
                            <Briefcase className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-tight text-[var(--text-primary)]">
                              {project.name}
                            </p>
                            <p className="text-[9px] text-slate-500">
                              {project.type || "Incubation"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center p-4">
                        <span
                          className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${STATUS_BG[project.status] || "bg-slate-500/10"} ${STATUS_COLORS[project.status] || "text-slate-400"}`}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td className="text-center p-4">
                        <span className="text-sm font-black">
                          {project.taskStats?.total || 0}
                        </span>
                      </td>
                      <td className="text-center p-4">
                        <span className="text-sm font-black text-emerald-500">
                          {project.completionRate || 0}%
                        </span>
                      </td>
                      <td className="text-center p-4">
                        <div className="flex items-center justify-center gap-1">
                          <Shield
                            className={`w-3 h-3 ${project.blockerStats?.active > 0 ? "text-rose-500" : "text-slate-600"}`}
                          />
                          <span
                            className={`text-sm font-black ${project.blockerStats?.active > 0 ? "text-rose-500" : "text-slate-600"}`}
                          >
                            {project.blockerStats?.active || 0}
                          </span>
                          {project.blockerStats?.total > 0 && (
                            <span className="text-[8px] text-slate-500">
                              / {project.blockerStats.total}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{
                                width: `${project.completionRate || 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 w-8 text-right">
                            {project.completionRate || 0}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* PROJECT EDITOR + COLLABORATORS MODAL */}
      {showMemberModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowMemberModal(null)}
        >
          <div
            className="card w-full max-w-lg space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                Edit Project
              </h2>
              <button onClick={() => setShowMemberModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Editable project fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Project Name
                </label>
                <input
                  value={editProject.name}
                  onChange={(e) =>
                    setEditProject((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>
              <div>
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Type
                </label>
                <input
                  value={editProject.type}
                  onChange={(e) =>
                    setEditProject((p) => ({ ...p, type: e.target.value }))
                  }
                  placeholder="Internal, Client, R&D"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>
              <div>
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Status
                </label>
                <select
                  value={editProject.status}
                  onChange={(e) =>
                    setEditProject((p) => ({ ...p, status: e.target.value }))
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Project Lead
                </label>
                <select
                  value={editProject.lead}
                  onChange={(e) =>
                    setEditProject((p) => ({ ...p, lead: e.target.value }))
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-xs font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
                >
                  <option value="">No lead</option>
                  {allStaff.map((s) => (
                    <option key={s.cid || s.id} value={s.cid || s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSaveProject}
              disabled={savingEdit || !editProject.name.trim()}
              className="w-full py-2.5 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
            >
              {savingEdit ? "Saving..." : "Save Changes"}
            </button>

            {/* Collaborators */}
            <div className="pt-3 border-t border-[var(--border-primary)]/30">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Collaborators
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto mb-3">
                {(projectMembers[showMemberModal] || []).length === 0 ? (
                  <p className="text-[10px] text-slate-600 italic text-center py-4">
                    No collaborators assigned yet.
                  </p>
                ) : (
                  (projectMembers[showMemberModal] || []).map((m) => (
                    <div
                      key={m.user_cid}
                      className="flex items-center justify-between p-2 rounded-lg bg-tertiary/50"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[7px] font-black uppercase">
                          {m.name?.charAt(0) || "?"}
                        </div>
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">
                          {m.name || m.user_cid}
                        </span>
                        <span className="text-[7px] text-slate-500 uppercase">
                          {m.role}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          handleRemoveMember(showMemberModal, m.user_cid)
                        }
                        className="text-[7px] font-black uppercase text-rose-400 hover:text-rose-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <select
                  id="add-collab-select"
                  className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
                >
                  <option value="">Add collaborator...</option>
                  {allStaff
                    .filter(
                      (s) =>
                        !(projectMembers[showMemberModal] || []).find(
                          (m) => m.user_cid === (s.cid || s.id),
                        ),
                    )
                    .map((s) => (
                      <option key={s.cid || s.id} value={s.cid || s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => {
                    const sel = document.getElementById("add-collab-select");
                    if (sel?.value) {
                      handleAddMember(showMemberModal, sel.value);
                      sel.value = "";
                    }
                  }}
                  className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:brightness-110"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="card w-full max-w-lg space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                Create Project
              </h2>
              <button onClick={() => setShowCreateModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Project Name *
                </label>
                <input
                  value={newProject.name}
                  onChange={(e) =>
                    setNewProject((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Website Redesign"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Type
                </label>
                <input
                  value={newProject.type}
                  onChange={(e) =>
                    setNewProject((p) => ({ ...p, type: e.target.value }))
                  }
                  placeholder="e.g. Internal, Client, R&D"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-xs font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Project Lead
                </label>
                <select
                  value={newProject.lead}
                  onChange={(e) =>
                    setNewProject((p) => ({ ...p, lead: e.target.value }))
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-xs font-bold outline-none text-[var(--text-primary)] appearance-none cursor-pointer"
                >
                  <option value="">No lead</option>
                  {allStaff.map((s) => (
                    <option key={s.cid || s.id} value={s.cid || s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Collaborators ({selectedMembers.length} selected)
                </label>
                <div className="max-h-32 overflow-y-auto space-y-1 border border-[var(--border-primary)] rounded-lg p-2">
                  {allStaff.map((s) => {
                    const sid = s.cid || s.id;
                    const isSelected = selectedMembers.includes(sid);
                    return (
                      <label
                        key={sid}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-tertiary cursor-pointer text-[10px]"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            setSelectedMembers((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== sid)
                                : [...prev, sid],
                            )
                          }
                          className="accent-[var(--brand-orange)]"
                        />
                        <span className="font-bold">{s.name}</span>
                        <span className="text-slate-500">{s.role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 btn btn-secondary py-3 text-[10px] font-black uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={creating || !newProject.name.trim()}
                className="flex-1 btn btn-primary py-3 text-[10px] font-black uppercase tracking-widest"
              >
                {creating ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
