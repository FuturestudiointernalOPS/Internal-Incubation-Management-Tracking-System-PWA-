'use client';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, Plus, Search, Loader2, ChevronRight, 
  User, Shield, Users, Calendar, Activity, X, Edit3, BookOpen, 
  Archive, RotateCcw, Trash2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * ALL PROGRAMS
 * Simplified list and management of existing programs.
 */
export default function ProgramManagement() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setTab] = useState('active'); // active | archive
  
  // Edit State
  const [editingProgram, setEditingProgram] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState([]);
  const [staff, setStaff] = useState([]);

  const router = useRouter();

  useEffect(() => {
    fetchPrograms();
    fetchMetadata();
  }, []);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v2/pm/programs');
      const data = await res.json();
      if (data.success) {
        setPrograms(data.programs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const notesRes = await fetch('/api/v2/knowledge');
      const notesData = await notesRes.json();
      if (notesData.success) {
        setNotes((notesData.conceptNotes || []).filter(n => !n.is_archived));
      }

      const staffRes = await fetch('/api/v2/contacts/full-state');
      const staffData = await staffRes.json();
      if (staffData.success) {
        setStaff((staffData.contacts || []).filter(c => c.group_name?.toUpperCase() === 'STAFF'));
      }
    } catch (e) {}
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const res = await fetch('/api/v2/pm/programs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProgram)
      });
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: 'Saved successfully.' } 
        }));
        
        setTimeout(async () => {
          await fetchPrograms();
          setEditingProgram(null);
        }, 800);
      }
    } catch (e) {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
          detail: { type: 'error', message: 'Failed to save.' } 
      }));
    } finally {
      setTimeout(() => setIsUpdating(false), 200);
    }
  };

  const handleArchiveAction = async (id, isArchiving, e) => {
    e.stopPropagation();
    try {
       const res = await fetch('/api/v2/pm/programs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, is_archived: isArchiving ? 1 : 0, action: 'archive' })
       });
       const data = await res.json();
       if (data.success) {
          fetchPrograms();
          window.dispatchEvent(new CustomEvent('impactos:notify', { 
              detail: { type: 'info', message: isArchiving ? 'Archived successfully.' : 'Restored successfully.' } 
          }));
       }
    } catch (e) {
       window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'error', message: 'Action failed.' } 
       }));
    }
 };

 const handlePermanentDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure? This action cannot be undone.")) return;

    try {
       const res = await fetch('/api/v2/pm/programs', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
       });
       const data = await res.json();
       if (data.success) {
          fetchPrograms();
          window.dispatchEvent(new CustomEvent('impactos:notify', { 
              detail: { type: 'success', message: 'Deleted permanently.' } 
          }));
       }
    } catch (e) {
       window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'error', message: 'Delete failed.' } 
       }));
    }
 };

  const filtered = programs.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'archive' ? (p.is_archived === 1 || p.is_archived === true) : (!p.is_archived || p.is_archived === 0);
    return matchesSearch && matchesTab;
  });

  return (
    <DashboardLayout 
      role="super_admin" 
      activeTab="list_programs"
      modals={
        <AnimatePresence>
          {editingProgram && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="ios-card w-full max-w-xl !p-12 space-y-10 border-white/10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Edit Program</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 font-sans opacity-60">Update program details and leadership</p>
                  </div>
                  <button onClick={() => setEditingProgram(null)} className="text-slate-600 hover:text-white transition-colors underline-none"><X className="w-6 h-6" /></button>
                </div>

                <form onSubmit={handleUpdate} className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 font-sans">Program Name</label>
                    <input required value={editingProgram.name} onChange={e => setEditingProgram({...editingProgram, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-[#0066FF]/50 font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 font-sans">Description</label>
                    <textarea rows={3} value={editingProgram.description || ''} onChange={e => setEditingProgram({...editingProgram, description: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-[#0066FF]/50 font-bold resize-none" />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 font-sans">Course Material</label>
                       <select value={editingProgram.note_id || ''} onChange={e => setEditingProgram({...editingProgram, note_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none appearance-none font-bold">
                          <option value="" className="bg-[#080810]">No Material Assigned</option>
                          {notes.map(n => <option key={n.id} value={n.id} className="bg-[#080810]">{n.title}</option>)}
                       </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 font-sans">Project Manager</label>
                          <select value={editingProgram.assigned_pm_id || ''} onChange={e => setEditingProgram({...editingProgram, assigned_pm_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none appearance-none font-bold">
                             <option value="" className="bg-[#080810]">Unassigned</option>
                             {staff.map(s => <option key={s.cid} value={s.cid} className="bg-[#080810]">{s.name}</option>)}
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 font-sans">Assistant</label>
                          <select value={editingProgram.assigned_assistant_id || ''} onChange={e => setEditingProgram({...editingProgram, assigned_assistant_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none appearance-none font-bold">
                             <option value="" className="bg-[#080810]">Unassigned</option>
                             {staff.map(s => <option key={s.cid} value={s.cid} className="bg-[#080810]">{s.name}</option>)}
                          </select>
                       </div>
                    </div>
                  </div>

                  <button type="submit" disabled={isUpdating} className="w-full btn-strong !py-5 rounded-2xl flex items-center justify-center gap-3">
                    {isUpdating ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      }
    >
      <div className="space-y-12 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-4 mb-4 text-left">
               <span className="text-[#0066FF] font-black text-[10px] uppercase tracking-[0.4em]">Programs</span>
               <div className="h-px w-10 bg-[#0066FF]/30" />
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none italic">Program Registry</h2>
            <p className="text-slate-500 font-bold mt-4 uppercase text-[10px] tracking-widest leading-none font-sans opacity-60">Listing and managing all mission-critical programs</p>
          </div>
          <button onClick={() => router.push('/v2/superadmin/programs/new')} className="px-10 py-4 bg-[#0066FF] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            <span>Create Program</span>
          </button>
        </header>

        <div className="max-w-7xl mx-auto space-y-8">
           <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
              <div className="ios-card bg-white/[0.02] border-white/5 !p-4 flex items-center gap-4 w-full max-w-xl">
                 <Search className="w-5 h-5 text-slate-500 ml-4" />
                 <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search repository..." className="w-full bg-transparent border-none text-white outline-none font-bold placeholder:text-slate-600" />
              </div>

              <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                 <button onClick={() => setTab('active')} className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'active' ? 'bg-[#0066FF] text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Active</button>
                 <button onClick={() => setTab('archive')} className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${activeTab === 'archive' ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}><Archive className="w-3 h-3" /> Archive</button>
              </div>
           </div>

           {loading ? (
             <div className="py-40 text-center"><Loader2 className="w-12 h-12 text-[#0066FF] animate-spin mx-auto mb-6" /><p className="text-slate-500 font-black uppercase tracking-[0.25em]">Synchronizing...</p></div>
           ) : filtered.length === 0 ? (
             <div className="ios-card bg-white/[0.01] border-white/5 py-32 flex flex-col items-center justify-center text-center">
                <Briefcase className="w-20 h-20 text-slate-800 mb-6" />
                <h4 className="text-2xl font-black text-white uppercase mb-2">Registry is Empty</h4>
                <p className="text-slate-500 font-bold text-xs max-w-sm uppercase tracking-widest leading-relaxed font-sans">No programs found matching the selected criteria.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {filtered.map(p => (
                   <div key={p.id} className="ios-card group border-white/5 hover:border-[#0066FF]/30 transition-all relative overflow-hidden bg-white/[0.02] !p-8 flex flex-col justify-between min-h-[350px]">
                      <div>
                         <div className="flex justify-between items-start mb-6">
                            <span className={`px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest ${p.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>{p.status}</span>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                               {activeTab === 'active' ? (
                                  <>
                                     <button onClick={() => setEditingProgram(p)} className="p-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-[#0066FF] transition-all"><Edit3 className="w-5 h-5" /></button>
                                     <button onClick={(e) => handleArchiveAction(p.id, true, e)} className="p-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-orange-500 transition-all"><Archive className="w-5 h-5" /></button>
                                  </>
                               ) : (
                                  <>
                                     <button onClick={(e) => handleArchiveAction(p.id, false, e)} className="p-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-emerald-500 transition-all"><RotateCcw className="w-5 h-5" /></button>
                                     <button onClick={(e) => handlePermanentDelete(p.id, e)} className="p-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-rose-500 transition-all"><Trash2 className="w-5 h-5" /></button>
                                  </>
                               )}
                            </div>
                         </div>
                         <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-4 italic italic">{p.name}</h3>
                         <p className="text-slate-500 font-bold text-xs uppercase tracking-widest line-clamp-2 leading-relaxed font-sans opacity-80">{p.description}</p>
                         
                         {p.note_title && (
                            <div className="mt-4 flex items-center gap-2 text-[#0066FF] bg-[#0066FF]/10 w-fit px-3 py-1.5 rounded-lg border border-[#0066FF]/20">
                               <BookOpen className="w-3.5 h-3.5" />
                               <span className="text-[9px] font-black uppercase tracking-widest truncate max-w-[200px]">{p.note_title}</span>
                            </div>
                         )}
                      </div>

                      <div className="mt-8 space-y-4 pt-8 border-t border-white/5">
                         <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-xl space-y-1 border border-transparent hover:border-white/5 transition-all">
                               <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Project Manager</p>
                               <p className="text-white font-black text-xs uppercase tracking-tighter truncate">{p.pm_name || 'Unassigned'}</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-xl space-y-1 border border-transparent hover:border-white/5 transition-all">
                               <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Assistant</p>
                               <p className="text-white font-black text-xs uppercase tracking-tighter truncate">{p.assistant_name || 'Unassigned'}</p>
                            </div>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
           )}
        </div>
      </div>
    </DashboardLayout>
  );
}
