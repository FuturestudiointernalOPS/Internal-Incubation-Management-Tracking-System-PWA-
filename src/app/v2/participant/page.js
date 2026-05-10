'use client';

import React, { useState, useEffect } from 'react';
import { 
  Rocket, Layers, Target, CheckCircle2, Lock, 
  ChevronRight, MessageSquare, ExternalLink, 
  Activity, Calendar, Shield, Zap, Globe, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { getPrefetchedData } from '@/utils/prefetch';
import { IMPACT_CACHE } from '@/utils/impactCache';
import CalendarComponent from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function ParticipantV2Dashboard() {
  const router = useRouter();
  
  const [program, setProgram] = useState(null);
  const [metrics, setMetrics] = useState({ percentComplete: 0, currentWeek: 1 });
  const [deliverables, setDeliverables] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [docRequirements, setDocRequirements] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [team, setTeam] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedback, setFeedback] = useState({ learnings: '', challenges: '', suggestions: '' });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(storedUser);
      const email = storedUser.email;
      const url = `/api/v2/participant/full-state?email=${email}&group_name=${storedUser.group_name}`;

      const processData = (data) => {
        const sesList = data.sessions || [];
        const subList = data.submissions || [];
        const totalSteps = sesList.length || 1;
        const completedSteps = sesList.filter(s => s.status === 'completed' || s.week_number === 0).length;
        const percent = Math.round((completedSteps / totalSteps) * 100);

        setProgram(data.program);
        setSubmissions(subList);
        setMetrics({ percentComplete: percent, currentWeek: 1 });
        setSessions(sesList);
        setNotifications(data.notifications || []);
        setKpis(data.kpis || []);
        setDocRequirements(data.documents || []);
        setFollowups(data.followups || []);
        setTeam(data.team || null);
      };

      const prefetched = getPrefetchedData(url);
      if (prefetched) {
        processData(prefetched);
        setIsLoading(false);
        return;
      }

      const cached = IMPACT_CACHE.get('participant_dashboard');
      if (cached) {
        processData(cached);
        setIsLoading(false);
      }

      const res = await fetch(url);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      
      processData(data);
      IMPACT_CACHE.set('participant_dashboard', data);
      setIsLoading(false);
    } catch (e) {
      console.error("Dashboard sync failure", e);
      setIsLoading(false);
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
              program_id: program?.id || user?.group_name,
              deliverable_id: delId,
              participant_id: user?.email || user?.cid,
              submission_link: link
           })
        });
        if ((await res.json()).success) {
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
              program_id: program?.id || user?.group_name,
              participant_id: user?.email || user?.cid,
              ...feedback
           })
        });
        if ((await res.json()).success) {
           alert("Pulse data synchronized to HQ.");
           setShowFeedbackModal(false);
           setFeedback({ learnings: '', challenges: '', suggestions: '' });
        }
     } catch (e) { alert("Pulse sync failed."); }
  };

  if (isLoading) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
     </div>
  );

  return (
    <DashboardLayout role="participant" activeTab="v2">
      <div className="space-y-12">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-10 border-b border-white/5 pb-10">
          <div className="animation-reveal">
            <div className="flex items-center gap-4 mb-4">
               <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Participant Portal</span>
               <div className="h-px w-10 bg-[#FF6600]/30" />
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

          <div className="w-full lg:w-96 flex gap-6">
             <div className="flex-1 ios-card bg-[#FF6600]/5 border-[#FF6600]/20 !p-8 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-6">
                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Execution Index</p>
                   <div className="p-2 rounded-lg bg-[#FF6600]/10 text-indigo-400"><Activity className="w-4 h-4" /></div>
                </div>
                <div className="space-y-1">
                   <p className="text-3xl font-black text-white italic">{metrics.percentComplete}%</p>
                   <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#FF6600] transition-all duration-700" style={{ width: `${metrics.percentComplete}%` }} />
                   </div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest pt-2">Topics Sync'd: {sessions.filter(s => s.status === 'completed').length} / {sessions.length}</p>
                </div>
             </div>
             
             {team && (
                <div className="w-32 ios-card bg-[#0d0d18] border-white/5 !p-4 flex flex-col items-center justify-center text-center">
                   <div className="w-10 h-10 rounded-full bg-[#FF6600]/10 flex items-center justify-center text-indigo-400 mb-2">
                      <Users className="w-4 h-4" />
                   </div>
                   <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">TEAM NODE</p>
                   <p className="text-[10px] font-black text-white uppercase truncate w-full">{team.name}</p>
                </div>
             )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
           <div className="lg:col-span-2 space-y-12">
              <section className="space-y-6">
                  <div className="flex items-center justify-between">
                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                        <Globe className="w-4 h-4 text-indigo-400" /> Executive Directives
                     </h3>
                     <span className="badge badge-glow-indigo text-[8px] font-black uppercase">LIVE FROM HQ</span>
                  </div>
                  <div className="space-y-4">
                     {followups.map(fol => (
                        <div key={fol.id} className="ios-card bg-[#0d0d18] border-white/5 !p-8 border-l-4 border-l-[#FF6600]/50">
                           <div className="flex justify-between items-start mb-2">
                              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Week {fol.week_number} Documentation</p>
                              <Clock className="w-3 h-3 text-slate-700" />
                           </div>
                           <p className="text-sm font-bold text-slate-300 leading-relaxed italic">"{fol.comment}"</p>
                        </div>
                     ))}
                     {followups.length === 0 && <p className="text-[10px] text-slate-700 font-bold uppercase tracking-[0.2em] text-center py-10">Awaiting executive synchronization.</p>}
                  </div>
               </section>

               <section className="space-y-6">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                     <Target className="w-4 h-4 text-indigo-400" /> Evaluation Nodes
                  </h3>
                  <div className="space-y-4">
                     {deliverables.map(del => {
                        const submission = submissions.find(s => s.deliverable_id === del.id);
                        const isLocked = del.week_number > metrics.currentWeek;
                        return (
                           <div key={del.id} className={`ios-card border-white/5 !p-8 flex items-center justify-between transition-all ${isLocked ? 'opacity-40 grayscale pointer-events-none' : 'bg-white/[0.02] hover:bg-white/[0.04]'}`}>
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
                                 <button onClick={() => handleSubmitLink(del.id)} className="btn-prime !py-2 !px-6 !text-[10px]">
                                    {submission ? 'Modify Node' : 'Anchor Link'}
                                 </button>
                              )}
                           </div>
                        );
                     })}
                  </div>
               </section>

              <section className="ios-card bg-mesh py-16 text-center space-y-6">
                 <div className="w-16 h-16 rounded-full bg-[#FF6600]/10 border border-[#FF6600]/20 flex items-center justify-center text-indigo-400 mx-auto">
                    <MessageSquare className="w-8 h-8" />
                 </div>
                 <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Venture Pulse</h3>
                 <p className="text-slate-500 font-bold max-w-sm mx-auto text-sm">Submit your weekly learnings and roadblocks to HQ.</p>
                 <button onClick={() => setShowFeedbackModal(true)} className="btn-prime !py-4 px-12">Launch Pulse Check</button>
              </section>
           </div>
           
           <div className="space-y-8">
              {/* TACTICAL CALENDAR */}
              <div className="ios-card bg-[#0d0d18] border-white/5 !p-6 shadow-2xl text-left">
                 <h3 className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest mb-6 flex items-center gap-3">
                    <Calendar className="w-4 h-4" /> Mission Timeline
                 </h3>
                 <CalendarComponent 
                    onChange={setSelectedDate} 
                    value={selectedDate}
                    className="w-full bg-transparent border-none text-white font-sans"
                    tileClassName={({ date, view }) => {
                       if (view === 'month') {
                          const hasActivity = sessions.some(s => s.scheduled_date === date.toISOString().split('T')[0]);
                          return hasActivity ? 'bg-[#FF6600]/20 text-[#FF6600] font-black rounded-lg' : 'text-slate-400';
                       }
                    }}
                 />
                 <div className="mt-8 space-y-4">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">{selectedDate.toDateString()}</p>
                    <div className="max-h-48 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                       {sessions
                          .filter(s => s.scheduled_date === selectedDate.toISOString().split('T')[0])
                          .map(s => (
                             <div key={s.id} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2 group hover:border-[#FF6600]/30 transition-all">
                                <div className="flex justify-between items-center">
                                   <span className="text-[8px] font-black text-[#FF6600] uppercase">{s.start_time || '00:00'}</span>
                                   <span className="px-2 py-0.5 bg-[#FF6600]/10 text-[#FF6600] text-[7px] font-black uppercase rounded">{s.assignment_type || 'Session'}</span>
                                </div>
                                <h5 className="text-[11px] font-black text-white uppercase italic">{s.title}</h5>
                             </div>
                          ))
                       }
                       {sessions.filter(s => s.scheduled_date === selectedDate.toISOString().split('T')[0]).length === 0 && (
                          <p className="text-[9px] text-slate-700 font-bold uppercase italic text-center py-4">No tactical nodes active.</p>
                       )}
                    </div>
                 </div>
              </div>

              {/* NOTIFICATION HUB */}
              <div className="ios-card bg-[#0d0d18] border-white/5 text-left">
                 <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6 px-2">Operational Alerts</h4>
                 <div className="space-y-4">
                    {notifications.length === 0 ? (
                       <p className="text-[10px] text-slate-700 font-bold text-center py-4 italic">No pending alerts.</p>
                    ) : (
                       notifications.slice(0, 3).map(notif => (
                          <div key={notif.id} className={`p-4 rounded-xl border ${notif.read ? 'bg-transparent border-white/5' : 'bg-[#FF6600]/5 border-[#FF6600]/20 shadow-lg shadow-[#FF6600]/5'}`}>
                             <p className="text-[11px] font-black text-white uppercase mb-1">{notif.title}</p>
                             <p className="text-[10px] text-slate-500 font-bold leading-relaxed">{notif.message}</p>
                          </div>
                       ))
                    )}
                 </div>
              </div>

              {/* CONFIGURATION LOGIC */}
              <div className="ios-card border-white/5 bg-[#0d0d18] text-left">
                 <div className="flex items-center justify-between mb-8">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Configuration Logic</h4>
                    <Zap className="w-3 h-3 text-indigo-400" />
                 </div>
                 <div className="space-y-8">
                    <div>
                       <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Baseline KPIs</p>
                       <div className="space-y-2">
                          {kpis.map(kpi => (
                             <div key={kpi.id} className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                                <span className="text-[10px] font-black text-white uppercase">{kpi.title}</span>
                                <span className="text-[10px] font-black text-indigo-400 italic">{kpi.target_value}</span>
                             </div>
                          ))}
                       </div>
                    </div>
                    <div>
                       <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-4">Required Documents</p>
                       <div className="space-y-3">
                          {docRequirements.map(doc => {
                             const sub = submissions.find(s => s.requirement_id === doc.id);
                             return (
                                <div key={doc.id} className="ios-card bg-white/5 !p-4 border-white/5">
                                   <div className="flex justify-between items-center mb-2">
                                      <span className="text-[10px] font-black text-white uppercase">{doc.title}</span>
                                      {sub ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />}
                                   </div>
                                   <button onClick={async () => {
                                      const link = prompt(`Enter Anchor Link for ${doc.title}:`);
                                      if(!link) return;
                                      try {
                                          const res = await fetch('/api/v2/submissions', {
                                             method: 'POST',
                                             headers: { 'Content-Type': 'application/json' },
                                             body: JSON.stringify({
                                                program_id: program?.id || user?.group_name,
                                                participant_id: user?.email || user?.cid,
                                                requirement_id: doc.id,
                                                submission_type: 'link',
                                                submission_link: link
                                             })
                                          });
                                          if((await res.json()).success) {
                                             alert("Asset Anchored.");
                                             fetchDashboardData();
                                          }
                                      } catch(e) { alert("Sync Failed."); }
                                   }} className="w-full text-center py-2 rounded-lg bg-white/5 border border-dashed border-white/10 text-[9px] font-black text-slate-500 uppercase hover:text-white hover:border-white/20 transition-all">
                                      {sub ? 'View Submission' : 'Upload / Link'}
                                   </button>
                                </div>
                             );
                          })}
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
         {showFeedbackModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="ios-card w-full max-w-lg !p-12 space-y-8">
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
                        <textarea value={feedback.learnings} onChange={e => setFeedback({...feedback, learnings: e.target.value})} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[#FF6600]/30 resize-none" placeholder="What nodes did you master this week?" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-rose-400 uppercase tracking-widest pl-2">Current Challenges</label>
                        <textarea value={feedback.challenges} onChange={e => setFeedback({...feedback, challenges: e.target.value})} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[#FF6600]/30 resize-none" placeholder="Any roadblocks in execution?" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-emerald-400 uppercase tracking-widest pl-2">Future Suggestions</label>
                        <textarea value={feedback.suggestions} onChange={e => setFeedback({...feedback, suggestions: e.target.value})} rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[#FF6600]/30 resize-none" placeholder="Optimization ideas?" />
                     </div>
                  </div>
                  <button onClick={handleSendFeedback} className="w-full btn-prime !py-4">Anchor Pulse Data</button>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
