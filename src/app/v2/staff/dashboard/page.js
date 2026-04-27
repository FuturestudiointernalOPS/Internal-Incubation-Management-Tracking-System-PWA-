'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Briefcase, CheckCircle2, Clock, 
  MessageSquare, Star, ArrowRight, Shield,
  Search, Filter, Activity, Target
} from 'lucide-react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function StaffDashboard() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(sessionUser);
    fetchData(sessionUser.id);
  }, []);

  const fetchData = async (uid) => {
    try {
      const assignRes = await fetch(`/api/v2/program-staff?staff_id=${uid}`);
      const assignData = await assignRes.json();
      if (assignData.success) setAssignments(assignData.assignments);

      // In a real app, we'd fetch submissions for assigned programs
      const subRes = await fetch(`/api/v2/participant/submissions`); 
      const subData = await subRes.json();
      if (subData.success) {
        setPendingSubmissions(subData.submissions.filter(s => s.status === 'pending'));
      }

      setIsLoaded(true);
    } catch (e) { console.error(e); setIsLoaded(true); }
  };

  return (
    <DashboardLayout role="staff">
      <div className="space-y-12">
        
        {/* STAFF WELCOME */}
        <header className="space-y-4">
           <div className="flex items-center gap-4">
              <Star className="w-5 h-5 text-[#FF6600]" />
              <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.4em]">Tactical Faculty Hub</span>
           </div>
           <h2 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">Command Overview</h2>
           <p className="text-slate-400 font-bold max-w-xl opacity-70">Monitor your assigned program clusters and intercept participant submissions for evaluation.</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
           
           {/* ASSIGNED PROGRAMS */}
           <div className="xl:col-span-2 space-y-8">
              <div className="flex justify-between items-end">
                 <h3 className="text-xl font-black text-white uppercase italic tracking-widest">Active Assignments</h3>
                 <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{assignments.length} Program Clusters</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {assignments.map(assign => (
                    <div key={assign.id} className="ios-card bg-white/[0.01] border-white/5 p-8 space-y-8 group hover:border-[#FF6600]/20 transition-all cursor-pointer">
                       <div className="flex justify-between items-start">
                          <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${assign.role === 'group_leader' ? 'bg-[#FF6600]/80/10 text-indigo-400 border-[#FF6600]/80/20' : 'bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/20'}`}>
                             {assign.role.replace('_', ' ')}
                          </div>
                          <Activity className="w-5 h-5 text-slate-800 group-hover:text-[#FF6600] transition-colors" />
                       </div>
                       <div>
                          <h4 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none mb-4">{assign.program_name}</h4>
                          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Status: {assign.program_status}</p>
                       </div>
                       <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">View Program Logic</span>
                          <ArrowRight className="w-4 h-4 text-slate-800" />
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           {/* PENDING INTERCEPTIONS (Submissions) */}
           <div className="space-y-8">
              <h3 className="text-xl font-black text-white uppercase italic tracking-widest">Pending Signals</h3>
              <div className="space-y-4">
                 {pendingSubmissions.map(sub => (
                    <div key={sub.id} className="ios-card bg-white/[0.02] border-white/10 p-6 space-y-4 group hover:bg-[#FF6600]/5 transition-all">
                       <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                             <div className="w-2 h-2 rounded-full bg-[#FF6600] shadow-[0_0_10px_rgba(255,102,0,0.5)]" />
                             <span className="text-[10px] font-black text-white uppercase tracking-widest italic">New Submission</span>
                          </div>
                          <span className="text-[9px] font-bold text-slate-700">2m ago</span>
                       </div>
                       <p className="text-[12px] font-bold text-slate-400 leading-relaxed italic">Participant CID-{sub.participant_id.slice(0,8)} has deployed a tactical node for review.</p>
                       <button className="w-full py-4 bg-white/5 text-white font-black uppercase text-[9px] tracking-[0.3em] rounded-xl group-hover:bg-[#FF6600] group-hover:text-black transition-all">
                          Intercept & Evaluate
                       </button>
                    </div>
                 ))}
                 {pendingSubmissions.length === 0 && <div className="ios-card border-dashed py-32 text-center italic text-slate-700 text-[11px] uppercase tracking-widest opacity-40">No Pending Signals detected...</div>}
              </div>
           </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
