'use client';

import React, { useState, useEffect, use } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Activity, Briefcase, ChevronRight, BookOpen, 
  Target, Users, Layers, MessageSquare, Clock, CheckCircle2, AlertCircle, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function SuperAdminExecutiveView({ params }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  const router = useRouter();

  const [program, setProgram] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [reports, setReports] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [selectedSession, setSelectedSession] = useState(null);
  const [newFollowup, setNewFollowup] = useState({ week: null, session_id: null, comment: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      // 1. Program & Curriculum
      const progRes = await fetch(`/api/v2/pm/full-state?id=${id}`);
      const progData = await progRes.json();
      if (progData.success) {
        setProgram(progData.program);
        setSessions(progData.sessions || []);
        setRequirements(progData.requirements || []);
      }

      // 2. Weekly Reports
      const reportRes = await fetch(`/api/v2/teacher/reports?program_id=${id}`);
      const reportData = await reportRes.json();
      if (reportData.success) setReports(reportData.reports || []);

      // 3. Follow-ups
      const followupRes = await fetch(`/api/v2/followups?program_id=${id}`);
      const followupData = await followupRes.json();
      if (followupData.success) setFollowups(followupData.followups || []);

      setIsLoaded(true);
    } catch (e) {
      console.error(e);
      setIsLoaded(true);
    }
  };

  const handleAddFollowup = async (wn, sid = null) => {
    if (!newFollowup.comment.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v2/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: id,
          week_number: wn,
          session_id: sid,
          comment: newFollowup.comment
        })
      });
      if ((await res.json()).success) {
        setNewFollowup({ week: null, session_id: null, comment: '' });
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded || !program) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
    </div>
  );

  const weeks = Array.from({ length: program.duration_weeks || 13 }, (_, i) => i + 1);

  return (
    <DashboardLayout role="super_admin" activeTab="Progress Hub">
      <div className="space-y-12 pb-20">
        
        {/* EXECUTIVE HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-end gap-8">
          <div className="space-y-4 text-left">
             <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FF6600]/10 border border-[#FF6600]/20 flex items-center justify-center text-[#FF6600] shadow-xl">
                   <Briefcase className="w-6 h-6" />
                </div>
                <div>
                   <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">{program.name}</h2>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2 italic">Executive Oversight Portfolio · ID: {program.id}</p>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-6">
             <div className="text-right">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Lead Administrator</p>
                <p className="text-sm font-black text-white uppercase italic">{program.pm_name || 'Unassigned'}</p>
             </div>
             <div className="w-px h-8 bg-white/10" />
             <div className="text-right">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Status</p>
                <p className="text-sm font-black text-[#FF6600] uppercase italic">{program.status || 'Active'}</p>
             </div>
          </div>
        </header>

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <div className="ios-card bg-white/[0.02] border-white/5 !p-8 relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#FF6600]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 italic flex items-center gap-2">
                    Fulfillment Index 
                    <AlertCircle className="w-3 h-3 text-slate-700 cursor-help" title="Weighted: Sessions (5pt) + Assets (2pt) + Report (10pt)" />
                 </p>
                 <h4 className="text-3xl font-black text-white italic">{(program.completion_index || 0).toFixed(1)}%</h4>
                 <p className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em] mt-3 italic leading-relaxed">
                    Global Velocity Index (Weighted)
                 </p>
              </div>
           </div>
           <div className="ios-card bg-white/[0.02] border-white/5 !p-8">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 italic">Asset Submission</p>
              <h4 className="text-3xl font-black text-white italic">{requirements.filter(r => r.is_completed).length}/{requirements.length}</h4>
           </div>
           <div className="ios-card bg-white/[0.02] border-white/5 !p-8">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 italic">Tactical Reports</p>
              <h4 className="text-3xl font-black text-[#FF6600] italic">{reports.length} Logs</h4>
           </div>
           <div className="ios-card bg-[#FF6600]/5 border-[#FF6600]/20 !p-8">
              <p className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest mb-4 italic">Executive Comments</p>
              <h4 className="text-3xl font-black text-white italic">{followups.length}</h4>
           </div>
        </div>

        {/* STRATEGIC TIMELINE */}
        <div className="space-y-12">
           <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-slate-700" />
              <h3 className="text-xl font-black text-white uppercase tracking-widest italic">Mission Lifecycle Timeline</h3>
           </div>

           <div className="space-y-8 relative">
              <div className="absolute left-[27px] top-0 bottom-0 w-px bg-white/5" />
              
              {weeks.map(wn => {
                 const weekReports = reports.filter(r => r.week_number === wn);
                 const weekFollowups = followups.filter(f => f.week_number === wn);
                 const weekSessions = sessions.filter(s => s.week_number === wn);
                 const weekDocs = requirements.filter(r => r.session_id && weekSessions.map(s => s.id).includes(r.session_id));
                 
                 const completedPoints = (weekSessions.filter(s => s.status === 'completed').length * 5) + (weekDocs.filter(d => d.is_completed).length * 2) + (weekReports.length > 0 ? 10 : 0);
                 const totalPoints = (weekSessions.length * 5) + (weekDocs.length * 2) + 10;
                 const weekProgress = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

                 const isCompleted = weekSessions.length > 0 && weekSessions.every(s => s.status === 'completed');

                 return (
                    <div key={wn} className="relative pl-16">
                       {/* DOT */}
                       <div className={`absolute left-0 top-0 w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all ${
                          weekReports.length > 0 ? 'bg-[#FF6600] border-[#FF6600] text-black shadow-[0_0_20px_rgba(255,102,0,0.3)]' : 'bg-[#080810] border-white/10 text-slate-700'
                       }`}>
                          <span className="text-lg font-black">{wn}</span>
                       </div>

                       <div className="ios-card bg-white/[0.01] border-white/5 !p-10 hover:bg-white/[0.02] transition-all text-left space-y-10">
                          <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                             <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-3">
                                   <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                                      {weekSessions[0]?.title || `Phase ${wn} Operations`}
                                   </h4>
                                   {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" />}
                                </div>
                                
                                {/* WEEKLY PROGRESS BAR */}
                                <div className="space-y-3 max-w-md">
                                   <div className="flex justify-between items-end">
                                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">Phase Fulfillment</p>
                                      <p className="text-[10px] font-black text-[#FF6600] italic">{weekProgress.toFixed(0)}%</p>
                                   </div>
                                   <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                      <motion.div 
                                         initial={{ width: 0 }}
                                         animate={{ width: `${weekProgress}%` }}
                                         className={`h-full bg-gradient-to-r ${weekProgress === 100 ? 'from-emerald-500 to-emerald-400' : 'from-[#FF6600] to-[#FF9900]'}`}
                                      />
                                   </div>
                                </div>
                             </div>

                             <div className="flex flex-col lg:flex-row gap-4">
                                <div className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border flex items-center gap-2 ${
                                   weekReports.length > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                }`}>
                                   <BookOpen className="w-3 h-3" />
                                   {weekReports.length > 0 ? 'Tactical Report Secured' : 'Awaiting Tactical Report'}
                                </div>
                             </div>
                          </div>

                          {/* TACTICAL NODES & ASSETS GRID */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                             {/* NODES */}
                             <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                   <Target className="w-3.5 h-3.5 text-slate-600" />
                                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Tactical Nodes</p>
                                </div>
                                <div className="space-y-3">
                                   {weekSessions.map(session => {
                                      const sessionFollowups = followups.filter(f => f.session_id === session.id);
                                      const materials = session.resource_links ? JSON.parse(session.resource_links) : [];
                                      
                                      return (
                                         <div key={session.id} className="space-y-2">
                                            <div 
                                               onClick={() => setSelectedSession(selectedSession === session.id ? null : session.id)}
                                               className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-[#FF6600]/30 cursor-pointer transition-all"
                                            >
                                               <div className="flex items-center gap-4 text-left">
                                                  <div className={`w-2 h-2 rounded-full ${session.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : session.status === 'in progress' ? 'bg-amber-500' : 'bg-slate-800'}`} />
                                                  <div className="flex flex-col">
                                                     <p className="text-xs font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{session.title}</p>
                                                     <p className="text-[7px] font-black text-[#FF6600] uppercase tracking-widest">{session.assignment_type || 'Workshop'} Mode</p>
                                                  </div>
                                               </div>
                                               <div className="flex items-center gap-4">
                                                  {sessionFollowups.length > 0 && <MessageSquare className="w-3 h-3 text-[#FF6600] animate-pulse" />}
                                                  <ChevronRight className={`w-4 h-4 text-slate-700 transition-transform ${selectedSession === session.id ? 'rotate-90 text-[#FF6600]' : ''}`} />
                                               </div>
                                            </div>

                                            <AnimatePresence>
                                               {selectedSession === session.id && (
                                                  <motion.div 
                                                     initial={{ height: 0, opacity: 0 }}
                                                     animate={{ height: 'auto', opacity: 1 }}
                                                     exit={{ height: 0, opacity: 0 }}
                                                     className="overflow-hidden"
                                                  >
                                                     <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 ml-4 mt-2 space-y-6 text-left">
                                                        <div className="space-y-2">
                                                           <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">Node Objective</p>
                                                           <p className="text-xs text-slate-300 font-bold leading-relaxed">{session.description || 'No detailed objective provided.'}</p>
                                                        </div>

                                                        {materials.length > 0 && (
                                                           <div className="space-y-3">
                                                              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">Deployed Materials</p>
                                                              <div className="flex flex-wrap gap-2">
                                                                 {materials.map((m, idx) => (
                                                                    <a key={idx} href={m.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-[9px] font-black text-[#FF6600] uppercase tracking-widest hover:bg-[#FF6600] hover:text-black transition-all">
                                                                       {m.title || 'Resource Link'}
                                                                    </a>
                                                                 ))}
                                                              </div>
                                                           </div>
                                                        )}

                                                        {/* SESSION FEEDBACK */}
                                                        <div className="pt-4 border-t border-white/5 space-y-4">
                                                           <div className="flex justify-between items-center">
                                                              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">Node Feedback (PM Visible Only)</p>
                                                              <button 
                                                                 onClick={() => setNewFollowup({ week: wn, session_id: session.id, comment: '' })}
                                                                 className="text-[8px] font-black text-[#FF6600] uppercase tracking-widest"
                                                              >
                                                                 + Leave Comment
                                                              </button>
                                                           </div>

                                                           <div className="space-y-2">
                                                              {sessionFollowups.map(f => (
                                                                 <div key={f.id} className="p-3 rounded-xl bg-[#FF6600]/5 border border-[#FF6600]/10 flex gap-3">
                                                                    <div className="w-6 h-6 rounded-lg bg-[#FF6600]/20 flex items-center justify-center text-[#FF6600] shrink-0">
                                                                       <Target className="w-3 h-3" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                       <p className="text-[10px] text-white font-bold">{f.comment}</p>
                                                                    </div>
                                                                 </div>
                                                              ))}
                                                           </div>

                                                           {newFollowup.session_id === session.id && (
                                                              <div className="space-y-3 mt-4">
                                                                 <textarea 
                                                                    value={newFollowup.comment}
                                                                    onChange={e => setNewFollowup({...newFollowup, comment: e.target.value})}
                                                                    placeholder="Leave granular feedback on this node..."
                                                                    className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[#FF6600]/50 transition-all resize-none"
                                                                    rows={2}
                                                                 />
                                                                 <div className="flex justify-end gap-2">
                                                                    <button onClick={() => setNewFollowup({ week: null, session_id: null, comment: '' })} className="px-4 py-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest">Cancel</button>
                                                                    <button 
                                                                       disabled={isSubmitting || !newFollowup.comment.trim()}
                                                                       onClick={() => handleAddFollowup(wn, session.id)}
                                                                       className="px-4 py-1.5 bg-[#FF6600] text-black text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-white transition-all"
                                                                    >
                                                                       {isSubmitting ? '...' : 'Post'}
                                                                    </button>
                                                                 </div>
                                                              </div>
                                                           )}
                                                        </div>
                                                     </div>
                                                  </motion.div>
                                               )}
                                            </AnimatePresence>
                                         </div>
                                      );
                                   })}
                                   {weekSessions.length === 0 && <p className="text-[9px] font-bold text-slate-700 uppercase italic">No tactical nodes deployed for this phase.</p>}
                                </div>
                             </div>

                             {/* ASSETS */}
                             <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                   <Layers className="w-3.5 h-3.5 text-slate-600" />
                                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Required Assets</p>
                                </div>
                                <div className="space-y-3">
                                   {weekDocs.map(doc => (
                                      <div key={doc.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                         <div className="flex items-center gap-4">
                                            <CheckCircle2 className={`w-4 h-4 ${doc.is_completed ? 'text-emerald-500' : 'text-slate-800'}`} />
                                            <p className="text-xs font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{doc.title}</p>
                                         </div>
                                         <span className={`text-[8px] font-black uppercase tracking-widest ${doc.is_completed ? 'text-emerald-500' : 'text-slate-600'}`}>{doc.is_completed ? 'Secured' : 'Pending'}</span>
                                      </div>
                                   ))}
                                   {weekDocs.length === 0 && <p className="text-[9px] font-bold text-slate-700 uppercase italic">No asset requirements for this phase.</p>}
                                </div>
                             </div>
                          </div>

                          {/* REPORT CONTENT */}
                          {weekReports.length > 0 && (
                             <div className="mt-10 p-8 rounded-3xl bg-white/[0.03] border border-white/5 space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                   <MessageSquare className="w-4 h-4 text-[#FF6600]" />
                                   <p className="text-[10px] font-black text-white uppercase tracking-widest">Program Manager Insights</p>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                   <div className="space-y-2">
                                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">Operational Notes</p>
                                      <p className="text-sm text-slate-200 font-bold leading-relaxed">{weekReports[0].progress_notes}</p>
                                   </div>
                                   <div className="space-y-2">
                                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">Executive Summary</p>
                                      <p className="text-sm text-slate-200 font-bold leading-relaxed">{weekReports[0].action_taken}</p>
                                   </div>
                                </div>
                             </div>
                          )}

                          {/* FOLLOW-UPS (SUPER ADMIN COMMENTS) */}
                          <div className="mt-10 pt-10 border-t border-white/5 space-y-6">
                             <div className="flex items-center justify-between">
                                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Executive Follow-ups</h5>
                                <button 
                                   onClick={() => setNewFollowup({ week: wn, comment: '' })}
                                   className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest hover:text-white transition-colors"
                                >
                                   + Add Comment
                                </button>
                             </div>

                             <div className="space-y-4">
                                {weekFollowups.map(f => (
                                   <div key={f.id} className="p-5 rounded-2xl bg-[#FF6600]/5 border border-[#FF6600]/10 flex gap-4">
                                      <div className="w-8 h-8 rounded-lg bg-[#FF6600]/20 flex items-center justify-center text-[#FF6600] shrink-0">
                                         <Users className="w-4 h-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                         <p className="text-xs text-white font-bold">{f.comment}</p>
                                         <p className="text-[8px] font-black text-[#FF6600]/50 uppercase mt-2">{new Date(f.created_at).toLocaleString()}</p>
                                      </div>
                                   </div>
                                ))}

                                {newFollowup.week === wn && (
                                   <motion.div 
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="space-y-4"
                                   >
                                      <textarea 
                                         value={newFollowup.comment}
                                         onChange={e => setNewFollowup({...newFollowup, comment: e.target.value})}
                                         placeholder="Enter executive decision or follow-up comment..."
                                         className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm font-bold text-white outline-none focus:border-[#FF6600]/50 transition-all resize-none"
                                         rows={3}
                                      />
                                      <div className="flex justify-end gap-3">
                                         <button 
                                            onClick={() => setNewFollowup({ week: null, comment: '' })}
                                            className="px-6 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest"
                                         >
                                            Cancel
                                         </button>
                                         <button 
                                            disabled={isSubmitting || !newFollowup.comment.trim()}
                                            onClick={() => handleAddFollowup(wn)}
                                            className="px-6 py-2 bg-[#FF6600] text-black text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-white transition-all disabled:opacity-50"
                                         >
                                            {isSubmitting ? 'Syncing...' : 'Post Follow-up'}
                                         </button>
                                      </div>
                                   </motion.div>
                                )}

                                {weekFollowups.length === 0 && !newFollowup.week && (
                                   <div className="flex items-center gap-3 text-slate-700">
                                      <AlertCircle className="w-3 h-3" />
                                      <p className="text-[9px] font-black uppercase italic tracking-widest">No strategic follow-ups recorded for this phase.</p>
                                   </div>
                                )}
                             </div>
                          </div>
                       </div>
                    </div>
                 );
              })}
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
