'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, XCircle, Clock, MessageSquare, 
  ExternalLink, Layers, Users, Zap, Calendar,
  Activity, Shield, ChevronRight, LayoutDashboard,
  Rocket, Filter, Search, Target, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

const ReviewCard = ({ submission, onReview }) => (
  <div className="ios-card bg-white/[0.02] border-white/5 group hover:border-[#FF6600]/80/30 transition-all">
    <div className="flex justify-between items-start mb-6">
      <div className="flex items-center gap-3">
         <div className="p-2 rounded-lg bg-[#FF6600]/80/10 text-indigo-400">
            <Target className="w-5 h-5" />
         </div>
         <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5 mb-1">Pending Node</p>
            <h4 className="text-xl font-black text-white uppercase tracking-tighter">{submission.v2_deliverables?.title}</h4>
         </div>
      </div>
      <div className="text-right">
         <span className="badge badge-glow-indigo text-[8px] font-black uppercase">W{submission.v2_deliverables?.week_number}</span>
      </div>
    </div>

    <div className="flex items-center gap-6 p-4 rounded-xl bg-black/20 border border-white/5 mb-8">
       <div className="flex-1">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Submitter Identity</p>
          <p className="text-sm font-black text-white uppercase tracking-tighter">{submission.v2_groups?.name || submission.v2_participants?.name}</p>
       </div>
       <a 
          href={submission.submission_link} 
          target="_blank"
          className="p-3 rounded-lg bg-white/5 border border-white/5 text-slate-400 hover:text-indigo-400 hover:border-[#FF6600]/80/30 transition-all"
       >
          <ExternalLink className="w-4 h-4" />
       </a>
    </div>

    <div className="grid grid-cols-2 gap-4">
       <button 
          onClick={() => onReview(submission, 'approved')}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all"
       >
          <CheckCircle2 className="w-4 h-4" /> Approve Node
       </button>
       <button 
          onClick={() => onReview(submission, 'rejected')}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
       >
          <XCircle className="w-4 h-4" /> Reject Node
       </button>
    </div>
  </div>
);

