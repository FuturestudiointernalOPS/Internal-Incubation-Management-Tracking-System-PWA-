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

export default function PMV2Dashboard() {
  const router = useRouter();
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPMPrograms();
  }, []);

  const fetchPMPrograms = async () => {
    try {
      const res = await fetch('/api/v2/programs');
      const data = await res.json();
      // In a real scenario, filter programs where pm_id matches current PM
      setPrograms(data.programs || []);
      setIsLoading(false);
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
     </div>
  );

  return (
    <DashboardLayout role="pm" activeTab="v2">
      <div className="space-y-12">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-10 border-b border-white/5 pb-10">
          <div className="animation-reveal">
            <div className="flex items-center gap-4 mb-4">
               <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Management Terminal</span>
               <div className="h-px w-10 bg-indigo-500/30" />
               <span className="badge badge-glow-indigo uppercase text-[8px] font-black">PM AUTHORITY</span>
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">
              My Lifecycle Portfolio
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
                 className="ios-card bg-white/[0.02] border-white/5 p-8 group cursor-pointer hover:border-indigo-500/30 transition-all hover:bg-white/5"
              >
                 <div className="flex justify-between items-start mb-6">
                    <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                       <Rocket className="w-6 h-6" />
                    </div>
                    <span className="badge badge-glow-indigo text-[8px] font-black uppercase">Active</span>
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
                    <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                 </div>
              </div>
           ))}
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-12 pt-12 text-center lg:text-left">
           <div className="ios-card bg-mesh py-12 flex flex-col items-center justify-center space-y-4">
              <Activity className="w-10 h-10 text-indigo-400" />
              <p className="text-[10px] font-black text-white uppercase tracking-widest">Global Sync</p>
              <h5 className="text-2xl font-black text-white italic">0.0ms</h5>
              <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">LATENCY TO V2 LEDGER</p>
           </div>
           <div className="lg:col-span-2 ios-card bg-[#0d0d18] border-white/5 flex flex-col justify-center space-y-8 !p-12">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">PM Directives</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <p className="text-xs font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Visibility Rules</p>
                    <p className="text-[11px] font-bold text-slate-500 leading-relaxed uppercase">You can access sessions, participants, and submissions for your assigned programs.</p>
                 </div>
                 <div className="space-y-2">
                    <p className="text-xs font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">Execution Logic</p>
                    <p className="text-[11px] font-bold text-slate-500 leading-relaxed uppercase">Ensure timelines are synced with topic deliverables in the Terminal.</p>
                 </div>
              </div>
           </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
