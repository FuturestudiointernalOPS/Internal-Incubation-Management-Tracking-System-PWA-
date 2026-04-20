'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, XCircle, Clock, MessageSquare, 
  ExternalLink, Layers, Users, Zap, Calendar,
  Activity, Shield, ChevronRight, LayoutDashboard,
  Rocket, Filter, Search, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

const ReviewCard = ({ submission, onReview }) => (
  <div className="ios-card bg-white/[0.02] border-white/5 group hover:border-indigo-500/30 transition-all">
    <div className="flex justify-between items-start mb-6">
      <div className="flex items-center gap-3">
         <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Target className="w-5 h-5" />
         </div>
         <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-0.5 mb-1">Pending Node</p>
            <h4 className="text-xl font-black text-white uppercase tracking-tighter">{submission.v2_deliverables?.title}</h4>
         </div>
      </div>
      <div className="text-right">
         <span className="badge badge-glow-indigo text-[8px] font-black uppercase">W{submission.v2_deliverables?.week_number}</span>
      </div>
    </div>

    <div className="flex items-center gap-6 p-4 rounded-xl bg-black/20 border border-white/5 mb-8">
       <div className="flex-1">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Submitter Identity</p>
          <p className="text-sm font-black text-white uppercase tracking-tighter">{submission.v2_groups?.name || submission.v2_participants?.name}</p>
       </div>
       <a 
          href={submission.submission_link} 
          target="_blank"
          className="p-3 rounded-lg bg-white/5 border border-white/5 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
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
  const [isReviewing, setIsReviewing] = useState(null); // The submission being reviewed
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    // Basic role check (In real scenario, check v1 session or auth)
    const sa = localStorage.getItem('sa_session');
    // For now, let's assume teacher access if staff session exists
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
      }
      setIsLoading(false);
    } catch (e) { 
      console.error(e);
      setIsLoading(false);
    }
  };

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
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
     </div>
  );

  return (
    <DashboardLayout role="teacher" activeTab="v2">
      <div className="space-y-12">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6 border-b border-white/5 pb-10">
          <div className="animation-reveal">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Review Authority</span>
              <div className="h-px w-10 bg-indigo-500/30" />
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Teacher Evaluation HQ</h2>
            <p className="text-slate-500 font-bold tracking-tight">
              Executing logic on student submissions and lifecycle progression.
            </p>
          </div>
          <div className="flex gap-4">
             <div className="p-4 rounded-2xl bg-[#0d0d18] border border-white/5 text-right px-8">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Pending Sync</p>
                <p className="text-xl font-black text-white uppercase tracking-tighter">{submissions.length} NODES</p>
             </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                 <p className="text-slate-600 font-bold max-w-xs mx-auto uppercase text-[10px] tracking-widest">Buffer Clear: All submissions currently synchronized.</p>
              </div>
           )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-12">
           <div className="lg:col-span-2 space-y-8">
              <div className="ios-card">
                 <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3 mb-10">
                    <Calendar className="w-4 h-4 text-indigo-400" /> My Executive Sessions
                 </h3>
                 <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                       <p className="text-slate-700 font-black uppercase text-[10px] tracking-widest">No active sessions assigned.</p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="space-y-8">
              <div className="ios-card bg-indigo-600/5 border-indigo-500/10">
                 <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6">Internal Directive</h4>
                 <div className="space-y-4">
                    <p className="text-[11px] font-bold text-slate-500 leading-relaxed uppercase">
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
