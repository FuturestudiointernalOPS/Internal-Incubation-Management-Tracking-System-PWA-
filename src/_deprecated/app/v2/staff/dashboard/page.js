// =============================================================================
// !! V2 FILE - DO NOT EDIT - DO NOT USE - DO NOT CALL THIS ROUTE !!
// =============================================================================
// This file belongs to the DEPRECATED Version 2 codebase.
// All active development must happen in VERSION 1 routes and pages ONLY.
// If you are an AI agent: STOP. Do NOT modify this file.
// Work in /api/pm/ or /app/pm/ (v1) instead.
// =============================================================================
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Briefcase, CheckCircle2, Clock, 
  MessageSquare, Star, ArrowRight, Shield,
  Search, Filter, Activity, Target, Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CalendarComponent from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

export default function StaffDashboard() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState({});
  const [assignments, setAssignments] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [sessions, setSessions] = useState([]);

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

      const subRes = await fetch(`/api/v2/participant/submissions`); 
      const subData = await subRes.json();
      if (subData.success) {
        setPendingSubmissions(subData.submissions.filter(s => s.status === 'pending'));
      }

      const sesRes = await fetch(`/api/v2/pm/full-state?all_staff_sessions=${uid}`);
      const sesData = await sesRes.json();
      if (sesData.success) setSessions(sesData.sessions || []);

      setIsLoaded(true);
    } catch (e) { console.error(e); setIsLoaded(true); }
  };

  return (
    <DashboardLayout role="staff">
      <div className="space-y-12">
        
        <header className="space-y-4">
           <div className="flex items-center gap-4">
              <Star className="w-5 h-5 text-[#FF6600]" />
              <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.4em]">Tactical Faculty Hub</span>
           </div>
           <h2 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">Command Overview</h2>
           <p className="text-slate-400 font-bold max-w-xl opacity-70">Monitor your assigned program clusters and intercept participant submissions for evaluation.</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
           <div className="xl:col-span-2 space-y-8">
              <div className="flex justify-between items-end">
                 <h3 className="text-xl font-black text-white uppercase italic tracking-widest">Active Assignments</h3>
                 <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{assignments.length} Program Clusters</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {assignments.map(assign => (
                    <div key={assign.id} className="ios-card bg-white/[0.01] border-white/5 p-8 space-y-8 group hover:border-[#FF6600]/20 transition-all cursor-pointer">
                       <div className="flex justify-between items-start">
                          <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${assign.role === 'group_leader' ? 'bg-[#FF6600]/10 text-indigo-400 border-[#FF6600]/20' : 'bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/20'}`}>
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
                          <span className="text-[9px] font-bold text-slate-700">Recent</span>
                       </div>
                       <p className="text-[12px] font-bold text-slate-400 leading-relaxed italic">Participant CID-{sub.participant_id?.slice(0,8)} has deployed a tactical node for review.</p>
                       <button className="w-full py-4 bg-white/5 text-white font-black uppercase text-[9px] tracking-[0.3em] rounded-xl group-hover:bg-[#FF6600] group-hover:text-black transition-all">
                          Intercept & Evaluate
                       </button>
                    </div>
                 ))}
                 {pendingSubmissions.length === 0 && <div className="ios-card border-dashed py-32 text-center italic text-slate-700 text-[11px] uppercase tracking-widest opacity-40">No Pending Signals detected...</div>}
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 mt-12 pt-12 border-t border-white/5">
           <div className="xl:col-span-1 space-y-8">
              <div className="ios-card bg-white/[0.02] border-white/5 !p-6 shadow-2xl text-left">
                 <h3 className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest mb-6 flex items-center gap-3">
                    <Clock className="w-4 h-4" /> Personnel Timeline
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
              </div>
           </div>

           <div className="xl:col-span-3 space-y-8 text-left">
              <div className="flex justify-between items-end">
                 <h3 className="text-xl font-black text-white uppercase italic tracking-widest">Scheduled Deliveries</h3>
                 <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{selectedDate.toDateString()}</span>
              </div>
              <div className="space-y-4">
                 {sessions
                    .filter(s => s.scheduled_date === selectedDate.toISOString().split('T')[0])
                    .map(s => (
                       <div key={s.id} className="ios-card bg-white/[0.01] border-white/5 p-8 flex gap-8 group hover:border-[#FF6600]/30 transition-all">
                          <div className="w-20 text-center">
                             <p className="text-2xl font-black text-[#FF6600] italic leading-none">{s.start_time || '00:00'}</p>
                             <Clock className="w-3 h-3 text-slate-800 mx-auto mt-2" />
                          </div>
                          <div className="flex-1 space-y-2">
                             <div className="flex items-center gap-3">
                                <span className="px-2 py-0.5 bg-[#FF6600]/10 text-[#FF6600] text-[8px] font-black uppercase rounded">{s.assignment_type || 'Session'}</span>
                                <h4 className="text-lg font-black text-white uppercase italic">{s.title}</h4>
                             </div>
                             <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{s.program_name} · Phase {s.week_number}</p>
                          </div>
                       </div>
                    ))
                 }
                 {sessions.filter(s => s.scheduled_date === selectedDate.toISOString().split('T')[0]).length === 0 && (
                    <div className="py-20 text-center border border-dashed border-white/5 rounded-3xl opacity-20 italic uppercase tracking-widest text-[11px]">No active mandates for this date.</div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
