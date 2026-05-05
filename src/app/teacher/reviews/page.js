'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, XCircle, Clock, Target, 
  ExternalLink, Search, Filter, Shield, 
  Activity, ArrowRight, MessageSquare
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useI18n } from '@/lib/i18n';

/**
 * TEACHER REVIEWS — SUBMISSION EVALUATION HUB
 * Streamlined interface for assessing student deliverables.
 */

const ReviewCard = ({ submission, onReview }) => (
  <div className="ios-card bg-white/[0.01] border-white/5 group hover:border-indigo-500/30 transition-all">
    <div className="flex justify-between items-start mb-6">
      <div className="flex items-center gap-3">
         <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Target className="w-5 h-5" />
         </div>
         <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5 mb-1">Deliverable Node</p>
            <h4 className="text-lg font-black text-white uppercase tracking-tighter">{submission.v2_deliverables?.title || 'Unknown Asset'}</h4>
         </div>
      </div>
      <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
        Week {submission.v2_deliverables?.week_number || '?'}
      </span>
    </div>

    <div className="p-4 rounded-2xl bg-black/40 border border-white/5 mb-6">
       <div className="flex justify-between items-center">
          <div>
             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Submitter</p>
             <p className="text-sm font-black text-white uppercase tracking-tighter italic">{submission.v2_participants?.name || submission.v2_groups?.name || 'Anonymous'}</p>
          </div>
          <a 
             href={submission.submission_link} 
             target="_blank"
             rel="noopener noreferrer"
             className="p-3 rounded-xl bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 transition-all"
          >
             <ExternalLink className="w-4 h-4" />
          </a>
       </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
       <button 
          onClick={() => onReview(submission, 'approved')}
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-lg hover:shadow-emerald-500/20"
       >
          <CheckCircle2 className="w-4 h-4" /> Approve
       </button>
       <button 
          onClick={() => onReview(submission, 'rejected')}
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-lg hover:shadow-rose-500/20"
       >
          <XCircle className="w-4 h-4" /> Reject
       </button>
    </div>
  </div>
);

export default function SubmissionsHub() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { t } = useI18n();

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await fetch(`/api/teacher/full-state?cid=${user.cid || user.id}`);
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.submissions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleReviewAction = async (sub, status) => {
    const feedbackVal = prompt(`Provide Evaluation Vector for ${status.toUpperCase()}:`);
    if (feedbackVal === null) return;

    try {
      const res = await fetch('/api/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sub.id, status, feedback: feedbackVal })
      });
      const data = await res.json();
      if (data.success) {
        setSubmissions(prev => prev.filter(s => s.id !== sub.id));
      }
    } catch (e) {
      alert("Synchronization failure.");
    }
  };

  const filtered = submissions.filter(s => 
    s.v2_deliverables?.title?.toLowerCase().includes(search.toLowerCase()) ||
    s.v2_participants?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-10 text-left animate-in">
        
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-3">
             <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Evaluation Node</span>
             </div>
             <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Submissions <span className="text-slate-600">Buffer</span></h1>
          </div>
          
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text"
              placeholder="SEARCH SQUAD OR DELIVERABLE..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-[10px] font-black text-white uppercase tracking-widest outline-none focus:border-indigo-500/40 transition-all placeholder:text-slate-700"
            />
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Synchronizing Buffer...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
            {filtered.map(sub => (
              <ReviewCard key={sub.id} submission={sub} onReview={handleReviewAction} />
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full py-40 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                 <CheckCircle2 className="w-16 h-16 text-slate-800 mx-auto mb-6 opacity-20" />
                 <p className="text-slate-600 font-black uppercase text-[10px] tracking-[0.3em]">Buffer Neutral: No pending evaluations.</p>
              </div>
            )}
          </div>
        )}

        <div className="fixed bottom-10 right-10 z-[200]">
           <div className="ios-card bg-black/80 backdrop-blur-xl border-white/10 !p-6 shadow-2xl flex items-center gap-8">
              <div className="flex flex-col">
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Queue Status</span>
                 <span className="text-xl font-black text-white uppercase italic tracking-tighter">{submissions.length} Nodes Pending</span>
              </div>
              <div className="h-10 w-px bg-white/5" />
              <div className="flex gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">System Active</span>
              </div>
           </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
