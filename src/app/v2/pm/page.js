'use client';

import React, { useState, useEffect } from 'react';
import { 
  Rocket, Layers, Target, Activity, Calendar, 
  ChevronRight, ArrowRight, Shield, Zap, Search,
  Filter, Users, LayoutDashboard, Settings
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { prefetchData } from '@/utils/prefetch';

export default function PMV2Dashboard() {
  const router = useRouter();
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const pmSession = localStorage.getItem('pm_session');
    
    if (!pmSession || user.roleLabel !== 'Program Manager') {
      router.replace('/terminal');
      return;
    }
    fetchPMPrograms(user.id);
  }, [router]);

  const fetchPMPrograms = async (pmId) => {
    try {
      const res = await fetch('/api/v2/programs');
      const data = await res.json();
      
      // Filter programs explicitly for this PM
      const assigned = (data.programs || []).filter(p => p.assigned_pm_id === pmId);
      setPrograms(assigned);
      setIsLoading(false);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  if (isLoading) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#0066FF]/20 border-t-[#0066FF] rounded-full animate-spin" />
     </div>
  );

  return (
    <DashboardLayout role="program_manager" activeTab="v2">
      <div className="space-y-12">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-10 border-b border-white/5 pb-10">
          <div className="animation-reveal">
            <div className="flex items-center gap-4 mb-4 text-left">
               <span className="text-[#0066FF] font-black text-[10px] uppercase tracking-[0.4em]">Main Dashboard</span>
               <div className="h-px w-10 bg-[#0066FF]/30" />
               <span className="badge badge-glow-blue uppercase text-[8px] font-black italic">PM Access</span>
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">
              My Programs
            </h1>
            <p className="text-slate-500 font-bold mt-4 opacity-70 max-w-2xl">
              Executing program oversight across assigned incubation nodes.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {programs.map(program => (
                <div 
                   key={program.id}
                   onClick={() => router.push(`/v2/pm/programs/${program.id}`)}
                   onMouseEnter={() => prefetchData(`/api/v2/pm/full-state?id=${program.id}`, `pm_program_${program.id}`)}
                   className="ios-card bg-white/[0.02] border-white/5 p-8 group cursor-pointer hover:border-[#0066FF]/30 transition-all hover:bg-white/5"
                >
                  <div className="flex justify-between items-start mb-6">
                     <div className="p-3 rounded-xl bg-[#0066FF]/10 text-[#0066FF]">
                        <Rocket className="w-6 h-6" />
                     </div>
                     <span className="badge badge-glow-blue text-[8px] font-black uppercase italic">Active Node</span>
                  </div>
                 <h4 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{program.name}</h4>
                 <p className="text-xs text-slate-500 font-bold line-clamp-2 mb-8 leading-relaxed">
                    {program.description || 'No description provided.'}
                 </p>
                 <div className="flex items-center justify-between pt-6 border-t border-white/5">
                    <div className="flex -space-x-2">
                       {[1,2,3].map(i => (
                          <div key={i} className="w-6 h-6 rounded-full bg-slate-800 border-2 border-[#0d0d18] flex items-center justify-center text-[7px] font-black text-white italic">FS</div>
                       ))}
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-[#0066FF] group-hover:translate-x-1 transition-all" />
                 </div>
              </div>
           ))}
        </div>


      </div>
    </DashboardLayout>
  );
}
