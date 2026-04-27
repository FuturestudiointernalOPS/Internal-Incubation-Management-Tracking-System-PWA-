'use client';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, Plus, Search, Loader2, ChevronRight, 
  User, Shield, Users, Calendar, Activity, X, Edit3, BookOpen, 
  Archive, RotateCcw, Trash2, Settings, ArrowLeft,
  Zap, MessageSquare, Upload, FileText
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ProgramManagement() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setTab] = useState('active'); 
  
  const [editingProgram, setEditingProgram] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState([]);
  const [staff, setStaff] = useState([]);
  const [uploadedMaterials, setUploadedMaterials] = useState([]); 
  const [extraMaterials, setExtraMaterials] = useState([]); 

  const router = useRouter();

  const [messagingProgram, setMessagingProgram] = useState(null); 
  const [signalData, setSignalData] = useState({ subject: '', body: '' });
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    fetchPrograms();
    fetchMetadata();
    fetchGlobalSchedule();
  }, []);

  const fetchGlobalSchedule = async () => {
    try {
       const res = await fetch('/api/v2/pm/schedule?is_super_admin=true');
       const data = await res.json();
       if (data.success) {
          setSchedule(data.schedule || []);
       }
    } catch (e) {}
  };

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
      const payload = { ...editingProgram, materials: [...uploadedMaterials, ...extraMaterials] };
      const res = await fetch('/api/v2/pm/programs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

  const handleSendSignal = async () => {
    if (!signalData.body || !signalData.subject) return;
    try {
      const res = await fetch('/api/v2/internal-comms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: 'program',
          target_id: messagingProgram.id,
          subject: signalData.subject,
          body: signalData.body,
          priority: 'high'
        })
      });
      if ((await res.json()).success) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: 'Signal Transmitted.' } 
        }));
        setMessagingProgram(null);
        setSignalData({ subject: '', body: '' });
      }
    } catch (e) { console.error(e); }
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
    return p.name.toLowerCase().includes(search.toLowerCase());
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
                    <input required value={editingProgram.name} onChange={e => setEditingProgram({...editingProgram, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold" />
                  </div>
                   <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 font-sans">Concept Note</label>
                    <textarea 
                      rows={6} 
                      value={editingProgram.description || ''} 
                      onChange={e => setEditingProgram({...editingProgram, description: e.target.value})} 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold resize-none leading-relaxed" 
                      placeholder="Paste document content or CONCEPT NOTE overview..."
                    />
                   </div>

                   <div className="space-y-10">
                      <div className="space-y-4">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 font-sans flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5" /> Course Material (Primary Assets)
                         </label>
                         <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                               <select 
                                  value={editingProgram.note_id || ''} 
                                  onChange={e => setEditingProgram({...editingProgram, note_id: e.target.value})} 
                                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none appearance-none font-bold"
                               >
                                  <option value="" className="bg-[#080810]">Link instructional Note...</option>
                                  {notes.map(n => <option key={n.id} value={n.id} className="bg-[#080810]">{n.title}</option>)}
                                </select>
                               
                               <label className="flex items-center justify-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-slate-500 cursor-pointer hover:bg-white/10 hover:text-white transition-all border-dashed">
                                  <input 
                                     type="file" 
                                     multiple 
                                     className="hidden" 
                                     onChange={(e) => {
                                        const files = Array.from(e.target.files);
                                        files.forEach(file => {
                                           const reader = new FileReader();
                                           reader.onload = (ev) => {
                                              setUploadedMaterials(prev => [...prev, { name: file.name, data: ev.target.result }]);
                                           };
                                           reader.readAsDataURL(file);
                                        });
                                     }} 
                                  />
                                  <Upload className="w-4 h-4 text-[#FF6600]" />
                                  <span className="text-[9px] font-black uppercase">Inject Primary</span>
                               </label>
                            </div>

                            {uploadedMaterials.length > 0 && (
                               <div className="flex flex-wrap gap-2 p-4 bg-[#FF6600]/5 border border-[#FF6600]/10 rounded-2xl">
                                  {uploadedMaterials.map((m, idx) => (
                                     <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-xl border border-white/5">
                                        <FileText className="w-3 h-3 text-[#FF6600]" />
                                        <span className="text-[8px] font-black text-white uppercase truncate max-w-[100px]">{m.name}</span>
                                        <button type="button" onClick={() => setUploadedMaterials(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-white transition-colors"><X className="w-3 h-3"/></button>
                                     </div>
                                  ))}
                               </div>
                            )}
                         </div>
                      </div>

                      <div className="space-y-4 pt-6 border-t border-white/5">
                         <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 font-sans flex items-center gap-2">
                               Extra Learning Material
                            </label>
                            <label className="px-5 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 cursor-pointer hover:bg-[#FF6600]/10 hover:text-white transition-all flex items-center gap-2">
                               <input 
                                  type="file" 
                                  multiple 
                                  className="hidden" 
                                  onChange={(e) => {
                                     const files = Array.from(e.target.files);
                                     files.forEach(file => {
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                           setExtraMaterials(prev => [...prev, { name: file.name, data: ev.target.result, isExtra: true }]);
                                        };
                                        reader.readAsDataURL(file);
                                     });
                                  }} 
                               />
                               <Plus className="w-3 h-3 text-[#FF6600]" />
                               <span className="text-[8px] font-black uppercase">Add Material</span>
                            </label>
                         </div>

                         {extraMaterials.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                               {extraMaterials.map((m, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl group hover:border-[#FF6600]/20 transition-all">
                                     <span className="text-[8px] font-black text-slate-500 uppercase truncate max-w-[120px]">{m.name}</span>
                                     <button type="button" onClick={() => setExtraMaterials(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><X className="w-3 h-3"/></button>
                                  </div>
                               ))}
                            </div>
                         )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
                         <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 font-sans">Project Manager</label>
                            <select value={editingProgram.assigned_pm_id || ''} onChange={e => setEditingProgram({...editingProgram, assigned_pm_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none appearance-none font-bold">
                               <option value="" className="bg-[#080810]">Unassigned</option>
                               {staff.map(s => <option key={s.cid} value={s.cid} className="bg-[#080810]">{s.name}</option>)}
                            </select>
                         </div>
                         <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 font-sans">Assign Team Members</label>
                            <select value={editingProgram.assigned_assistant_id || ''} onChange={e => setEditingProgram({...editingProgram, assigned_assistant_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none appearance-none font-bold">
                               <option value="" className="bg-[#080810]">Unassigned</option>
                               {staff.map(s => <option key={s.cid} value={s.cid} className="bg-[#080810]">{s.name}</option>)}
                            </select>
                            <p className="text-[9px] font-bold text-slate-600 mt-2 ml-2 italic">These are team members that will teach during the course of this program or team members that will oversee during the course of this program.</p>
                         </div>
                      </div>
                   </div>

                  <div className="flex gap-4">
                     <button 
                        type="button"
                        onClick={() => setEditingProgram(null)} 
                        className="flex-1 py-5 bg-white/5 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all italic"
                     >
                        Cancel
                     </button>
                     <button 
                        type="submit" 
                        disabled={isUpdating} 
                        className="flex-[2] py-5 bg-[#FF6600] text-black rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest italic shadow-lg shadow-[#FF6600]/20"
                     >
                        {isUpdating ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Changes'}
                     </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
          {messagingProgram && (
             <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
                <motion.div 
                   initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                   className="w-full max-w-2xl bg-[#0d0d18] border border-white/10 rounded-[3rem] p-16 shadow-2xl relative"
                >
                   <button onClick={() => setMessagingProgram(null)} className="absolute top-10 right-10 p-4 bg-white/5 rounded-2xl text-slate-600 hover:text-white transition-all transform hover:rotate-90"><X className="w-8 h-8"/></button>
                   <div className="space-y-12">
                      <div className="space-y-4">
                         <div className="flex items-center gap-4 text-left">
                            <Zap className="w-5 h-5 text-[#FF6600]" />
                            <span className="text-[11px] font-black text-[#FF6600] uppercase tracking-[0.5em] italic">Signal Protocol</span>
                         </div>
                         <h3 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none text-left">New Signal</h3>
                         <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div className="w-10 h-10 bg-[#FF6600]/10 rounded-xl flex items-center justify-center text-[#FF6600] font-black text-[10px]">TO</div>
                            <div className="text-left">
                               <p className="text-[11px] font-black text-white uppercase tracking-widest">{messagingProgram.name}</p>
                               <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Lead: {messagingProgram.pm_name || 'All Staff'}</p>
                            </div>
                         </div>
                      </div>
                      
                      <div className="space-y-6">
                         <div className="space-y-2 text-left">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2 italic">Subject Line</label>
                            <input 
                               value={signalData.subject}
                               onChange={e => setSignalData({...signalData, subject: e.target.value})}
                               placeholder="Operational Directive..." 
                               className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl text-white outline-none focus:border-[#FF6600] transition-all font-black uppercase text-sm tracking-widest" 
                            />
                         </div>
                         <div className="space-y-2 text-left">
                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2 italic">Signal Content</label>
                            <textarea 
                               rows={6} 
                               value={signalData.body}
                               onChange={e => setSignalData({...signalData, body: e.target.value})}
                               placeholder="Architect your message content..." 
                               className="w-full bg-white/5 border border-white/10 p-8 rounded-[2rem] text-white outline-none focus:border-[#FF6600] transition-all font-bold leading-relaxed resize-none shadow-inner" 
                            />
                         </div>
                         <button 
                            onClick={handleSendSignal}
                            className="w-full py-7 bg-[#FF6600] text-black font-black uppercase text-[12px] tracking-[0.4em] rounded-[2rem] hover:bg-white transition-all shadow-2xl shadow-[#FF6600]/30 italic"
                         >
                            Transmit Signal
                         </button>
                      </div>
                   </div>
                </motion.div>
             </div>
          )}
        </AnimatePresence>
      }
    >
      <div className="space-y-12 pb-20">
         <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
           <div>
            <button 
               onClick={() => router.push('/v2/superadmin/dashboard')}
               className="group flex items-center gap-2 text-slate-500 hover:text-[#FF6600] transition-all font-black text-[9px] uppercase tracking-widest mb-6"
            >
               <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
            </button>
            <div className="flex items-center gap-4 mb-4 text-left">
               <Shield className="w-5 h-5 text-[#FF6600]" />
               <span className="text-[#FF6600] font-black text-[10px] uppercase tracking-[0.4em]">Governance</span>
            </div>
            <h2 className="text-6xl font-black text-white tracking-tighter uppercase leading-none italic">Mission Control</h2>
            <p className="text-slate-500 font-bold max-w-xl opacity-60">Manage operational programs and global standardization settings.</p>
           </div>
          <div className="flex items-center gap-4">
             <button 
                onClick={() => router.push('/v2/superadmin/standardization')}
                className="px-8 py-4 bg-white/5 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-white/10 transition-all border border-white/10 flex items-center gap-2"
             >
                <Settings className="w-5 h-5" />
                <span>Global Settings</span>
             </button>
             <button 
                onClick={() => router.push('/v2/superadmin/programs/new')}
                className="px-10 py-4 bg-[#FF6600] text-black rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-white transition-all shadow-lg shadow-[#FF6600]/20 flex items-center gap-2 italic"
             >
                <Plus className="w-5 h-5" />
                <span>Create Program</span>
             </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto space-y-12">
            <div className="ios-card bg-white/[0.02] border-white/5 !p-4 flex items-center gap-4 w-full max-w-xl">
               <Search className="w-5 h-5 text-slate-500 ml-4" />
               <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search repository..." className="w-full bg-transparent border-none text-white outline-none font-bold placeholder:text-slate-600" />
            </div>

            {/* TACTICAL CALENDAR VIEW - Master Oversight */}
            <section className="ios-card bg-white/[0.01] border-white/5 !p-12 overflow-hidden shadow-2xl relative">
               <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF6600]/5 rounded-full blur-[100px] -mr-40 -mt-40" />
               <div className="flex flex-col lg:flex-row justify-between items-start gap-12 relative z-10 text-left">
                  <div className="space-y-6">
                     <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Global Operational Schedule</h3>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">Full Lifecycle Oversight (All Programs)</p>
                     
                     <div className="space-y-4 pt-6">
                        {schedule.slice(0, 3).map(item => (
                           <div key={item.id} className="flex items-center gap-6 group">
                              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center text-[10px] font-black uppercase group-hover:border-[#FF6600]/40 transition-all">
                                 <span className="text-[#FF6600]">{new Date(item.scheduled_date).getDate()}</span>
                                 <span className="text-slate-600 text-[7px]">{new Date(item.scheduled_date).toLocaleString('default', { month: 'short' })}</span>
                              </div>
                              <div className="flex-1">
                                 <p className="text-xs font-black text-white uppercase italic">{item.title}</p>
                                 <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{item.program_name}</p>
                                    <span className="text-slate-800">•</span>
                                    <p className="text-[8px] font-black text-[#FF6600] uppercase tracking-widest italic">
                                       {item.start_time || '00:00'} - {item.end_time || '23:59'}
                                    </p>
                                 </div>
                              </div>
                           </div>
                        ))}
                        {schedule.length === 0 && <p className="text-[10px] font-black text-slate-700 uppercase italic">No tactical dates anchored in registry.</p>}
                     </div>
                  </div>

                  <div className="flex-1 w-full lg:max-w-md bg-white/[0.02] border border-white/5 rounded-[2rem] p-8">
                     <div className="flex justify-between items-center mb-8">
                        <p className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest italic">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                        <div className="flex gap-2">
                           <div className="w-2 h-2 rounded-full bg-emerald-500" />
                           <div className="w-2 h-2 rounded-full bg-blue-500" />
                        </div>
                     </div>
                     <div className="grid grid-cols-7 gap-2 text-center text-[8px] font-black text-slate-600 uppercase tracking-widest mb-4">
                        {['S','M','T','W','T','F','S'].map(d => <div key={d}>{d}</div>)}
                     </div>
                     <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: 31 }, (_, i) => {
                           const d = i + 1;
                           const isToday = d === new Date().getDate();
                           const hasEvent = schedule.some(s => new Date(s.scheduled_date).getDate() === d);
                           return (
                              <div key={i} className={`aspect-square flex items-center justify-center rounded-lg text-[9px] font-black transition-all ${isToday ? 'bg-[#FF6600] text-white shadow-lg shadow-[#FF6600]/30' : hasEvent ? 'bg-[#FF6600]/20 text-[#FF6600] border border-[#FF6600]/20' : 'text-slate-800'}`}>
                                 {d}
                              </div>
                           );
                        })}
                     </div>
                  </div>
               </div>
            </section>

            {loading ? (
              <div className="py-40 text-center"><Loader2 className="w-12 h-12 text-[#FF6600] animate-spin mx-auto mb-6" /><p className="text-slate-500 font-black uppercase tracking-[0.25em]">Synchronizing...</p></div>
            ) : filtered.length === 0 ? (
              <div className="ios-card bg-white/[0.01] border-white/5 py-32 flex flex-col items-center justify-center text-center">
                 <Briefcase className="w-20 h-20 text-slate-800 mb-6" />
                 <h4 className="text-2xl font-black text-white uppercase mb-2">Registry is Empty</h4>
                 <p className="text-slate-500 font-bold text-xs max-w-sm uppercase tracking-widest leading-relaxed font-sans">No programs found matching the selected criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {filtered.map(p => (
                    <div key={p.id} className="ios-card group border-white/5 hover:border-[#FF6600]/30 transition-all relative overflow-hidden bg-white/[0.02] !p-8 flex flex-col justify-between min-h-[350px]">
                       <div>
                          <div className="flex justify-between items-start mb-6">
                             <span className={`px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest ${p.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}`}>{p.status}</span>
                             <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                 <button onClick={() => {
                                    let mats = [];
                                    try { mats = JSON.parse(p.materials || '[]'); } catch(e) {}
                                    setEditingProgram(p);
                                    setUploadedMaterials(mats.filter(m => !m.isExtra));
                                    setExtraMaterials(mats.filter(m => m.isExtra));
                                 }} className="p-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-[#FF6600] transition-all"><Edit3 className="w-5 h-5" /></button>
                                 <button onClick={(e) => handleArchiveAction(p.id, true, e)} className="p-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-orange-500 transition-all"><Archive className="w-5 h-5" /></button>
                             </div>
                          </div>
                          <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none mb-4 italic italic">{p.name}</h3>
                          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest line-clamp-2 leading-relaxed font-sans opacity-80">{p.description}</p>
                          
                          {p.note_title && (
                             <div className="mt-4 flex items-center gap-2 text-[#FF6600] bg-[#FF6600]/10 w-fit px-3 py-1.5 rounded-lg border border-[#FF6600]/20">
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
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Team Members</p>
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
