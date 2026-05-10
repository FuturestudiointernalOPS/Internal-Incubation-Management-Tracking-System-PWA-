'use client';

import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Briefcase, Plus, Search, Loader2, ChevronRight, 
  User, Shield, Users, Calendar, Activity, X, Edit3, BookOpen, 
  Archive, RotateCcw, Trash2, Settings, ArrowLeft,
  Zap, MessageSquare, Upload, FileText, Copy, Signal, Info, Globe, Mail
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

/**
 * IMPACTOS MISSION CONTROL ÔÇö PROGRAM MANAGEMENT
 * Centralized governance for operational programs, cohorts, and personnel assignments.
 * Optimized for Supabase-PostgreSQL with progressive skeleton states.
 */

export default function ProgramManagement() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setTab] = useState('active'); 
  const [editingProgram, setEditingProgram] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState([]);
  const [teams, setTeams] = useState([]);

  const router = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [progRes, managerRes, segmentRes] = await Promise.all([
        fetch(`/api/pm/programs?show_archived=${activeTab === 'archived'}&status=${activeTab === 'active' ? 'all' : activeTab}`),
        fetch('/api/contacts/full-state'),
        fetch('/api/families')
      ]);
      
      const [progData, managerData, segmentData] = await Promise.all([
        progRes.json(), managerRes.json(), segmentRes.json()
      ]);
      
      if (progData.success) setPrograms(progData.programs || []);
      if (managerData.success) {
        const managers = (managerData.contacts || []).filter(c => 
          c.role === 'super_admin' || c.role === 'program_manager'
        );
        setTeams(managers); // Used for managers list
      }
      if (segmentData.success) setNotes(segmentData.families || []); // Used for segments list
      
    } catch (e) {
      console.error("Sync Failure:", e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const res = await fetch('/api/pm/programs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProgram)
      });
      if ((await res.json()).success) {
        setEditingProgram(null);
        fetchData();
      }
    } catch (e) {} finally { setIsUpdating(false); }
  };

  const handleArchiveAction = async (id, isArchiving, e) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/pm/programs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_archived: isArchiving ? 1 : 0, action: 'archive' })
      });
      if ((await res.json()).success) fetchData();
    } catch (e) {}
  };

  const handlePermanentDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Permanent deletion protocol initialized. Are you sure?")) return;
    try {
      const res = await fetch('/api/pm/programs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if ((await res.json()).success) fetchData();
    } catch (e) {}
  };

  const filtered = programs.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout role="super_admin" activeTab="programs">
      <div className="space-y-10 pb-20 animate-in text-left">
        
        {/* HEADER SECTION */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
          <div className="space-y-4">
            <button 
               onClick={() => router.push('/admin')}
               className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
               <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Signal className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-[0.4em]">Administration</span>
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-[var(--text-primary)]">PROGRAMS DASHBOARD</h1>
            </div>
          </div>
          
          <div className="flex gap-3">
             <button 
                onClick={() => router.push('/admin/standardization')}
                className="btn btn-secondary gap-2"
             >
                <Settings className="w-4 h-4" /> Settings
             </button>
             <button 
                onClick={() => router.push('/admin/programs/new')}
                className="btn btn-primary gap-2"
             >
                <Plus className="w-4 h-4" /> Create Program
             </button>
          </div>
        </header>

        {/* CONTROLS & TABS */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex gap-2 p-1 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)]">
            {[
              { id: 'active', label: 'All Programs' },
              { id: 'archived', label: 'Archived' },
              { id: 'cohorts', label: 'Teams' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`px-6 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-[var(--brand-orange)] text-black shadow-lg shadow-orange-500/20' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Search by program name..." 
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
            />
          </div>
        </div>

        {/* DYNAMIC CONTENT */}
        {loading ? (
          <TableSkeleton rows={10} />
        ) : (
          <div className="table-container">
            {activeTab === 'active' || activeTab === 'archived' ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Program Details</th>
                    <th>Status</th>
                    <th>Lead Manager</th>
                    <th>Engagement</th>
                    <th className="text-right">Administration</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="group cursor-pointer hover:bg-[var(--bg-secondary)]" onClick={() => router.push(`/admin/programs/${p.id}`)}>
                      <td>
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)]">
                              <Signal className="w-5 h-5" />
                           </div>
                           <div className="flex flex-col">
                              <span className="text-base font-bold text-[var(--text-primary)] uppercase tracking-tight">{p.name}</span>
                              <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5 line-clamp-1 max-w-xs">{p.description}</span>
                           </div>
                        </div>
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${p.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>
                           {p.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                           <User className="w-3 h-3 text-[var(--brand-orange)]" />
                           <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">{p.pm_name || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td>
                         <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                               <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">{p.participants_count || 0} Members</span>
                               <span className="text-[9px] font-bold text-[var(--brand-orange)] uppercase mt-0.5">{Math.round(p.completion_index || 0)}% Progress</span>
                            </div>
                            <div className="w-16 h-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                               <div className="h-full bg-[var(--brand-orange)]" style={{ width: `${p.completion_index || 0}%` }} />
                            </div>
                         </div>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          {activeTab === 'archived' ? (
                            <>
                              <button onClick={(e) => handleArchiveAction(p.id, false, e)} title="Restore" className="p-2 hover:text-emerald-500"><RotateCcw className="w-4 h-4" /></button>
                              <button onClick={(e) => handlePermanentDelete(p.id, e)} title="Delete" className="p-2 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); setEditingProgram(p); }} title="Edit" className="p-2 hover:text-[var(--brand-orange)]"><Edit3 className="w-4 h-4" /></button>
                              <button onClick={(e) => handleArchiveAction(p.id, true, e)} title="Archive" className="p-2 hover:text-orange-500"><Archive className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Personnel</th>
                    <th>Operational Role</th>
                    <th>Communication</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map(t => (
                    <tr key={t.cid}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-indigo-400">
                            <User className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight">{t.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{t.role || 'Staff Member'}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 text-slate-500">
                          <Mail className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-xs">{t.email}</span>
                        </div>
                      </td>
                      <td className="text-right">
                        <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest ${t.status === 'active' || t.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                           {t.status?.toUpperCase() || 'PENDING'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* MODALS SECTION */}
      {editingProgram && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <div className="card w-full max-w-xl space-y-8 border-[var(--brand-orange)]/30 animate-in text-left">
            <div className="flex justify-between items-center">
              <div>
                 <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-tight">Edit Program Details</h3>
                 <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">Program ID: {editingProgram.id}</p>
              </div>
              <button onClick={() => setEditingProgram(null)} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">Program Name</label>
                 <input 
                    value={editingProgram.name} 
                    onChange={e => setEditingProgram({...editingProgram, name: e.target.value})} 
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                 />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">Lead Program Manager</label>
                  <select 
                    value={editingProgram.assigned_pm_id || ''} 
                    onChange={e => setEditingProgram({...editingProgram, assigned_pm_id: e.target.value})} 
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] appearance-none"
                  >
                    <option value="">Unassigned</option>
                    {teams.map(m => <option key={m.cid} value={m.cid}>{m.name.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">Duration (Weeks)</label>
                  <input 
                    type="number"
                    value={editingProgram.duration_weeks || 4} 
                    onChange={e => setEditingProgram({...editingProgram, duration_weeks: parseInt(e.target.value)})} 
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                  />
                </div>
              </div>

              <div className="space-y-3">
                 <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">Operational Teams (Segments)</label>
                 <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-primary)]">
                    {notes.map(s => {
                      const isAssigned = s.program_id === editingProgram.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            const newSegments = [...(editingProgram.assigned_segments || [])];
                            if (newSegments.includes(s.id)) {
                              setEditingProgram({...editingProgram, assigned_segments: newSegments.filter(id => id !== s.id)});
                            } else {
                              setEditingProgram({...editingProgram, assigned_segments: [...newSegments, s.id]});
                            }
                          }}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                            (editingProgram.assigned_segments || []).includes(s.id) 
                              ? 'bg-[var(--brand-orange)]/10 border-[var(--brand-orange)] text-[var(--brand-orange)]' 
                              : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span className="text-[9px] font-bold uppercase truncate">{s.name}</span>
                        </button>
                      );
                    })}
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2">Program Description</label>
                 <textarea 
                    rows={3}
                    value={editingProgram.description} 
                    onChange={e => setEditingProgram({...editingProgram, description: e.target.value})} 
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none"
                 />
              </div>
              <button type="submit" disabled={isUpdating} className="btn btn-primary w-full py-5 uppercase font-bold tracking-[0.2em]">
                {isUpdating ? <div className="flex items-center justify-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /> <span>Saving Changes...</span></div> : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
