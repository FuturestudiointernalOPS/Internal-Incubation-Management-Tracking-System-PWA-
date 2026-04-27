'use client';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion } from 'framer-motion';
import { 
  Rocket, Users, Calendar, ArrowRight, Layers, Layout, ChevronRight, Briefcase, Search, Activity
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Globe, Mail, CheckCircle2 } from 'lucide-react';

/**
 * PM OPERATIONS REGISTRY
 * Unified list of all programs assigned to the current PM identity.
 */
export default function PMProgramsRegistry() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();

  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    fetchMyPrograms();
    fetchGlobalSchedule();
  }, []);

  const fetchMyPrograms = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const identifier = user.cid || user.id;
      const res = await fetch('/api/v2/pm/programs?assigned_pm_id=' + identifier);
      const data = await res.json();
      if (data.success) {
        setPrograms(data.programs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalSchedule = async () => {
     try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const identifier = user.cid || user.id;
        // Fetch sessions with dates across all PM programs
        const res = await fetch('/api/v2/pm/schedule?pm_id=' + identifier);
        const data = await res.json();
        if (data.success) {
           setSchedule(data.schedule || []);
        }
     } catch (e) {}
  };

  const getGoogleCalendarLink = (activity) => {
     const title = encodeURIComponent(activity.title);
     const details = encodeURIComponent(activity.description || 'Program Session');
     const startDate = (activity.scheduled_date || new Date().toISOString()).replace(/-/g, '').split('T')[0];
     const endDate = (activity.end_date || activity.scheduled_date || new Date().toISOString()).replace(/-/g, '').split('T')[0];
     
     // Formulating Time Blocks
     const startTime = (activity.start_time || '00:00').replace(/:/g, '') + '00';
     const endTime = (activity.end_time || '23:59').replace(/:/g, '') + '00';
     
     return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${startDate}T${startTime}/${endDate}T${endTime}`;
  };

  const filtered = programs.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <DashboardLayout role="program_manager" activeTab="programs">
      <div className="space-y-12 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-4 mb-4 text-left">
               <span className="text-[#FF6600] font-black text-[10px] uppercase tracking-[0.4em]">Operational Portfolio</span>
               <div className="h-px w-10 bg-[#FF6600]/30" />
               <span className="badge badge-glow-blue uppercase text-[8px] font-black italic">Active Authority</span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none italic">Assigned Programs</h2>
            <p className="text-slate-400 font-bold mt-4 uppercase text-[10px] tracking-widest opacity-60 italic">Track and manage the progress of your assigned educational programs</p>
          </div>
          
          <div className="relative w-full md:w-80">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <input 
               value={search}
               onChange={e => setSearch(e.target.value)}
               placeholder="Filter cohorts..." 
               className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold transition-all" 
             />
          </div>
        </header>

        {/* TACTICAL CALENDAR VIEW */}
        <section className="ios-card bg-white/[0.01] border-white/5 !p-12 overflow-hidden shadow-2xl relative">
           <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF6600]/5 rounded-full blur-[100px] -mr-40 -mt-40" />
           <div className="flex flex-col lg:flex-row justify-between items-start gap-12 relative z-10">
              <div className="space-y-6">
                 <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Operational Schedule</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">Timeline oversight across all cohorts</p>
                 
                 <div className="space-y-4 pt-6">
                    {schedule.slice(0, 3).map(item => (
                       <div key={item.id} className="flex items-center gap-6 group">
                          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center text-[10px] font-black uppercase group-hover:border-[#FF6600]/40 transition-all">
                             <span className="text-[#FF6600]">{new Date(item.scheduled_date).getDate()}</span>
                             <span className="text-slate-500 text-[7px]">{new Date(item.scheduled_date).toLocaleString('default', { month: 'short' })}</span>
                          </div>
                          <div className="flex-1">
                             <p className="text-xs font-black text-white uppercase italic">{item.title}</p>
                             <div className="flex items-center gap-2 mt-1">
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.program_name}</p>
                                <span className="text-slate-800">•</span>
                                <p className="text-[8px] font-black text-[#FF6600] uppercase tracking-widest italic">
                                   {item.start_time || '00:00'} - {item.end_time || '23:59'}
                                   {item.end_date && item.end_date !== item.scheduled_date && ` (to ${item.end_date})`}
                                </p>
                             </div>
                          </div>
                          <a href={getGoogleCalendarLink(item)} target="_blank" className="ml-auto p-2 rounded-lg bg-white/5 text-slate-700 hover:text-[#FF6600] transition-all opacity-0 group-hover:opacity-100">
                             <Mail className="w-3.5 h-3.5" />
                          </a>
                       </div>
                    ))}
                    {schedule.length === 0 && <p className="text-[10px] font-black text-slate-700 uppercase italic">No tactical dates anchored.</p>}
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
                 <div className="grid grid-cols-7 gap-2 text-center text-[8px] font-black text-slate-500 uppercase tracking-widest mb-4">
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

        <div className="grid grid-cols-1 gap-6">
           {loading ? (
              <div className="p-20 text-center space-y-4">
                 <div className="w-12 h-12 border-4 border-[#FF6600]/10 border-t-[#FF6600] rounded-full animate-spin mx-auto" />
                 <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Synchronizing Lifecycle Data...</p>
              </div>
           ) : filtered.length === 0 ? (
              <div className="ios-card py-40 flex flex-col items-center justify-center opacity-30 border-dashed border-white/10">
                 <Layers className="w-20 h-20 text-slate-800 mb-6" />
                 <h4 className="text-2xl font-black text-white uppercase mb-2">No Cohorts Detected</h4>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No programs have been anchored to your identity yet.</p>
              </div>
           ) : (
              filtered.map(program => (
                 <motion.div 
                    key={program.id}
                    onClick={() => router.push(`/v2/pm/programs/${program.id}`)}
                    className="ios-card !p-0 overflow-hidden group cursor-pointer hover:border-[#FF6600]/30 transition-all hover:bg-white/[0.01] border-white/5 shadow-2xl"
                 >
                    <div className="flex flex-col lg:flex-row items-stretch">
                       <div className="p-10 lg:w-[400px] bg-white/[0.02] border-r border-white/5 flex flex-col justify-between">
                          <div>
                             <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 rounded-xl bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/20">
                                   <Briefcase className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] italic animate-pulse">Active Portfolio</span>
                             </div>
                             <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none italic group-hover:text-[#FF6600] transition-colors">{program.name}</h3>
                          </div>
                          <div className="mt-8 flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                             <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Active Lifecycle</span>
                          </div>
                       </div>

                       <div className="flex-1 p-10 flex flex-col justify-between">
                          <p className="text-[13px] text-slate-400 font-bold leading-relaxed uppercase tracking-tight line-clamp-3">
                             {program.description || 'Executing standard operational oversight, ensuring participant progression and milestone synchronization within the FutureStudio incubation framework.'}
                          </p>

                           <div className="space-y-3">
                              <div className="flex justify-between items-end">
                                 <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest italic">Current Velocity</p>
                                 <p className="text-xs font-black text-[#FF6600] italic leading-none">{(program.completion_index || 0).toFixed(1)}%</p>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                 <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${program.completion_index || 0}%` }}
                                    className="h-full bg-gradient-to-r from-[#FF6600] to-[#FF9900] shadow-[0_0_10px_rgba(255,102,0,0.2)]"
                                 />
                              </div>
                           </div>

                          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-8 border-t border-white/5 pt-8">
                             <div>
                                <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest mb-1 italic">Enrolled</p>
                                <p className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2 italic">{program.participants_count || 0} <Users className="w-3.5 h-3.5 text-slate-500" /></p>
                             </div>
                             <div>
                                <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest mb-1 italic">Deliverables</p>
                                <p className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2 italic">{program.docs_completed || 0}/{program.docs_total || 0} <Layers className="w-3.5 h-3.5 text-slate-500" /></p>
                             </div>
                             <div>
                                <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest mb-1 italic">Health</p>
                                <p className="text-lg font-black text-emerald-500 uppercase tracking-tighter flex items-center gap-2 italic">Optimal <Activity className="w-3.5 h-3.5 text-emerald-900" /></p>
                             </div>
                             <div className="flex items-center justify-end">
                                <button className="btn-prime !py-3 !px-6 shadow-xl shadow-blue-600/10">
                                   Launch Terminal <ArrowRight className="w-4 h-4 ml-2" />
                                </button>
                             </div>
                          </div>
                       </div>
                    </div>
                 </motion.div>
              ))
           )}
        </div>
      </div>
    </DashboardLayout>
  );
}
