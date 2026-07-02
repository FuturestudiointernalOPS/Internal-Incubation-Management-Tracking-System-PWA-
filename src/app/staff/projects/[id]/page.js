"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Briefcase,
  Shield,
  ListTodo,
  Users,
  Activity,
  Clock,
  FileText,
  Calendar,
  User,
  RefreshCw,
  Target,
  Send,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import TaskManager from "@/components/tasks/TaskManager";

const STATUS_COLORS = {
  Active: "text-emerald-500",
  Completed: "text-purple-500",
  Paused: "text-amber-500",
  Archived: "text-slate-500",
};
const STATUS_BG = {
  Active: "bg-emerald-500/10",
  Completed: "bg-purple-500/10",
  Paused: "bg-amber-500/10",
  Archived: "bg-slate-500/10",
};

export default function StaffProjectDetail() {
  const router = useRouter();
  const params = useParams();
  const { t } = useI18n();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [blockerFilter, setBlockerFilter] = useState("all");
  const [updates, setUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    accomplishments: "",
    current_focus: "",
    blockers: "",
    next_steps: "",
    overall_status: "on_track",
    notes: "",
  });
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem("user") || "{}"));
    } catch (_) {}
  }, []);

  const projectId = params?.id;

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`);
      const data = await res.json();
      if (data.success) setProject(data.project);
      else setError(data.error || "Failed to load project");
    } catch (e) {
      setError("Network error loading project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchUpdates = useCallback(async () => {
    if (!projectId) return;
    setUpdatesLoading(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/updates`);
      const data = await res.json();
      if (data.success) setUpdates(data.updates || []);
    } catch (_) {}
    setUpdatesLoading(false);
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);
  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  const handleSubmitUpdate = async () => {
    if (!updateForm.accomplishments && !updateForm.current_focus) return;
    setSavingUpdate(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updateForm,
          user_id: user?.cid || user?.id || "unknown",
          user_name: user?.name || "Staff",
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUpdates();
        setUpdateForm({ accomplishments: "", current_focus: "", blockers: "", next_steps: "", overall_status: "on_track", notes: "" });
      }
    } catch (_) {}
    setSavingUpdate(false);
  };

  if (loading) return (
    <DashboardLayout role="staff">
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
      </div>
    </DashboardLayout>
  );

  if (error || !project) return (
    <DashboardLayout role="staff">
      <div className="flex flex-col items-center justify-center py-32">
        <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
        <p className="text-base font-black text-rose-500">{error || "Project not found"}</p>
        <button onClick={() => router.push("/staff/projects")} className="mt-6 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[9px] font-black uppercase tracking-widest">
          <ArrowLeft className="w-3.5 h-3.5 inline mr-2" />Back to Projects
        </button>
      </div>
    </DashboardLayout>
  );

  const tasks = project.tasks || [];
  const blockers = project.blockers || [];
  const members = project.members || [];
  const timeline = project.timeline || [];
  const activeBlockersCount = blockers.filter((b) => b.status === "active").length;

  const filteredBlockers = blockerFilter === "all" ? blockers : blockers.filter((b) => b.status === blockerFilter);

  return (
    <DashboardLayout role="staff">
      <div className="space-y-8 pb-20 text-left">
        {/* Header */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-3">
            <button onClick={() => router.push("/staff/projects")} className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest">
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> All Projects
            </button>
            <div className="flex items-center gap-3 mt-1">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[var(--brand-orange)]" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl lg:text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{project.name}</h1>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded ${STATUS_BG[project.status] || "bg-slate-500/10"} ${STATUS_COLORS[project.status] || "text-slate-400"}`}>{project.status}</span>
                </div>
                <div className="flex items-center gap-4 mt-1.5">
                  {project.owner_name && <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]"><User className="w-3 h-3" /><span className="font-bold">{project.owner_name}</span></div>}
                  {project.start_date && <div className="flex items-center gap-1.5 text-[10px] text-emerald-400"><Calendar className="w-3 h-3" /><span className="font-bold">Start {new Date(project.start_date).toLocaleDateString()}</span></div>}
                  {project.end_date && <div className="flex items-center gap-1.5 text-[10px] text-amber-400"><Calendar className="w-3 h-3" /><span className="font-bold">End {new Date(project.end_date).toLocaleDateString()}</span></div>}
                </div>
              </div>
            </div>
          </div>
          <button onClick={fetchProject} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-primary)] hover:bg-tertiary transition-all text-[9px] font-black uppercase tracking-widest">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card flex items-center gap-3 p-4"><div className="p-2.5 rounded-xl bg-emerald-500/10"><Target className="w-4 h-4 text-emerald-500" /></div><div><p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Progress</p><p className="text-xl font-black text-emerald-500">{project.completionRate || 0}%</p></div></div>
          <div className="card flex items-center gap-3 p-4"><div className="p-2.5 rounded-xl bg-white/5"><ListTodo className="w-4 h-4 text-[var(--text-primary)]" /></div><div><p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Tasks</p><p className="text-xl font-black">{project.taskStats?.total || 0}</p></div></div>
          <div className="card flex items-center gap-3 p-4"><div className="p-2.5 rounded-xl bg-rose-500/10"><Shield className="w-4 h-4 text-rose-500" /></div><div><p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Blockers</p><p className="text-xl font-black text-rose-500">{activeBlockersCount}</p></div></div>
          <div className="card flex items-center gap-3 p-4"><div className="p-2.5 rounded-xl bg-blue-500/10"><Users className="w-4 h-4 text-blue-500" /></div><div><p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Team</p><p className="text-xl font-black text-blue-500">{members.length}</p></div></div>
        </div>

        {/* Tabs */}
        <div className="relative">
          <div className="overflow-x-auto custom-scrollbar pb-1">
            <div className="flex items-center gap-1 border-b border-[var(--border-primary)] min-w-max px-2">
              {[
                { id: "overview", label: "OVERVIEW", icon: Activity },
                { id: "tasks", label: `TASKS (${tasks.length})`, icon: ListTodo },
                { id: "blockers", label: `BLOCKERS (${blockers.length})`, icon: Shield },
                { id: "team", label: `TEAM (${members.length})`, icon: Users },
                { id: "updates", label: "UPDATE", icon: FileText },
                { id: "timeline", label: "TIMELINE", icon: Clock },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const TabIcon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-3 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 -mb-[1px] shrink-0 whitespace-nowrap ${isActive ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-slate-500 hover:text-[var(--text-primary)]"}`}>
                    <TabIcon className="w-3 h-3 shrink-0" />{tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="card space-y-3">
              <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Overall Progress</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${project.completionRate || 0}%` }} />
                </div>
                <span className="text-sm font-black text-emerald-500">{project.completionRate || 0}%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[{ label: "Active", key: "in_progress", color: "text-blue-500", bg: "bg-blue-500/10" },
                { label: "Blocked", key: "blocked", color: "text-rose-500", bg: "bg-rose-500/10" },
                { label: "Pending", key: "pending", color: "text-slate-500", bg: "bg-slate-500/10" },
                { label: "Done", key: "completed", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { label: "Carryover", key: "carried_over", color: "text-amber-500", bg: "bg-amber-500/10" },
              ].map(({ label, key, color, bg }) => {
                const count = tasks.filter((t) => t.status === key).length;
                return (
                  <div key={key} className={`card p-4 ${bg}`}>
                    <p className={`text-2xl font-black ${color}`}>{count}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">{label}</p>
                  </div>
                );
              })}
            </div>
            {tasks.length > 0 && (
              <div className="card">
                <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Latest Tasks</h3>
                <div className="space-y-2">
                  {tasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-all">
                      <div className={`w-2 h-2 rounded-full ${task.status === "completed" ? "bg-emerald-500" : task.status === "blocked" ? "bg-rose-500" : task.status === "in_progress" ? "bg-blue-500" : "bg-slate-500"}`} />
                      <span className="text-[11px] font-bold text-[var(--text-primary)] flex-1 truncate">{task.title}</span>
                      <span className="text-[9px] text-[var(--text-secondary)]">{task.assignee_name || task.user_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TASKS */}
        {activeTab === "tasks" && (
          <TaskManager
            mode="project"
            projectId={project.id}
            userId={user?.cid || user?.id || ""}
            userName={user?.name || "Staff"}
            projects={[{ id: project.id, name: project.name }]}
            projectMembers={members}
            taskList={project.tasks || []}
            onTasksChange={fetchProject}
            showCarryOver={false}
          />
        )}

        {/* BLOCKERS */}
        {activeTab === "blockers" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              {[{ id: "all", label: `All (${blockers.length})` }, { id: "active", label: `Active (${blockers.filter((b) => b.status === "active").length})` }, { id: "resolved", label: `Resolved (${blockers.filter((b) => b.status === "resolved").length})` }].map((f) => (
                <button key={f.id} onClick={() => setBlockerFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${blockerFilter === f.id ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary text-slate-500 hover:text-[var(--text-primary)]"}`}>{f.label}</button>
              ))}
            </div>
            {filteredBlockers.length === 0 ? (
              <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50"><Shield className="w-12 h-12 mb-3" /><p className="text-[10px] font-bold uppercase tracking-widest">No blockers found</p></div>
            ) : (
              <div className="space-y-2">
                {filteredBlockers.map((blocker) => (
                  <div key={blocker.id} className={`card flex items-start gap-3 p-4 border-l-4 ${blocker.status === "active" ? "border-l-rose-500" : "border-l-emerald-500"}`}>
                    <div className={`p-2 rounded-lg ${blocker.status === "active" ? "bg-rose-500/10" : "bg-emerald-500/10"}`}><Shield className={`w-4 h-4 ${blocker.status === "active" ? "text-rose-500" : "text-emerald-500"}`} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-[var(--text-primary)]">{blocker.title}</p>
                      {blocker.task_title && <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">Task: {blocker.task_title}</p>}
                      {blocker.user_name && <p className="text-[8px] text-slate-500 mt-0.5">Raised by {blocker.user_name}</p>}
                    </div>
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${blocker.status === "active" ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"}`}>{blocker.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TEAM */}
        {activeTab === "team" && (
          <div className="space-y-2">
            {members.length === 0 ? (
              <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50"><Users className="w-12 h-12 mb-3" /><p className="text-[10px] font-bold uppercase tracking-widest">No team members</p></div>
            ) : (
              members.map((m, i) => (
                <div key={i} className="card flex items-center gap-3 p-4">
                  <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-black text-[var(--text-primary)]">{(m.name || "?").charAt(0).toUpperCase()}</div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold text-[var(--text-primary)]">{m.name || m.member_id || "Unknown"}</p>
                    {m.email && <p className="text-[9px] text-[var(--text-secondary)]">{m.email}</p>}
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${m.member_role === "lead" ? "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" : "bg-slate-500/10 text-slate-500"}`}>{m.member_role || "member"}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* UPDATES */}
        {activeTab === "updates" && (
          <div className="space-y-6">
            <div className="card space-y-4">
              <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">Post Weekly Update</h3>
              <div>
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Status</label>
                <select value={updateForm.overall_status} onChange={(e) => setUpdateForm((p) => ({ ...p, overall_status: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none">
                  <option value="on_track">On Track</option>
                  <option value="at_risk">At Risk</option>
                  <option value="blocked">Blocked</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              {[{ key: "accomplishments", label: "Accomplishments" }, { key: "current_focus", label: "Current Focus" }, { key: "blockers", label: "Blockers" }, { key: "next_steps", label: "Next Steps" }, { key: "notes", label: "Notes" }].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block">{label}</label>
                  <textarea value={updateForm[key]} onChange={(e) => setUpdateForm((p) => ({ ...p, [key]: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] outline-none resize-none" />
                </div>
              ))}
              <button onClick={handleSubmitUpdate} disabled={savingUpdate || (!updateForm.accomplishments && !updateForm.current_focus)}
                className="w-full py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-30 flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />{savingUpdate ? "Saving..." : "Submit Update"}
              </button>
            </div>
            {updates.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-widest">History ({updates.length})</h3>
                {updates.map((u) => (
                  <div key={u.id} className="card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-[var(--text-primary)]">Week {u.week_number}, {u.year}</span>
                      <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${u.overall_status === "on_track" ? "bg-emerald-500/10 text-emerald-500" : u.overall_status === "at_risk" ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"}`}>{u.overall_status}</span>
                    </div>
                    {u.accomplishments && <p className="text-[10px] text-[var(--text-secondary)]"><span className="font-bold text-[var(--text-primary)]">Done:</span> {u.accomplishments}</p>}
                    {u.current_focus && <p className="text-[10px] text-[var(--text-secondary)]"><span className="font-bold text-[var(--text-primary)]">Focus:</span> {u.current_focus}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TIMELINE */}
        {activeTab === "timeline" && (
          <div className="space-y-3">
            {timeline.length === 0 ? (
              <div className="card py-16 flex flex-col items-center justify-center text-center opacity-50"><Clock className="w-12 h-12 mb-3" /><p className="text-[10px] font-bold uppercase tracking-widest">No activity yet</p><p className="text-[9px] text-slate-500 mt-1">Task assignments, completions, and updates will appear here.</p></div>
            ) : (
              timeline.map((entry, i) => (
                <div key={entry.id || i} className="card flex items-start gap-3 p-4">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-[var(--brand-orange)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[var(--text-primary)]">{entry.description || entry.action_type}</p>
                    {entry.task_title && <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">Task: {entry.task_title}</p>}
                    {entry.actor_name && <p className="text-[8px] text-slate-500 mt-0.5">By {entry.actor_name}</p>}
                  </div>
                  <span className="text-[8px] text-slate-500 shrink-0">{new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
