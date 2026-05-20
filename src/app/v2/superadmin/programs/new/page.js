'use client';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, Plus, Loader2, ArrowLeft,
  CheckCircle, Shield, AlertTriangle, BookOpen, User, Users, Upload, Target, Trash2, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * CREATE NEW PROGRAM
 * Allows linking course materials and assigning leadership during creation.
 */
export default function CreateProgram() {
  const [form, setForm] = useState({ 
    name: '', 
    description: '', 
    note_id: '',
    assigned_pm_id: '',
    assigned_assistant_ids: [], // Changed to array
    duration_weeks: 4,
    materials: [] // Added for manual uploads
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState([]);
  const [staff, setStaff] = useState([]);
  const [tempAssistants, setTempAssistants] = useState([]); // Track selected tags
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', url: '' });
  const [newKnowledge, setNewKnowledge] = useState({ title: '', description: '' });
  const [createInlineGroup, setCreateInlineGroup] = useState(false);
  const [createInlineKnowledge, setCreateInlineKnowledge] = useState(false);
  const [kpisList, setKpisList] = useState([]);
  const [kpiInput, setKpiInput] = useState({ title: '', target_value: 80 });
  const router = useRouter();

  useEffect(() => {
    fetchMetadata();
  }, []);

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
        setStaff((staffData.contacts || []).filter(c => c.group_name?.toUpperCase() === 'FUTURE STUDIO'));
      }
    } catch (e) {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const payload = { 
        ...form, 
        assigned_assistant_id: JSON.stringify(tempAssistants.map(a => a.cid)),
        materials: uploadedFiles,
        new_group: createInlineGroup ? newGroup : null,
        new_knowledge: createInlineKnowledge ? newKnowledge : null,
        kpis: kpisList
      };
      const res = await fetch('/api/v2/pm/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: 'Program deployed successfully.' } 
        }));
        setTimeout(() => router.push('/v2/superadmin/programs'), 1000);
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'error', message: data.error || 'Failed to deploy mission node.' } 
        }));
      }
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: 'Network or System Security Exception during deployment.' } 
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <DashboardLayout role="super_admin" activeTab="list_programs">
      <div className="max-w-4xl mx-auto space-y-12 pb-20">
        
        <header className="flex justify-between items-end border-b border-white/5 pb-10">
          <div>
            <button onClick={() => router.push('/v2/superadmin/programs')} className="flex items-center gap-2 text-slate-500 hover:text-[#FF6600] transition-all font-black text-[9px] uppercase tracking-widest mb-6">
              <ArrowLeft className="w-3 h-3" /> Back to Registry
            </button>
            <div className="flex items-center gap-4 mb-4">
               <Shield className="w-5 h-5 text-[#FF6600]" />
               <span className="text-[#FF6600] font-black text-[10px] uppercase tracking-[0.4em]">Strategic Deployment</span>
            </div>
            <h2 className="text-6xl font-black text-white tracking-tighter uppercase leading-none italic">New Mission</h2>
            <p className="text-slate-500 font-bold max-w-xl opacity-60 mt-4">Initialize a new operational program and assign executive leadership.</p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-12">
          
          <div className="ios-card !p-12 space-y-10 border-white/10 bg-white/[0.02]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Program Identity</label>
                <input 
                  required 
                  placeholder="Ex: Executive Leadership 2026"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white outline-none focus:border-[#FF6600] transition-all font-bold text-lg"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Duration (Weeks)</label>
                <input 
                  type="number"
                  required 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-white outline-none focus:border-[#FF6600] transition-all font-bold text-lg"
                  value={form.duration_weeks}
                  onChange={e => setForm({...form, duration_weeks: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Concept Overview</label>
              <textarea 
                rows={5}
                required 
                placeholder="Architect the program objectives and conceptual framework..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-6 text-white outline-none focus:border-[#FF6600] transition-all font-bold leading-relaxed resize-none"
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="ios-card !p-10 space-y-8 border-white/10">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-[#FF6600]">
                     <BookOpen className="w-5 h-5" />
                     <span className="text-[10px] font-black uppercase tracking-widest">Instructional Asset</span>
                  </div>
                  <button 
                     type="button"
                     onClick={() => setCreateInlineKnowledge(!createInlineKnowledge)}
                     className={`text-[8px] font-black uppercase px-3 py-1 rounded-lg border transition-all ${createInlineKnowledge ? 'bg-[#FF6600] text-black border-[#FF6600]' : 'bg-white/5 text-slate-500 border-white/10 hover:border-[#FF6600]/50'}`}
                  >
                     {createInlineKnowledge ? 'Cancel New Node' : '+ Create New Node'}
                  </button>
               </div>

               {createInlineKnowledge ? (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-6 bg-[#FF6600]/5 border border-[#FF6600]/10 rounded-2xl">
                     <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">New Knowledge Title</label>
                        <input 
                           placeholder="Ex: Fundamentals of Scaling..."
                           className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#FF6600] text-xs font-bold"
                           value={newKnowledge.title}
                           onChange={e => setNewKnowledge({...newKnowledge, title: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Summary Description</label>
                        <textarea 
                           rows={3}
                           placeholder="Brief overview of the instructional logic..."
                           className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#FF6600] text-xs font-bold resize-none"
                           value={newKnowledge.description}
                           onChange={e => setNewKnowledge({...newKnowledge, description: e.target.value})}
                        />
                     </div>
                  </motion.div>
               ) : (
                  <div className="space-y-4">
                     <select 
                       value={form.note_id}
                       onChange={e => setForm({...form, note_id: e.target.value})}
                       className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none appearance-none font-bold"
                     >
                       <option value="" className="bg-[#080810]">Link Existing Knowledge Node...</option>
                       {notes.map(n => <option key={n.id} value={n.id} className="bg-[#080810]">{n.title}</option>)}
                     </select>
                  </div>
               )}
               
               <div className="space-y-4 pt-4 border-t border-white/5">
                  <label className="flex items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-2xl hover:bg-white/5 hover:border-[#FF6600]/30 transition-all cursor-pointer group">
                     <input 
                        type="file" 
                        multiple 
                        accept=".pdf,.doc,.docx"
                        className="hidden" 
                        onChange={(e) => {
                           const files = Array.from(e.target.files);
                           files.forEach(file => {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                 setUploadedFiles(prev => [...prev, { name: file.name, data: ev.target.result }]);
                              };
                              reader.readAsDataURL(file);
                           });
                        }}
                     />
                     <div className="flex flex-col items-center gap-3">
                        <Upload className="w-6 h-6 text-slate-500 group-hover:text-[#FF6600] transition-colors" />
                        <span className="text-[8px] font-black uppercase text-slate-600 tracking-widest group-hover:text-white">Inject Manual Assets (PDF/DOC)</span>
                     </div>
                  </label>

                  {uploadedFiles.length > 0 && (
                     <div className="flex flex-wrap gap-2">
                        {uploadedFiles.map((f, i) => (
                           <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
                              <span className="text-[8px] font-black text-slate-400 truncate max-w-[150px] uppercase">{f.name}</span>
                              <button type="button" onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-rose-500 hover:text-white transition-colors">
                                 <X className="w-3 h-3" />
                              </button>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>

            <div className="ios-card !p-10 space-y-8 border-white/10">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-[#FF6600]">
                     <Users className="w-5 h-5" />
                     <span className="text-[10px] font-black uppercase tracking-widest">Mission Command</span>
                  </div>
                  <button 
                     type="button"
                     onClick={() => setCreateInlineGroup(!createInlineGroup)}
                     className={`text-[8px] font-black uppercase px-3 py-1 rounded-lg border transition-all ${createInlineGroup ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white/5 text-slate-500 border-white/10 hover:border-indigo-500/50'}`}
                  >
                     {createInlineGroup ? 'Cancel New Group' : '+ Create New Group'}
                  </button>
               </div>

               {createInlineGroup && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
                     <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">New Contact Group Name</label>
                        <input 
                           placeholder="Ex: Cohort Omega / Alpha Team..."
                           className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 text-xs font-bold"
                           value={newGroup.name}
                           onChange={e => setNewGroup({...newGroup, name: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Group Communication URL</label>
                        <input 
                           placeholder="Ex: https://wa.me/group-link / https://slack.com/..."
                           className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 text-xs font-bold"
                           value={newGroup.url}
                           onChange={e => setNewGroup({...newGroup, url: e.target.value})}
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Group Description</label>
                        <textarea 
                           rows={2}
                           placeholder="Mission-specific group oversight..."
                           className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 text-xs font-bold resize-none"
                           value={newGroup.description}
                           onChange={e => setNewGroup({...newGroup, description: e.target.value})}
                        />
                     </div>
                  </motion.div>
               )}

               <div className="space-y-6 pt-4 border-t border-white/5">
                  <div className="space-y-2">
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-2 italic">Lead Project Manager</p>
                    <select 
                      required
                      value={form.assigned_pm_id}
                      onChange={e => setForm({...form, assigned_pm_id: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none appearance-none font-bold"
                    >
                      <option value="" className="bg-[#080810]">Select Project Manager...</option>
                      {staff.map(s => <option key={s.cid} value={s.cid} className="bg-[#080810]">{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest ml-2 italic">Assign Team Members</p>
                    <select 
                      value=""
                      onChange={e => {
                         const selected = staff.find(s => s.cid === e.target.value);
                         if (selected && !tempAssistants.find(a => a.cid === selected.cid)) {
                            setTempAssistants([...tempAssistants, selected]);
                         }
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none appearance-none font-bold"
                    >
                      <option value="" className="bg-[#080810]">Add Team Members...</option>
                      {staff.map(s => <option key={s.cid} value={s.cid} className="bg-[#080810]">{s.name}</option>)}
                    </select>
                    
                    <div className="flex flex-wrap gap-2 mt-4">
                       {tempAssistants.map(a => (
                          <div key={a.cid} className="flex items-center gap-2 px-3 py-2 bg-[#FF6600]/10 border border-[#FF6600]/20 rounded-xl">
                             <span className="text-[10px] font-black text-white uppercase">{a.name}</span>
                             <button type="button" onClick={() => setTempAssistants(tempAssistants.filter(x => x.cid !== a.cid))} className="text-white hover:text-rose-500 transition-colors">
                                <X className="w-3.5 h-3.5" />
                             </button>
                          </div>
                       ))}
                    </div>
                  </div>
               </div>
            </div>
          </div>

          {/* STRATEGIC KPIs CONFIGURATION */}
          <div className="ios-card bg-[#0d0d18] border border-white/10 !p-12 space-y-8">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-xl bg-[#FF6600]/10 flex items-center justify-center text-[#FF6600]">
                      <Target className="w-5 h-5" />
                   </div>
                   <div className="text-left">
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Strategic KPIs Configuration</h3>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Define KPI targets for this program</p>
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="space-y-1 text-left md:col-span-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">KPI Target Title</label>
                   <input 
                      type="text" 
                      placeholder="e.g. Weekly Attendance Rate, Assignment Submission..."
                      value={kpiInput.title}
                      onChange={e => setKpiInput({ ...kpiInput, title: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold"
                   />
                </div>
                <div className="space-y-1 text-left">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Target Value (%)</label>
                   <div className="flex gap-3">
                      <input 
                         type="number" 
                         min="0"
                         max="100"
                         placeholder="80"
                         value={kpiInput.target_value}
                         onChange={e => setKpiInput({ ...kpiInput, target_value: parseInt(e.target.value) || 0 })}
                         className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold"
                      />
                      <button 
                         type="button"
                         onClick={() => {
                            if (!kpiInput.title.trim()) return;
                            setKpisList([...kpisList, { title: kpiInput.title, target_value: kpiInput.target_value }]);
                            setKpiInput({ title: '', target_value: 80 });
                         }}
                         className="px-6 bg-[#FF6600] text-black font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white transition-all shadow-lg shadow-[#FF6600]/10 flex items-center justify-center shrink-0"
                      >
                         <Plus className="w-4 h-4" /> Add
                      </button>
                   </div>
                </div>
             </div>

             {kpisList.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic text-left">Defined KPIs ({kpisList.length})</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {kpisList.map((kpi, idx) => (
                         <div key={idx} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-[#FF6600]/30 transition-all text-left">
                            <div>
                               <p className="text-xs font-black text-white uppercase tracking-tighter">{kpi.title}</p>
                               <p className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest mt-1">Target: {kpi.target_value}%</p>
                            </div>
                            <button 
                               type="button" 
                               onClick={() => setKpisList(kpisList.filter((_, i) => i !== idx))} 
                               className="text-slate-500 hover:text-rose-500 transition-colors p-2"
                            >
                               <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                      ))}
                   </div>
                </div>
             )}
          </div>

          <button 
            type="submit" 
            disabled={isProcessing}
            className="w-full py-8 bg-[#FF6600] text-black font-black uppercase text-[12px] tracking-[0.5em] rounded-[2.5rem] hover:bg-white transition-all shadow-2xl shadow-[#FF6600]/30 flex items-center justify-center gap-4 italic"
          >
            {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle className="w-6 h-6" /> Deploy Mission Node</>}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
