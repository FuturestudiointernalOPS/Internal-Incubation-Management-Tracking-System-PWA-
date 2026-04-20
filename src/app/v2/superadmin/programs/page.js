'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Filter, Layers, 
  ChevronRight, Users, Rocket, Clock,
  Calendar, CheckCircle, ArrowLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

const ProgramCard = ({ program, onClick }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: "easeOut" }}
    whileHover={{ y: -5 }}
    onClick={onClick}
    className="ios-card group cursor-pointer border border-white/5 hover:border-indigo-500/30 transition-all duration-500"
  >
    <div className="flex justify-between items-start mb-6">
       <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <Layers className="w-6 h-6" />
       </div>
       <div className="text-right">
          <div className="badge badge-glow-success text-[8px] font-black uppercase mb-1">{program.status || 'Active'}</div>
          <p className="text-[10px] font-mono text-slate-500">{program.id}</p>
       </div>
    </div>
    
    <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2 group-hover:text-indigo-400 transition-colors">
       {program.name}
    </h3>
    <p className="text-xs text-slate-400 font-bold mb-6 line-clamp-2">
       {program.description || 'No description available for this program architecture.'}
    </p>

    <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/5">
       <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
             <Calendar className="w-3 h-3" /> Duration
          </div>
          <p className="text-xs font-bold text-white">{program.duration_weeks || 13} Weeks</p>
       </div>
       <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
             <CheckCircle className="w-3 h-3 text-emerald-500" /> Gating
          </div>
          <p className="text-xs font-bold text-white">Advanced</p>
       </div>
    </div>
  </motion.div>
);

export default function ProgramArchitectureHub() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/v2/programs');
        const data = await res.json();
        if (data.success) {
           setPrograms(data.programs || []);
        }
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = programs.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout role="super_admin" activeTab="v2-architecture">
      <div className="space-y-12">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div className="animation-reveal">
            <button 
               onClick={() => router.push('/v2/superadmin')}
               className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6 hover:text-white transition-colors"
            >
               <ArrowLeft className="w-3 h-3" /> Back to HQ
            </button>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Incubation Architecture</h2>
            <p className="text-slate-400 font-bold tracking-tight">Design, manage, and monitor the blueprints of growth.</p>
          </div>
          
          <div className="flex gap-4">
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                   type="text" 
                   placeholder="Search Blueprints..."
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-6 text-sm font-bold text-white focus:outline-none focus:border-indigo-500/30 transition-all"
                />
             </div>
             <button 
                onClick={() => router.push('/v2/superadmin/programs/new')}
                className="btn-prime !py-4 shadow-indigo-600/10"
             >
                <Plus className="w-5 h-5 mr-1" /> New Program
             </button>
          </div>
        </header>

        {loading ? (
           <div className="flex flex-col items-center justify-center py-40 animate-pulse">
              <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Compiling Architectures...</p>
           </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animation-reveal">
            {filtered.map(program => (
              <ProgramCard 
                key={program.id} 
                program={program} 
                onClick={() => router.push(`/v2/pm/programs/${program.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-40 text-center border-2 border-dashed border-white/5 rounded-[2.5rem]">
             <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6">
                <Rocket className="w-10 h-10 text-slate-700" />
             </div>
             <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">No Architectures Found</h3>
             <p className="text-slate-500 font-bold mb-8 max-w-sm">Use the "New Program" button above to design and launch your first incubation cycle.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
