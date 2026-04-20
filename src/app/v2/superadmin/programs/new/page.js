'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Briefcase, Zap } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion } from 'framer-motion';

export default function DesignNewProgram() {
  const router = useRouter();
  
  // Form State
  const [programData, setProgramData] = useState({
     name: '',
     description: '',
     start_date: '',
     end_date: ''
  });

  useEffect(() => {
     const sa = localStorage.getItem('sa_session');
     if (sa !== 'prime-2026-active') {
       router.replace('/terminal');
     }
  }, [router]);

  const handleDeploy = async () => {
     if (!programData.name) {
        alert("Please provide at least a Program Name to create the shell.");
        return;
     }

     try {
       const res = await fetch('/api/v2/programs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             name: programData.name,
             description: programData.description,
             status: 'Draft'
          })
       });
       const data = await res.json();
       
       if (data.success) {
          window.dispatchEvent(new CustomEvent('impactos:notify', { 
             detail: { type: 'success', message: 'Program architecture anchored successfully.' } 
          }));
          router.push('/v2/superadmin/programs');
       }
     } catch (err) {
        console.error(err);
        alert("Deployment Failed.");
     }
  };

  return (
    <DashboardLayout role="super_admin" activeTab="v2-architecture">
      <div className="space-y-12">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-10 border-b border-white/5 pb-10">
          <div className="animation-reveal">
            <button 
              onClick={() => router.push('/v2/superadmin/programs')}
              className="btn-ghost !py-2 !px-4 hover:bg-white/5 mb-6"
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> Program Architecture
            </button>
            <div className="flex items-center gap-4 mb-4">
               <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Program Architect v2</span>
               <div className="h-px w-10 bg-indigo-500/30" />
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">
              Deploy Shell
            </h2>
            <p className="text-slate-500 font-bold mt-4 opacity-70 max-w-2xl">
               Initialize the program shell. You will be able to assign a Project Manager and a Knowledge Document to this shell after creation!
            </p>
          </div>
        </header>

        <div className="max-w-2xl mx-auto pt-10">
           
           <div className="space-y-6">
              <div>
                 <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2 mb-2">
                    <Briefcase className="w-5 h-5 text-indigo-400" /> Shell Identity
                 </h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Define the core identity of this cohort.</p>
              </div>
              
              <div className="space-y-4">
                 <input 
                   placeholder="Program Name (e.g., 2026 Incubation Prime)"
                   value={programData.name}
                   onChange={e => setProgramData({...programData, name: e.target.value})}
                   className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 px-8 text-white outline-none focus:border-indigo-500/30 font-black text-xl uppercase tracking-tighter placeholder:normal-case placeholder:text-lg placeholder:tracking-normal placeholder:font-bold placeholder:text-slate-600"
                 />
                 <textarea 
                   rows={4}
                   placeholder="Brief administrative description..."
                   value={programData.description}
                   onChange={e => setProgramData({...programData, description: e.target.value})}
                   className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 px-8 text-white outline-none focus:border-indigo-500/30 font-bold resize-none"
                 />
              </div>
           </div>

        </div>

        <motion.footer 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="fixed bottom-0 left-[280px] right-0 p-6 bg-black/50 backdrop-blur-xl border-t border-white/5 flex justify-between items-center z-[100]"
        >
           <div className="flex items-center gap-4">
              <Zap className="w-5 h-5 text-indigo-500" />
              <div>
                 <p className="font-black text-white uppercase tracking-tighter text-sm">Deployment Readiness</p>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{programData.name ? 'All systems green. Ready to launch.' : 'Awaiting parameters.'}</p>
              </div>
           </div>
           <button 
              onClick={handleDeploy}
              disabled={!programData.name}
              className="btn-prime !py-4 px-12 disabled:opacity-50 disabled:cursor-not-allowed"
           >
              Create Program Shell
           </button>
        </motion.footer>

      </div>
    </DashboardLayout>
  );
}