export default function TeacherV2Dashboard() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReviewing, setIsReviewing] = useState(null); 
  const [feedback, setFeedback] = useState('');
  const [activeSection, setActiveSection] = useState('submissions');
  const [selectedReportWeek, setSelectedReportWeek] = useState(1);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [reportData, setReportData] = useState({
     reception_score: 5,
     progress_notes: '',
     student_reception: '',
     action_taken: ''
  });
  const [myPrograms, setMyPrograms] = useState([]);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [participantsFulfillment, setParticipantsFulfillment] = useState([]);
  const [isFulfillmentLoading, setIsFulfillmentLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch(`/api/v2/teacher/full-state?cid=${user.cid || user.id}`);
      const data = await res.json();
      
      if (data.success) {
         setSubmissions(data.submissions || []);
         setSessions(data.sessions || []);
         
         // Extract unique programs
         const uniqueProgs = [];
         const progIds = new Set();
         (data.sessions || []).forEach(s => {
            if (!progIds.has(s.program_id)) {
               progIds.add(s.program_id);
               uniqueProgs.push({ id: s.program_id, name: s.program_name });
            }
         });
         setMyPrograms(uniqueProgs);
         if (uniqueProgs.length > 0 && !selectedProgramId) setSelectedProgramId(uniqueProgs[0].id);
      }
      setIsLoading(false);
    } catch (e) { 
      console.error(e);
      setIsLoading(false);
    }
  };

  const handleSaveReport = async () => {
     if (!selectedProgramId) return;
     setIsSavingReport(true);
     try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const res = await fetch('/api/v2/teacher/reports', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              program_id: selectedProgramId,
              week_number: selectedReportWeek,
              teacher_id: user.cid || user.id,
              teacher_name: user.name,
              ...reportData
           })
        });
        const data = await res.json();
        if (data.success) {
           alert("Strategic report synchronized.");
        }
     } catch (e) { alert("Report sync failed."); }
     finally { setIsSavingReport(false); }
  };

  const fetchExistingReport = async (progId, week) => {
     try {
        const res = await fetch(`/api/v2/teacher/reports?program_id=${progId}&week_number=${week}`);
        const data = await res.json();
        if (data.success && data.reports?.length > 0) {
           const r = data.reports[0];
           setReportData({
              reception_score: r.reception_score,
              progress_notes: r.progress_notes,
              student_reception: r.student_reception,
              action_taken: r.action_taken
           });
        } else {
           setReportData({ reception_score: 5, progress_notes: '', student_reception: '', action_taken: '' });
        }
     } catch (e) {}
  };

  const fetchFulfillment = async (progId, week) => {
     setIsFulfillmentLoading(true);
     try {
        const res = await fetch(`/api/v2/teacher/fulfillment?program_id=${progId}&week_number=${week}`);
        const data = await res.json();
        if (data.success) setParticipantsFulfillment(data.fulfillment || []);
     } catch (e) {}
     finally { setIsFulfillmentLoading(false); }
  };

  useEffect(() => {
     if (activeSection === 'reports' && selectedProgramId) {
        fetchExistingReport(selectedProgramId, selectedReportWeek);
        fetchFulfillment(selectedProgramId, selectedReportWeek);
     }
  }, [selectedProgramId, selectedReportWeek, activeSection]);

  const handleReviewAction = async (sub, status) => {
     const feedbackVal = prompt(`Enter evaluation notes for ${status === 'approved' ? 'Approval' : 'Rejection'}:`);
     if (feedbackVal === null) return;

     try {
        const res = await fetch('/api/v2/submissions', {
           method: 'PATCH',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ id: sub.id, status, feedback: feedbackVal })
        });
        const data = await res.json();
        if (data.success) {
           setSubmissions(submissions.filter(s => s.id !== sub.id));
           alert(`Node ${status} synchronized to student ledger.`);
        }
     } catch (e) { alert("Review failed."); }
  };

  if (isLoading) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF6600]/80/20 border-t-[#FF6600]/80 rounded-full animate-spin" />
     </div>
  );

  return (
    <DashboardLayout role="teacher" activeTab="v2">
      <div className="space-y-12">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6 border-b border-white/5 pb-10">
          <div className="animation-reveal">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Review Authority</span>
              <div className="h-px w-10 bg-[#FF6600]/30" />
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Teacher Evaluation HQ</h2>
            <p className="text-slate-400 font-bold tracking-tight">
               {activeSection === 'submissions' ? 'Executing logic on student submissions and lifecycle progression.' : 'Compiling tactical insights on participant reception and week-over-week growth.'}
            </p>
          </div>
          <div className="flex gap-4">
             <button 
               onClick={() => setActiveSection('submissions')}
               className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeSection === 'submissions' ? 'bg-[#FF6600] text-black shadow-xl shadow-[#FF6600]/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
             >
                Submissions
             </button>
             <button 
               onClick={() => setActiveSection('reports')}
               className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeSection === 'reports' ? 'bg-[#FF6600] text-black shadow-xl shadow-[#FF6600]/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
             >
                Program Weekly Report
             </button>
          </div>
        </header>

        {activeSection === 'submissions' ? (
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
                 {submissions.map(sub => (
                    <ReviewCard 
                      key={sub.id} 
                      submission={sub} 
                      onReview={handleReviewAction} 
                    />
                 ))}
                 {submissions.length === 0 && (
                    <div className="col-span-full py-40 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                       <CheckCircle2 className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                       <p className="text-slate-500 font-bold max-w-xs mx-auto uppercase text-[10px] tracking-widest">Buffer Clear: All submissions currently synchronized.</p>
                    </div>
                 )}
              </div>

              <div className="space-y-8">
                 <div className="ios-card bg-[#FF6600]/5 border-[#FF6600]/20 !p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                       <Zap className="w-16 h-16 text-[#FF6600]" />
                    </div>
                    <h4 className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest mb-6 flex items-center gap-2 italic">
                       <Rocket className="w-3 h-3" /> Next Upcoming Task
                    </h4>
                    {sessions.length > 0 ? (
                       <div className="space-y-6">
                          <div>
                             <p className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">{sessions[0].title}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{sessions[0].program_name}</p>
                          </div>
                          <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                             <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest">
                                <span className="text-slate-500">Schedule</span>
                                <span className="text-[#FF6600]">{sessions[0].scheduled_date}</span>
                             </div>
                             <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest">
                                <span className="text-slate-500">Window</span>
                                <span className="text-white">{sessions[0].start_time || '00:00'} - {sessions[0].end_time || '23:59'}</span>
                             </div>
                          </div>
                       </div>
                    ) : (
                       <p className="text-[10px] font-black text-slate-600 uppercase italic">No tasks pending deployment.</p>
                    )}
                 </div>
              </div>
           </div>
        ) : (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 space-y-10">
                 <div className="ios-card bg-white/[0.01] border-white/5 !p-12">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-10 flex items-center gap-4">
                       <FileText className="w-6 h-6 text-[#FF6600]" />
                       Tactical Week Report
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Program</label>
                          <select 
                             value={selectedProgramId}
                             onChange={e => setSelectedProgramId(e.target.value)}
                             className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-6 text-white text-xs font-bold outline-none focus:border-[#FF6600]/40 transition-all appearance-none"
                          >
                             {myPrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operational Week</label>
                          <select 
                             value={selectedReportWeek}
                             onChange={e => setSelectedReportWeek(parseInt(e.target.value))}
                             className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-6 text-white text-xs font-bold outline-none focus:border-[#FF6600]/40 transition-all appearance-none"
                          >
                             {[1,2,3,4,5,6,7,8,9,10,11,12].map(w => <option key={w} value={w}>Week {w}</option>)}
                          </select>
                       </div>
                    </div>

                    <div className="space-y-8">
                       <div className="space-y-3">
                          <div className="flex justify-between items-center">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student Reception Score (1-10)</label>
                             <span className="text-[#FF6600] font-black">{reportData.reception_score}/10</span>
                          </div>
                          <input 
                             type="range" min="1" max="10" 
                             value={reportData.reception_score}
                             onChange={e => setReportData({...reportData, reception_score: parseInt(e.target.value)})}
                             className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[#FF6600]"
                          />
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress Notes</label>
                          <textarea 
                             placeholder="How did the session go? What was achieved?"
                             value={reportData.progress_notes}
                             onChange={e => setReportData({...reportData, progress_notes: e.target.value})}
                             className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-white text-sm font-bold outline-none focus:border-[#FF6600]/40 transition-all min-h-[120px]"
                          />
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Student Reception Details</label>
                          <textarea 
                             placeholder="How did the students react to the content?"
                             value={reportData.student_reception}
                             onChange={e => setReportData({...reportData, student_reception: e.target.value})}
                             className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-white text-sm font-bold outline-none focus:border-[#FF6600]/40 transition-all min-h-[120px]"
                          />
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions Taken / Behavioral Shifts</label>
                          <textarea 
                             placeholder="Did the students act on what was taught? Any visible impact?"
                             value={reportData.action_taken}
                             onChange={e => setReportData({...reportData, action_taken: e.target.value})}
                             className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-white text-sm font-bold outline-none focus:border-[#FF6600]/40 transition-all min-h-[120px]"
                          />
                       </div>

                       <button 
                          onClick={handleSaveReport}
                          disabled={isSavingReport}
                          className="w-full py-5 rounded-2xl bg-[#FF6600] text-black font-black uppercase text-xs tracking-[0.2em] hover:bg-white transition-all shadow-xl shadow-[#FF6600]/20 disabled:opacity-50"
                       >
                          {isSavingReport ? 'Synchronizing Intelligence...' : 'Finalize & Sync Report'}
                       </button>
                    </div>
                 </div>
              </div>

              <div className="space-y-8">
                 <div className="ios-card bg-emerald-500/5 border-emerald-500/20 !p-8">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-10 flex items-center gap-4">
                       <Users className="w-6 h-6 text-[#FF6600]" />
                       Participant Fulfillment (Week {selectedReportWeek})
                    </h3>

                    {isFulfillmentLoading ? (
                       <div className="py-10 text-center">
                          <div className="w-6 h-6 border-2 border-[#FF6600]/10 border-t-[#FF6600] rounded-full animate-spin mx-auto mb-4" />
                       </div>
                    ) : (
                       <div className="space-y-4">
                          {participantsFulfillment.map(p => (
                             <div key={p.id} className="flex items-center justify-between p-5 rounded-2xl bg-black/20 border border-white/5">
                                <div className="flex items-center gap-4">
                                   <div className={`w-2 h-2 rounded-full ${p.status === 'complete' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : p.status === 'partial' ? 'bg-[#FF6600] shadow-[0_0_8px_rgba(255,102,0,0.5)]' : 'bg-slate-700'}`} />
                                   <p className="text-xs font-black text-white uppercase tracking-tighter italic">{p.name}</p>
                                </div>
                                <div className="flex items-center gap-6">
                                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{p.submitted_reqs}/{p.total_reqs} Done</p>
                                   <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-full border ${p.status === 'complete' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : p.status === 'partial' ? 'bg-[#FF6600]/10 border-[#FF6600]/20 text-[#FF6600]' : 'bg-white/5 border-white/5 text-slate-500'}`}>
                                      {p.status}
                                   </span>
                                </div>
                             </div>
                          ))}
                          {participantsFulfillment.length === 0 && (
                             <p className="text-[10px] font-black text-slate-600 uppercase italic text-center py-10 border border-dashed border-white/5 rounded-2xl">No participants anchored to this program.</p>
                          )}
                       </div>
                    )}
                 </div>
              </div>

              <div className="space-y-8">
                 <div className="ios-card bg-emerald-500/5 border-emerald-500/20 !p-8">
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                       <Shield className="w-3 h-3" /> Integrity Check
                    </h4>
                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase">
                       Reports are mirrored to the Program Manager and Super Admin immediately upon synchronization. Ensure tactical accuracy.
                    </p>
                 </div>
              </div>
           </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12">
           <div className="lg:col-span-2 space-y-8">
              <section className="ios-card bg-white/[0.01] border-white/5 !p-12 overflow-hidden shadow-2xl relative">
                 <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-[100px] -mr-40 -mt-40" />
                 <div className="flex flex-col lg:flex-row justify-between items-start gap-12 relative z-10 text-left">
                    <div className="space-y-6">
                       <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Review Schedule</h3>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">Assigned Evaluation Windows</p>
                       
                       <div className="space-y-4 pt-6">
                          {sessions.slice(0, 3).map(item => (
                             <div key={item.id} className="flex items-center gap-6 group">
                                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center text-[10px] font-black uppercase group-hover:border-indigo-400/40 transition-all">
                                   <span className="text-indigo-400">{new Date(item.scheduled_date).getDate()}</span>
                                   <span className="text-slate-500 text-[7px]">{new Date(item.scheduled_date).toLocaleString('default', { month: 'short' })}</span>
                                </div>
                                <div className="flex-1">
                                   <p className="text-xs font-black text-white uppercase italic">{item.title}</p>
                                   <div className="flex items-center gap-2 mt-1">
                                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.program_name}</p>
                                      <span className="text-slate-800">•</span>
                                      <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest italic">
                                         {item.start_time || '00:00'} - {item.end_time || '23:59'}
                                      </p>
                                   </div>
                                </div>
                             </div>
                          ))}
                          {sessions.length === 0 && <p className="text-[10px] font-black text-slate-600 uppercase italic">No evaluation nodes anchored.</p>}
                       </div>
                    </div>

                    <div className="flex-1 w-full lg:max-w-md bg-white/[0.02] border border-white/5 rounded-[2rem] p-8">
                       <div className="flex justify-between items-center mb-8">
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest italic">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                          <div className="flex gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500" />
                             <div className="w-2 h-2 rounded-full bg-indigo-500" />
                          </div>
                       </div>
                       <div className="grid grid-cols-7 gap-2 text-center text-[8px] font-black text-slate-500 uppercase tracking-widest mb-4">
                          {['S','M','T','W','T','F','S'].map(d => <div key={d}>{d}</div>)}
                       </div>
                       <div className="grid grid-cols-7 gap-2">
                          {Array.from({ length: 31 }, (_, i) => {
                             const d = i + 1;
                             const isToday = d === new Date().getDate();
                             const hasEvent = sessions.some(s => new Date(s.scheduled_date).getDate() === d);
                             return (
                                <div key={i} className={`aspect-square flex items-center justify-center rounded-lg text-[9px] font-black transition-all ${isToday ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : hasEvent ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' : 'text-slate-800'}`}>
                                   {d}
                                </div>
                             );
                          })}
                       </div>
                    </div>
                 </div>
              </section>
           </div>

           <div className="space-y-8">
              <div className="ios-card bg-[#FF6600]/5 border-[#FF6600]/80/10">
                 <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6">Internal Directive</h4>
                 <div className="space-y-4">
                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase">
                       - Approve nodes to unlock next week access for teams.<br />
                       - Rejections must contain actionable feedback vector.<br />
                       - All reviews are mirrored to Superadmin logs.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
