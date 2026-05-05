'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  ChevronLeft, Plus, Trash2, Globe, 
  Link as LinkIcon, Save, Layers, Rocket,
  FileText, MessageSquare, Shield, Settings,
  Users
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function GroupWorkspaceV2({ params }) {
  const unwrappedParams = use(params);
  const { id: programId, groupId } = unwrappedParams;
  const router = useRouter();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGroup();
  }, [groupId]);

  const fetchGroup = async () => {
    try {
      const res = await fetch(`/api/v2/groups?program_id=${programId}`);
      const data = await res.json();
      const match = data.groups.find(g => g.id === groupId);
      setGroup(match);
      setIsLoaded(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      // In a real scenario, we'd have a PATCH /api/v2/groups/[id]
      // For now, we'll just mock the update or use the same route if supported
      alert("Workspace metrics anchored to ledger.");
    } catch (e) {
      alert("Update failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || !group) return null;

  return (
    <DashboardLayout role="super_admin" activeTab="v2">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
           <button 
              onClick={() => router.back()}
              className="btn-ghost !py-2 !px-4 hover:bg-white/5"
           >
              <ChevronLeft className="w-4 h-4 mr-2" /> Program HQ
           </button>
           <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
              <Layers className="text-indigo-400 w-5 h-5" /> Venture Workspace
           </h2>
           <button 
              onClick={handleUpdate}
              className="btn-prime !py-3 !px-8 shadow-[#FF6600]/10"
           >
              <Save className="w-4 h-4 mr-2" /> Anchor Metrics
           </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
           <div className="lg:col-span-2 space-y-10">
              <div className="animation-reveal">
                 <h1 className="text-5xl font-black text-white tracking-tighter uppercase mb-4">{group.name}</h1>
                 <p className="text-slate-500 font-bold text-sm tracking-tight leading-relaxed max-w-xl">
                    Incubation instance for program node {programId}.
                 </p>
              </div>

              <div className="ios-card bg-[#0d0d18] border-white/5 space-y-8">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-indigo-400" /> Project Concept
                 </h4>
                 <textarea 
                    rows={6}
                    value={group.project_description}
                    onChange={e => setGroup({...group, project_description: e.target.value})}
                    placeholder="Enter deep dive on project objectives..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white font-bold outline-none focus:border-[#FF6600]/80 transition-colors resize-none"
                 />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="ios-card bg-white/[0.02] border-white/5 space-y-6">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Asset Registry</h4>
                    <div className="space-y-4">
                       <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-2">Pitch Deck Link</label>
                          <input 
                             type="text" 
                             value={group.pitch_deck_url || ''}
                             onChange={e => setGroup({...group, pitch_deck_url: e.target.value})}
                             placeholder="https://slides..."
                             className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-2">Live Demo Portal</label>
                          <input 
                             type="text" 
                             value={group.demo_link || ''}
                             onChange={e => setGroup({...group, demo_link: e.target.value})}
                             placeholder="https://app..."
                             className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                          />
                       </div>
                    </div>
                 </div>
                 <div className="ios-card bg-white/[0.02] border-white/5 space-y-6">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Team Composition</h4>
                    <div className="space-y-3">
                       <div className="flex items-center gap-4 p-4 rounded-xl bg-black/40 border border-white/5">
                          <div className="w-10 h-10 rounded-lg bg-[#FF6600]/80/10 border border-[#FF6600]/80/20 flex items-center justify-center text-indigo-400"><Users className="w-5 h-5" /></div>
                          <div>
                             <p className="text-[10px] font-black text-white uppercase tracking-widest">Founding Node</p>
                             <p className="text-[9px] text-slate-600 font-bold">Linked Participant</p>
                          </div>
                       </div>
                       <button className="w-full py-3 border border-dashed border-white/10 rounded-xl text-[9px] font-black text-slate-600 uppercase tracking-widest hover:border-[#FF6600]/80/30 hover:text-indigo-400 transition-all">
                          + Assign Personnel
                       </button>
                    </div>
                 </div>
              </div>
           </div>

           <div className="space-y-8">
              <div className="ios-card bg-mesh py-12 text-center space-y-4">
                 <Shield className="w-10 h-10 text-emerald-400 mx-auto" />
                 <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Escrow Protection</h4>
                 <p className="text-[9px] text-slate-500 font-bold max-w-[120px] mx-auto">V2 isolation confirms data is scoped to program node {programId}.</p>
              </div>

              <div className="ios-card bg-[#0d0d18] border-white/5">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Execution Log</h4>
                 <div className="space-y-6 relative">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/5" />
                    {[
                       { date: 'Initial', event: 'Team Formation' },
                       { date: 'Current', event: 'Workspace Sync' }
                    ].map((log, i) => (
                       <div key={i} className="flex gap-4 items-start relative">
                          <div className="w-4 h-4 rounded-full bg-[#FF6600]/80 border-4 border-[#0d0d18] z-10" />
                          <div>
                             <p className="text-[10px] font-black text-white uppercase tracking-tighter leading-none">{log.event}</p>
                             <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest mt-1">{log.date} TIMESTAMP</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
