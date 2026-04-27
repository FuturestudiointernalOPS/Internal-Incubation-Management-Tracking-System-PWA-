'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Activity, Briefcase, ChevronRight, 
  Search, Filter, LayoutDashboard, Clock, Target, Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function SuperAdminProgressHub() {
  const [programs, setPrograms] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id && !user.cid) {
       router.push('/terminal');
       return;
    }
    
    // Fetch ALL programs for Super Admin
    fetch('/api/v2/pm/programs')
      .then(res => res.json())
      .then(data => {
        if (data.success) setPrograms(data.programs || []);
        setIsLoaded(true);
      })
      .catch(e => {
        console.error(e);
        setIsLoaded(true);
      });
  }, []);

  const filteredPrograms = programs.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="super_admin" activeTab="Progress Hub">
      <div className="space-y-12 pb-20">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-end gap-8">
          <div className="space-y-4">
             <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FF6600]/10 border border-[#FF6600]/20 flex items-center justify-center text-[#FF6600] shadow-xl shadow-[#FF6600]/5">
                   <Activity className="w-6 h-6" />
                </div>
                <div>
                   <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">Global Progress Hub</h2>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Enterprise-wide tactical fulfillment auditing</p>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="relative flex-1 md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input 
                   type="text" 
                   placeholder="Search Programs..." 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold text-white outline-none focus:border-[#FF6600]/40 focus:bg-white/[0.08] transition-all"
                />
             </div>
          </div>
        </header>

        {/* REGISTRY LIST */}
        <div className="grid grid-cols-1 gap-6">
           {filteredPrograms.map((prog, idx) => {
              const progress = prog.completion_index || 0;
              return (
                 <motion.div 
                    key={prog.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => router.push(`/v2/superadmin/programs/${prog.id}`)}
                    className="ios-card bg-white/[0.01] border-white/5 !p-10 group hover:border-[#FF6600]/30 hover:bg-white/[0.02] cursor-pointer transition-all flex flex-col lg:flex-row items-center gap-12"
                 >
                    <div className="flex-1 space-y-6 w-full text-left">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-[#FF6600] transition-colors">
                             <Briefcase className="w-5 h-5" />
                          </div>
                          <div>
                             <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">{prog.name}</h3>
                             <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-2">{prog.sessions_count || 0} Tactical Nodes • {prog.participants_count || 0} Personnel • {prog.reports_count || 0} Reports • Lead: {prog.pm_name || 'Unassigned'}</p>
                          </div>
                       </div>

                       {/* PROGRESS BAR */}
                       <div className="space-y-3">
                          <div className="flex justify-between items-end">
                             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Global Velocity</p>
                             <p className="text-sm font-black text-[#FF6600] italic leading-none">{progress.toFixed(1)}%</p>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                             <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                className="h-full bg-gradient-to-r from-[#FF6600] to-[#FF9900] shadow-[0_0_15px_rgba(255,102,0,0.3)] relative"
                             >
                                <div className="absolute inset-0 bg-white/20 opacity-20 animate-pulse" />
                             </motion.div>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center gap-8 px-12 border-l border-white/5 hidden lg:flex">
                       <div className="text-center">
                          <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-1 italic">Deliverables</p>
                          <p className="text-xl font-black text-white italic">{prog.docs_completed || 0}/{prog.docs_total || 0}</p>
                       </div>
                       <div className="w-px h-8 bg-white/5" />
                       <div className="text-center">
                          <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-1 italic">Status</p>
                          <p className="text-xs font-black text-[#FF6600] uppercase tracking-tighter italic">{prog.status || 'Active'}</p>
                       </div>
                    </div>

                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/5 group-hover:bg-[#FF6600] group-hover:text-black transition-all">
                       <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
                    </div>
                 </motion.div>
              );
           })}

           {isLoaded && filteredPrograms.length === 0 && (
              <div className="ios-card bg-white/[0.01] border-dashed border-white/10 !p-24 flex flex-col items-center justify-center gap-6 opacity-40">
                 <Target className="w-16 h-16 text-slate-800" />
                 <p className="text-sm font-black text-slate-800 uppercase tracking-widest italic text-center leading-relaxed">No programs detected in the global repository.</p>
              </div>
           )}
        </div>
      </div>
    </DashboardLayout>
  );
}
