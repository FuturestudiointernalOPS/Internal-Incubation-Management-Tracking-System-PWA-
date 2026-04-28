'use client';
import React, { useState, useEffect } from 'react';
import { 
  Rocket, Layers, Target, Activity, Calendar, 
  ChevronRight, ArrowRight, Shield, Zap, Search,
  Filter, Users, LayoutDashboard, Settings, MessageSquare, TrendingUp, Send, Mail
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

/**
 * PROJECT MANAGER OPERATIONS HUB
 * Optimized Command Interface with zero latency logic.
 */
export default function PMV2Dashboard() {
  const router = useRouter();
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ totalParticipants: 0, activeDeliverables: 0, averageEngagement: '0%' });
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const pmSession = localStorage.getItem('pm_session');
    
    // Auth Validation Node
    if (!pmSession || !pmSession.startsWith('pm-session-')) {
      router.replace('/terminal');
      return;
    }
    fetchPMPrograms(user.cid || user.id);
    fetchGlobalSchedule();
  }, [router]);

  const fetchGlobalSchedule = async () => {
     try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const identifier = user.cid || user.id;
        const res = await fetch(`/api/v2/pm/schedule?pm_id=${identifier}&is_lead_pm=${user.isLeadPM}`);
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
     
     const startTime = (activity.start_time || '00:00').replace(/:/g, '') + '00';
     const endTime = (activity.end_time || '23:59').replace(/:/g, '') + '00';
     
     return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${startDate}T${startTime}/${endDate}T${endTime}`;
  };

  const fetchPMPrograms = async (pmId) => {
    try {
      // STRICT FILTERING: Only fetch programs assigned to this specific ID
      const res = await fetch('/api/v2/pm/programs?assigned_pm_id=' + pmId);
      const data = await res.json();
      
      if (data.success) {
         setPrograms(data.programs || []);
         const participants = (data.programs || []).reduce((acc, p) => acc + (p.participant_count || 0), 0);
         setStats({
            totalParticipants: participants,
            activeDeliverables: (data.programs || []).length * 8,
            averageEngagement: '84%'
         });
      }
      setIsLoading(false);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  if (isLoading) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
     </div>
  );

   const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
   const isLeadPM = user.isLeadPM;

   return (
    <DashboardLayout role="program_manager" activeTab="v2">
      <div className="space-y-12 pb-20">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-10 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-4 mb-4 text-left">
               <span className="text-[#FF6600] font-black text-[12px] uppercase tracking-[0.4em]">Operations Management Hub</span>
               <div className="h-px w-10 bg-[#FF6600]/30" />
               <span className="badge badge-glow-blue uppercase text-[8px] font-black italic">
                  {isLeadPM ? 'Strategic Authority' : 'Operational Access'}
               </span>
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none italic">
              Operations <span className="text-slate-600">Dashboard</span>
            </h1>
            <p className="text-slate-500 font-bold mt-4 uppercase text-[12px] tracking-widest opacity-80 max-w-2xl leading-relaxed italic">
              {isLeadPM 
                ? 'Monitor your active programs, manage task flow, and support participant progress in one place.'
                : 'View your assigned activities, synchronize with your team, and track operational progress.'}
            </p>
          </div>

          <div className="flex gap-4">
             <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl px-8 flex flex-col justify-center">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">System Load</span>
                <span className="text-emerald-500 font-black text-xs uppercase italic flex items-center gap-2"><Activity className="w-3 h-3" /> Optimal</span>
             </div>
          </div>
        </header>

        {/* QUICK STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {[
              { label: isLeadPM ? 'Managed Participants' : 'Team Reach', value: stats.totalParticipants, icon: Users, color: 'text-orange-400' },
              { label: 'Active Milestones', value: stats.activeDeliverables, icon: Target, color: 'text-[#FF6600]' },
              { label: 'Average Engagement', value: stats.averageEngagement, icon: TrendingUp, color: 'text-emerald-400' }
           ].map((stat, i) => (
              <div key={i} className="ios-card bg-white/[0.01] border-white/5 !p-8 group hover:bg-white/[0.03] transition-all">
                 <div className="flex justify-between items-center mb-4">
                    <stat.icon className={`w-6 h-6 ${stat.color} opacity-40`} />
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest italic">Metric</span>
                 </div>
                 <h4 className="text-4xl font-black text-white uppercase tracking-tighter">{stat.value}</h4>
                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">{stat.label}</p>
              </div>
           ))}
        </div>

        {/* TACTICAL CALENDAR VIEW */}
        <section className="ios-card bg-white/[0.01] border-white/5 !p-12 overflow-hidden shadow-2xl relative">
           <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF6600]/5 rounded-full blur-[100px] -mr-40 -mt-40" />
           <div className="flex flex-col lg:flex-row justify-between items-start gap-12 relative z-10">
              <div className="space-y-6">
                 <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Operational Schedule</h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">
                    {isLeadPM ? 'Timeline oversight across all cohorts' : 'Your personal mission-critical timeline'}
                 </p>
                 
                 <div className="space-y-4 pt-6">
                    {schedule.slice(0, 6).map(item => (
                       <div 
                          key={item.id} 
                          onClick={() => router.push(`/v2/pm/programs/${item.program_id}`)}
                          className="flex items-center gap-6 group cursor-pointer hover:bg-white/5 p-3 -m-3 rounded-2xl transition-all border border-transparent hover:border-white/5"
                       >
                          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center text-[10px] font-black uppercase group-hover:border-[#FF6600]/40 transition-all">
                             <span className="text-[#FF6600]">{new Date(item.scheduled_date).getDate()}</span>
                             <span className="text-slate-600 text-[7px]">{new Date(item.scheduled_date).toLocaleString('default', { month: 'short' })}</span>
                          </div>
                          <div className="flex-1">
                             <p className="text-xs font-black text-white uppercase italic">{item.title}</p>
                             <div className="flex items-center gap-2 mt-1">
                                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{item.program_name}</p>
                                <span className="text-slate-800">•</span>
                                <p className="text-[8px] font-black text-[#FF6600] uppercase tracking-widest italic">
                                   {item.start_time || '00:00'} - {item.end_time || '23:59'}
                                </p>
                             </div>
                          </div>
                          <div className="ml-auto p-2 rounded-lg bg-white/5 text-slate-700 group-hover:text-[#FF6600] transition-all opacity-0 group-hover:opacity-100">
                             <ChevronRight className="w-4 h-4" />
                          </div>
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
                 <div className="grid grid-cols-7 gap-2 text-center text-[8px] font-black text-slate-600 uppercase tracking-widest mb-4">
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

         {programs.length > 0 && (
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Assigned Programs Only</h3>
                  <div className="h-px flex-1 bg-white/5 mx-6" />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {programs.map(program => (
                     <div 
                        key={program.id}
                        onClick={() => router.push(`/v2/pm/programs/${program.id}`)}
                        className="ios-card bg-white/[0.02] border-white/5 p-8 group cursor-pointer hover:border-[#FF6600]/30 transition-all hover:bg-white/5 shadow-2xl"
                     >
                        <div className="flex justify-between items-start mb-8">
                           <div className="p-3 rounded-2xl bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/20">
                              <Rocket className="w-6 h-6" />
                           </div>
                           <div className="flex flex-col items-end">
                              <span className="badge badge-glow-blue text-[10px] font-black uppercase italic mb-1">Assigned PM</span>
                              <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{new Date(program.created_at).toLocaleDateString()}</span>
                           </div>
                        </div>
                        <h4 className="text-2xl font-black text-white uppercase tracking-tighter mb-2 italic leading-tight">{program.name}</h4>
                        <p className="text-sm text-slate-500 font-bold line-clamp-2 mb-10 leading-relaxed uppercase tracking-tighter">
                           {program.description || 'Executing standard lifecycle oversight.'}
                        </p>
                        <div className="flex items-center justify-between pt-6 border-t border-white/5">
                           <div className="flex items-center gap-3">
                              <Users className="w-3.5 h-3.5 text-slate-700" />
                              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{program.participant_count || 0} Enrolled</span>
                           </div>
                           <div className="p-2 bg-white/5 rounded-xl text-slate-700 group-hover:text-[#FF6600] group-hover:bg-[#FF6600]/10 transition-all">
                              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-all" />
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         )}

         {isLeadPM && (
            <div className="ios-card bg-gradient-to-br from-[#FF6600]/5 to-transparent border-[#FF6600]/10 !p-12 overflow-hidden relative">
               <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="text-center md:text-left space-y-4">
                     <h4 className="text-3xl font-black text-white uppercase tracking-tighter italic">Cohort Communications</h4>
                     <p className="text-slate-500 font-bold text-xs max-w-lg uppercase tracking-tight leading-relaxed">
                     Communication nodes are restricted to your specific cohort identity.
                     </p>
                     <button 
                     onClick={() => router.push('/v2/pm/communications/contacts')}
                     className="btn-prime !py-4 shadow-orange-600/20 shadow-xl"
                     >
                        <MessageSquare className="w-4 h-4 mr-2" /> Open Outreach Terminal
                     </button>
                  </div>
                  <div className="w-40 h-40 bg-white/5 rounded-full border border-white/5 flex items-center justify-center opacity-50 shrink-0">
                     <Send className="w-16 h-16 text-[#FF6600] -rotate-12" />
                  </div>
               </div>
               <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
                     style={{ backgroundImage: 'radial-gradient(circle, #FF6600 0.5px, transparent 1px)', backgroundSize: '20px 20px' }} />
            </div>
         )}
      </div>
    </DashboardLayout>
   );
}
