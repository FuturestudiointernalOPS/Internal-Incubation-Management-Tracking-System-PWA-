'use client';

import React, { useState, useEffect } from 'react';
import { 
  Rocket, Layers, Target, CheckCircle2, Lock, 
  ChevronRight, MessageSquare, ExternalLink, 
  Activity, Calendar, Shield, Zap, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

/**
 * PARTICIPANT PORTAL — VERSION 2
 * Core interaction layer for students.
 */
export default function ParticipantV2Dashboard() {
  const router = useRouter();
  
  // State for data
  const [program, setProgram] = useState(null);
  const [metrics, setMetrics] = useState({ percentComplete: 0, currentWeek: 1 });
  const [deliverables, setDeliverables] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for feedback modal
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedback, setFeedback] = useState({ learnings: '', challenges: '', suggestions: '' });

  // Mocked ID for demonstration (In production, derived from session)
  const programId = "P-2026-ALPHA"; 
  const participantId = "PART-DEMO";

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Parallel fetch for speed
      const [progRes, delRes, subRes, metRes, sesRes] = await Promise.all([
        fetch(`/api/v2/programs`),
        fetch(`/api/v2/deliverables?program_id=${programId}`),
        fetch(`/api/v2/submissions?participant_id=${participantId}`),
        fetch(`/api/v2/progress?program_id=${programId}&participant_id=${participantId}`),
        fetch(`/api/v2/sessions?program_id=${programId}`)
      ]);

      const progData = await progRes.json();
      const delData = await delRes.json();
      const subData = await subRes.json();
      const metData = await metRes.json();
      const sesData = await sesRes.json();

      setProgram(progData.programs?.[0]); // Taking first for demo
      setDeliverables(delData.deliverables || []);
      setSubmissions(subData.submissions || []);
      setMetrics(metData.metrics || { percentComplete: 0, currentWeek: 1 });
      setSessions(sesData.sessions || []);
      
      setIsLoading(false);
    } catch (e) {
      console.error("Dashboard sync failure", e);
    }
  };

  const handleSubmitLink = async (delId) => {
     const link = prompt("Enter submission anchor (URL):");
     if (!link) return;

     try {
        const res = await fetch('/api/v2/submissions', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              program_id: programId,
              deliverable_id: delId,
              participant_id: participantId,
              submission_link: link
           })
        });
        const data = await res.json();
        if (data.success) {
           alert("Lifecycle node submitted for evaluation.");
           fetchDashboardData();
        }
     } catch (e) { alert("Submission failed."); }
  };

  const handleSendFeedback = async () => {
     try {
        const res = await fetch('/api/v2/feedback', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              program_id: programId,
              participant_id: participantId,
              ...feedback
           })
        });
        const data = await res.json();
        if (data.success) {
           alert("Pulse data synchronized to HQ.");
           setShowFeedbackModal(false);
           setFeedback({ learnings: '', challenges: '', suggestions: '' });
        }
     } catch (e) { alert("Pulse sync failed."); }
  };

  if (isLoading) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
     </div>
  );

  return (
    <DashboardLayout role="participant" activeTab="v2">
      <div className="space-y-12">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-10 border-b border-white/5 pb-10">
          <div className="animation-reveal">
            <div className="flex items-center gap-4 mb-4">
               <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Participant Portal</span>
               <div className="h-px w-10 bg-indigo-500/30" />
               <span className="badge badge-glow-indigo uppercase text-[8px] font-black">WEEK {metrics.currentWeek}</span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none mb-4">
              {program?.name}
            </h2>
            <div className="flex items-center gap-6">
               <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#080810] flex items-center justify-center text-[10px] font-black text-white italic">FS</div>
                  ))}
               </div>
               <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Linked Venture: Solo Node</p>
            </div>
          </div>

          <div className="w-full lg:w-72 ios-card bg-indigo-600/5 border-indigo-500/20 !p-8 flex flex-col justify-between">
             <div className="flex justify-between items-start mb-6">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Anchor Status</p>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400"><Activity className="w-4 h-4" /></div>
             </div>
             <div className="space-y-1">
                <p className="text-3xl font-black text-white italic">{metrics.percentComplete}%</p>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${metrics.percentComplete}%` }} />
                </div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest pt-2">Completion Baseline</p>
             </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
           <div className="lg:col-span-2 space-y-12">
              <section className="space-y-6">
                 <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                    <Target className="w-4 h-4 text-indigo-400" /> Evaluation Nodes
                 </h3>
                 <div className="space-y-4">
                    {deliverables.map(del => {
                       const submission = submissions.find(s => s.deliverable_id === del.id);
                       const isLocked = del.week_number > metrics.currentWeek;
                       
                       return (
                          <div 
                             key={del.id} 
                             className={`ios-card border-white/5 !p-8 flex items-center justify-between transition-all ${isLocked ? 'opacity-40 grayscale pointer-events-none' : 'bg-white/[0.02] hover:bg-white/[0.04]'}`}
                          >
                             <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black italic text-xl ${submission?.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-slate-600'}`}>
                                   W{del.week_number}
                                </div>
                                <div className="space-y-1">
                                   <h4 className="text-lg font-black text-white uppercase tracking-tighter">{del.title}</h4>
                                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                      {submission ? `Status: ${submission.status}` : 'Awaiting Submission'}
                                   </p>
                                </div>
                             </div>

                             {submission?.status === 'approved' ? (
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                             ) : isLocked ? (
                                <Lock className="w-5 h-5 text-slate-800" />
                             ) : (
                                <button 
                                   onClick={() => handleSubmitLink(del.id)}
                                   className="btn-prime !py-2 !px-6 !text-[10px]"
                                >
                                   {submission ? 'Modify Node' : 'Anchor Link'}
                                </button>
                             )}
                          </div>
                       );
                    })}
                 </div>
              </section>

              <section className="ios-card bg-mesh py-16 text-center space-y-6">
                 <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
                    <MessageSquare className="w-8 h-8" />
                 </div>
                 <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Venture Pulse</h3>
                 <p className="text-slate-500 font-bold max-w-sm mx-auto text-sm">Submit your weekly learnings and roadblocks to synchronize with HQ.</p>
                 <button 
                    onClick={() => setShowFeedbackModal(true)}
                    className="btn-prime !py-4 px-12"
                 >
                    Launch Pulse Check
                 </button>
              </section>
           </div>

           <div className="space-y-8">
              <div className="ios-card bg-[#0d0d18] border-white/5">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8">Executive Sessions</h4>
                 <div className="space-y-6">
                    {sessions.map(ses => (
                       <div key={ses.id} className="flex gap-4">
                          <div className="w-px bg-white/5 relative">
                             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                          </div>
                          <div className="pb-8">
                             <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">WEEK {ses.week_number} • {ses.type}</p>
                             <h5 className="text-xs font-black text-white uppercase">{ses.title}</h5>
                             <p className="text-[10px] text-slate-600 font-bold mt-2 italic">Assigned Personnel Reach Out Required.</p>
                          </div>
                       </div>
                    ))}
                    {sessions.length === 0 && <p className="text-[10px] text-slate-700 font-bold text-center py-4">No executive sessions scheduled.</p>}
                 </div>
              </div>

              <div className="ios-card bg-indigo-600/5 border-indigo-500/10">
                 <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6 px-2">Knowledge Base</h4>
                 <div className="space-y-2">
                    {program?.resources?.map((res, i) => (
                       <a key={i} href={res.url} target="_blank" className="block p-4 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all group">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <Globe className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">{res.name}</span>
                             </div>
                             <ChevronRight className="w-4 h-4 text-slate-800" />
                          </div>
                       </a>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
         {showFeedbackModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
               <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="ios-card w-full max-w-lg !p-12 space-y-8"
               >
                  <div className="flex justify-between items-start">
                     <div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Venture Pulse</h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Synchronize status with operational HQ.</p>
                     </div>
                     <button onClick={() => setShowFeedbackModal(false)} className="text-slate-600 hover:text-white"><Zap className="w-5 h-5" /></button>
                  </div>

                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest pl-2">Key Learnings</label>
                        <textarea 
                           value={feedback.learnings}
                           onChange={e => setFeedback({...feedback, learnings: e.target.value})}
                           rows={3}
                           className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-indigo-500/30 resize-none"
                           placeholder="What nodes did you master this week?"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-rose-400 uppercase tracking-widest pl-2">Current Challenges</label>
                        <textarea 
                           value={feedback.challenges}
                           onChange={e => setFeedback({...feedback, challenges: e.target.value})}
                           rows={3}
                           className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-indigo-500/30 resize-none"
                           placeholder="Any roadblocks in execution?"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-emerald-400 uppercase tracking-widest pl-2">Future Suggestions</label>
                        <textarea 
                           value={feedback.suggestions}
                           onChange={e => setFeedback({...feedback, suggestions: e.target.value})}
                           rows={3}
                           className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-indigo-500/30 resize-none"
                           placeholder="Optimization ideas?"
                        />
                     </div>
                  </div>

                  <button 
                     onClick={handleSendFeedback}
                     className="w-full btn-prime !py-4"
                  >
                     Anchor Pulse Data
                  </button>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
