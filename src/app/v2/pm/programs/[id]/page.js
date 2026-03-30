'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  ChevronLeft, Plus, Calendar, 
  Users, Layers, Settings, MessageSquare, 
  Globe, LayoutDashboard, Search, Filter,
  ArrowRight, Activity, Shield, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

/**
 * PROJECT MANAGER TERMINAL — VERSION 2
 * PM-specific workspace for managing a lifecycle node.
 */
export default function PMProgramTerminalV2({ params }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  const router = useRouter();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview | sessions | staff | participants
  const [program, setProgram] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [groups, setGroups] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ name: '', email: '', screening_status: 'applied' });

  useEffect(() => {
    fetchPMData();
  }, [id]);

  const fetchPMData = async () => {
    try {
      const [progRes, parRes, grpRes, sesRes] = await Promise.all([
         fetch('/api/v2/programs'),
         fetch(`/api/v2/participants?program_id=${id}`),
         fetch(`/api/v2/groups?program_id=${id}`),
         fetch(`/api/v2/sessions?program_id=${id}`)
      ]);

      const progs = await progRes.json();
      setProgram(progs.programs.find(p => p.id === id));
      setParticipants((await parRes.json()).participants || []);
      setGroups((await grpRes.json()).groups || []);
      setSessions((await sesRes.json()).sessions || []);
      setIsLoaded(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddParticipant = async () => {
     try {
        const res = await fetch('/api/v2/participants', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ ...newParticipant, program_id: id })
        });
        const data = await res.json();
        if (data.success) {
           setParticipants([...participants, data.participant]);
           setShowParticipantModal(false);
           setNewParticipant({ name: '', email: '', screening_status: 'applied' });
        }
     } catch (e) { alert("Onboarding failed."); }
  };

  if (!isLoaded || !program) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
     </div>
  );

  return (
    <DashboardLayout role="pm" activeTab="v2">
      <div className="space-y-12">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-10 border-b border-white/5 pb-10">
          <div className="animation-reveal">
            <button 
              onClick={() => router.push('/v2/pm')}
              className="btn-ghost !py-2 !px-4 hover:bg-white/5 mb-6"
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> PM Portfolio
            </button>
            <div className="flex items-center gap-4 mb-4">
               <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Operations Management</span>
               <div className="h-px w-10 bg-indigo-500/30" />
               <span className="badge badge-glow-indigo uppercase text-[8px] font-black italic">Lifecycle Node</span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">
              {program.name}
            </h2>
            <p className="text-slate-500 font-bold mt-4 opacity-70 max-w-2xl leading-relaxed">{program.description || 'No description provided.'}</p>
          </div>
          
          <div className="ios-card bg-indigo-600/5 border-indigo-500/10 !px-8 !py-6 text-right">
             <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Execution Index</p>
             <p className="text-xl font-black text-white uppercase tracking-tighter italic">Week 1 / 13</p>
          </div>
        </header>

        {/* COMPONENT NAVIGATION */}
        <nav className="flex items-center gap-8 border-b border-white/5 pb-0">
           {['overview', 'sessions', 'participants', 'groups'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-6 text-[11px] font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === tab ? 'text-indigo-400' : 'text-slate-500 hover:text-white'}`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div 
                    layoutId="activeTabUnderlinePM"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 rounded-t-full shadow-[0_0_15px_rgba(99,102,241,1)]" 
                  />
                )}
              </button>
           ))}
        </nav>

        <motion.div 
           key={activeTab}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           className="min-h-[400px]"
        >
           {/* TAB DEFINITIONS */}
           {activeTab === 'overview' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                 <div className="xl:col-span-2 ios-card bg-mesh py-24 text-center">
                    <Activity className="w-12 h-12 text-slate-700 mx-auto mb-6" />
                    <h4 className="text-xl font-black text-white uppercase tracking-tighter">PM Operational Grid</h4>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-4">Monitoring lifecycle performance vs baseline.</p>
                 </div>
                 <div className="space-y-6">
                    <div className="ios-card bg-[#0d0d18] border-white/5">
                       <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Program Snapshot</h4>
                       <div className="space-y-4">
                          <div className="flex justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                             <span className="text-[10px] font-black text-white uppercase tracking-widest">Participants</span>
                             <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{participants.length} CAPS</span>
                          </div>
                          <div className="flex justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                             <span className="text-[10px] font-black text-white uppercase tracking-widest">Active Units</span>
                             <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{groups.length} NODES</span>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           )}

           {activeTab === 'participants' && (
              <div className="space-y-8">
                 <div className="flex justify-between items-center px-4">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Participant Asset Registry</h3>
                    <button 
                       onClick={() => setShowParticipantModal(true)}
                       className="btn-prime !py-3 !px-10"
                    >
                       + Synchronize Node
                    </button>
                 </div>

                 {participants.length === 0 ? (
                    <div className="py-40 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                       <Users className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                       <p className="text-slate-600 font-bold max-w-xs mx-auto text-sm uppercase text-[10px] tracking-widest italic">Awaiting node synchronization.</p>
                    </div>
                 ) : (
                    <div className="ios-card !p-0 overflow-hidden">
                       <table className="executive-table">
                          <thead>
                             <tr>
                                {['Identity Node', 'Mail Vector', 'Sync Status', 'Evaluation Index'].map(h => (
                                   <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{h}</th>
                                ))}
                             </tr>
                          </thead>
                          <tbody>
                             {participants.map(p => (
                                <tr key={p.id}>
                                   <td className="px-8 py-6 font-black text-white uppercase tracking-tighter">{p.name}</td>
                                   <td className="px-8 py-6 text-slate-400 font-bold">{p.email}</td>
                                   <td className="px-8 py-6 uppercase font-black text-[10px] text-indigo-400 tracking-widest">{p.status}</td>
                                   <td className="px-8 py-6 uppercase font-black text-[10px] text-emerald-400 tracking-widest">LEVEL 1</td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 )}
              </div>
           )}
        </motion.div>
      </div>

      <AnimatePresence>
         {showParticipantModal && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
               <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="ios-card w-full max-w-lg !p-12 space-y-10"
               >
                  <div>
                     <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Onboard Identity</h3>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Initialize a specific participant record.</p>
                  </div>
                  
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Full Name</label>
                        <input 
                          type="text" 
                          value={newParticipant.name}
                          onChange={e => setNewParticipant({...newParticipant, name: e.target.value})}
                          className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Mail Identity</label>
                        <input 
                          type="email" 
                          value={newParticipant.email}
                          onChange={e => setNewParticipant({...newParticipant, email: e.target.value})}
                          className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold"
                        />
                     </div>
                  </div>

                  <div className="flex gap-4 pt-6">
                     <button onClick={() => setShowParticipantModal(false)} className="flex-1 btn-ghost !py-4">Cancel</button>
                     <button onClick={handleAddParticipant} className="flex-1 btn-prime !py-4">Confirm Onboarding</button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
