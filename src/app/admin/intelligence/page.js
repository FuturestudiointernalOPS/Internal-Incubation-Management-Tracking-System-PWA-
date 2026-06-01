"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3, Search, Filter, Users, ArrowLeft, ListTodo, Shield,
  CheckCircle2, AlertTriangle, Clock, RefreshCw, Briefcase, TrendingUp,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";

export default function AdminIntelligence() {
  const router = useRouter();
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userTasks, setUserTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/analytics/users");
      const data = await res.json();
      if (data.success) setUsers(data.users || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (search && !u.name?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [users, search]);

  const handleUserClick = async (user) => {
    setSelectedUser(user);
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/tasks?user_id=${user.id}`);
      const data = await res.json();
      if (data.success) setUserTasks(data.tasks || []);
    } catch (e) { console.error(e); }
    finally { setTasksLoading(false); }
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20 text-left">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-8">
          <div className="space-y-2">
            <button onClick={() => router.push("/admin")} className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest">
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> {t('navigation.dashboard')}
            </button>
            <div className="flex items-center gap-2 mt-2">
              <TrendingUp className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">Intelligence</span>
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Individual Performance</h1>
          </div>
          <button onClick={fetchUsers} className="p-2 rounded-xl hover:bg-white/5 transition-all"><RefreshCw className="w-4 h-4 text-slate-500" /></button>
        </header>

        {selectedUser ? (
          <div className="space-y-6">
            <button onClick={() => { setSelectedUser(null); setUserTasks([]); }} className="text-[9px] font-black text-[var(--brand-orange)] uppercase hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back to Overview
            </button>

            <div className="card p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-lg font-black text-[var(--brand-orange)]">
                  {selectedUser.name?.charAt(0) || "?"}
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">{selectedUser.name}</h2>
                  <p className="text-[10px] text-slate-500">{selectedUser.tasks.total} tasks · {selectedUser.projects} projects · {selectedUser.independentTasks} independent</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t('reports.completed')}</p>
                  <p className="text-2xl font-black text-emerald-500">{selectedUser.completionRate}%</p>
                  <p className="text-[8px] text-slate-500">{selectedUser.tasks.completed}/{selectedUser.tasks.total} tasks</p>
                </div>
                <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t('reports.carriedOver')}</p>
                  <p className="text-2xl font-black text-amber-500">{selectedUser.carryoverRate}%</p>
                  <p className="text-[8px] text-slate-500">{selectedUser.tasks.carried_over} carried over</p>
                </div>
                <div className="p-4 bg-rose-500/5 rounded-xl border border-rose-500/20">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t('reports.blockers')}</p>
                  <p className="text-2xl font-black text-rose-500">{selectedUser.blockers.active}</p>
                  <p className="text-[8px] text-slate-500">{selectedUser.blockers.total} total</p>
                </div>
                <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Compliance</p>
                  <p className="text-2xl font-black text-blue-500">{selectedUser.complianceScore}</p>
                  <p className="text-[8px] text-slate-500">last 4 weeks</p>
                </div>
              </div>
            </div>

            <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">Tasks</h3>
            {tasksLoading ? <TableSkeleton rows={4} /> : userTasks.length === 0 ? (
              <div className="card py-16 text-center opacity-40"><ListTodo className="w-12 h-12 mx-auto mb-3" /><p className="text-[10px] font-bold uppercase">No tasks</p></div>
            ) : (
              <div className="card !p-0 overflow-hidden">
                <table className="w-full">
                  <thead><tr className="border-b border-[var(--border-primary)]">
                    <th className="text-left p-4 text-[8px] font-black text-slate-500 uppercase">Task</th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase">Status</th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase">Project</th>
                    <th className="text-center p-4 text-[8px] font-black text-slate-500 uppercase">Blockers</th>
                  </tr></thead>
                  <tbody>
                    {userTasks.map(task => {
                      const activeBlockers = task.blockers?.filter(b => b.status === 'active')?.length || 0;
                      const bgMap = { completed: "bg-emerald-500/10 text-emerald-500", in_progress: "bg-blue-500/10 text-blue-500", blocked: "bg-rose-500/10 text-rose-500", carried_over: "bg-amber-500/10 text-amber-500", pending: "bg-slate-500/10 text-slate-400" };
                      return (
                        <tr key={task.id} className="border-b border-[var(--border-primary)]/50 hover:bg-white/5 transition-colors">
                          <td className="p-4"><p className="text-xs font-bold uppercase tracking-tight">{task.title}</p></td>
                          <td className="text-center p-4"><span className={`text-[8px] font-black uppercase px-2 py-1 rounded ${bgMap[task.status] || 'bg-slate-500/10'}`}>{task.status.replace(/_/g, ' ')}</span></td>
                          <td className="text-center p-4"><span className="text-[9px] text-indigo-500">{task.project_id ? 'Project' : 'Independent'}</span></td>
                          <td className="text-center p-4">{activeBlockers > 0 ? <span className="text-rose-500 font-bold">{activeBlockers}</span> : <span className="text-slate-600">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.search')} className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all" />
            </div>

            {loading ? <TableSkeleton rows={6} /> : filteredUsers.length === 0 ? (
              <div className="card py-32 text-center opacity-40"><Users className="w-16 h-16 mx-auto mb-4" /><p className="text-[10px] font-bold uppercase">No user data found</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsers.map(user => (
                  <button key={user.id} onClick={() => handleUserClick(user)} className="card text-left hover:border-[var(--brand-orange)]/30 transition-all p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center text-sm font-black uppercase">{user.name?.charAt(0) || "?"}</div>
                      <div>
                        <p className="text-sm font-black uppercase tracking-tight">{user.name}</p>
                        <p className="text-[9px] text-slate-500">{user.tasks.total} tasks · {user.projects} projects</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-black text-emerald-500">{user.completionRate}%</p>
                        <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Done</p>
                      </div>
                      <div>
                        <p className="text-lg font-black text-amber-500">{user.carryoverRate}%</p>
                        <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Carry</p>
                      </div>
                      <div>
                        <p className={`text-lg font-black ${user.blockers.active > 0 ? 'text-rose-500' : 'text-slate-600'}`}>{user.blockers.active}</p>
                        <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Blocked</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${user.completionRate}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
