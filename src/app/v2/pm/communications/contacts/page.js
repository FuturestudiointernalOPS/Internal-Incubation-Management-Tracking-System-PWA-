'use client';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Mail, Search, MessageCircle, Send, Shield, Loader2, ChevronRight, Filter, Briefcase
} from 'lucide-react';
import { IMPACT_CACHE } from '@/utils/impactCache';

/**
 * COHORT OUTREACH TERMINAL (PM RESTRICTED)
 * Specialized communication suite for assigned program participants.
 */
export default function PMCohortOutreach() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('All Assignments');
  const [assignedPrograms, setAssignedPrograms] = useState([]);

  useEffect(() => { 
    fetchAssignedRegistry();
  }, []);

  const fetchAssignedRegistry = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      // 1. Fetch programs to identify assignments
      const progRes = await fetch('/api/v2/pm/programs?assigned_pm_id=' + user.id);
      const progData = await progRes.json();
      const myProgs = progData.programs || [];
      setAssignedPrograms(myProgs);

      // 2. Fetch contacts (The API should ideally handle the filtering, but we can filter here for now if the PM has a unique list)
      // In this specialized PM view, we only show participants from their assigned IDs
      const res = await fetch('/api/v2/contacts/full-state');
      const data = await res.json();
      
      if (data.success) {
        const myProgIds = myProgs.map(p => p.id);
        const myProgNames = myProgs.map(p => p.name.toUpperCase());
        
        const filteredToPM = (data.contacts || []).filter(c => {
           const matchesId = myProgIds.includes(c.program_id);
           const matchesGroupName = c.group_name && myProgNames.includes(c.group_name.toUpperCase());
           return matchesId || matchesGroupName;
        });

        setContacts(filteredToPM);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = contacts.filter(c => {
    const searchVal = search.toLowerCase();
    const nameMatch = (c.name || '').toLowerCase().includes(searchVal);
    const emailMatch = (c.email || '').toLowerCase().includes(searchVal);
    const matchesSearch = nameMatch || emailMatch;
    
    const matchesProgram = selectedProgram === 'All Assignments' || c.group_name?.toUpperCase() === selectedProgram.toUpperCase();
    return matchesSearch && matchesProgram;
  });

  const getWhatsAppLink = (c) => {
     const phone = (c.phone || '').replace(/[^0-9]/g, '');
     if (!phone) return '#';
     const message = `Hello ${c.name},\n\nThis is your Program Manager from ImpactOS. I am reaching out regarding the ${c.group_name || 'Program'} cohort.`;
     return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <DashboardLayout role="program_manager" activeTab="communication">
      <div className="space-y-12 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-4 mb-4 text-left">
               <span className="text-[#FF6600] font-black text-[10px] uppercase tracking-[0.4em]">Operations Outreach</span>
               <div className="h-px w-10 bg-[#FF6600]/30" />
               <span className="badge badge-glow-blue uppercase text-[8px] font-black italic">PM Authority</span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none italic">Cohort Registry</h2>
            <p className="text-slate-500 font-bold mt-4 uppercase text-[10px] tracking-widest opacity-60">Restricted access to your assigned program participants</p>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 font-sans">
           <div className="xl:col-span-1 space-y-6">
              <div className="ios-card !p-8 border-white/5 space-y-8 shadow-2xl">
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search participants..." className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white outline-none focus:border-[#FF6600]/50 font-bold transition-all" />
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 opacity-60">Assigned Cohorts</h4>
                    <div className="space-y-1">
                       <button onClick={() => setSelectedProgram('All Assignments')} className={`w-full text-left px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedProgram === 'All Assignments' ? 'bg-[#FF6600] text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}>All Assignments</button>
                       {assignedPrograms.map(p => (
                          <button key={p.id} onClick={() => setSelectedProgram(p.name)} className={`w-full text-left px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedProgram === p.name ? 'bg-white/10 text-white border border-white/10' : 'text-slate-400 hover:bg-white/5'}`}>{p.name}</button>
                       ))}
                    </div>
                 </div>
              </div>
           </div>

           <div className="xl:col-span-3 space-y-6">
              {loading ? (
                 <div className="p-20 text-center"><Loader2 className="w-12 h-12 text-[#FF6600] animate-spin mx-auto mb-6" /><p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Filtering Assigned Registry...</p></div>
              ) : filtered.length === 0 ? (
                 <div className="ios-card bg-white/[0.01] border-white/5 py-40 flex flex-col items-center justify-center text-center">
                    <Shield className="w-20 h-20 text-slate-800 mb-6 opacity-10" />
                    <h4 className="text-2xl font-black text-white uppercase mb-2">No Records Found</h4>
                    <p className="text-slate-500 font-bold text-xs max-w-sm uppercase tracking-widest opacity-60">You only have access to participants in your assigned cohorts.</p>
                 </div>
              ) : (
                <div className="ios-card !p-0 overflow-hidden border-white/5 shadow-2xl bg-white/[0.01]">
                 <table className="executive-table w-full">
                   <thead>
                     <tr className="border-b border-white/5 bg-white/[0.02]">
                       <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Participant Identity</th>
                       <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">Assignment Node</th>
                       <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Outreach</th>
                     </tr>
                   </thead>
                   <tbody>
                     {filtered.map(c => (
                       <tr key={c.cid} className="group hover:bg-white/[0.01] transition-colors border-b border-white/[0.02]">
                         <td className="px-8 py-8">
                           <p className="font-black text-white uppercase tracking-tighter text-xl leading-none mb-2 italic">{c.name}</p>
                           <p className="text-[10px] font-bold text-slate-500 font-mono lower">{c.email}</p>
                         </td>
                         <td className="px-8 py-8">
                           <div className="flex items-center gap-2">
                              <Briefcase className="w-3.5 h-3.5 text-[#FF6600] opacity-50" />
                              <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest bg-[#FF6600]/10 px-3 py-1 rounded-full border border-[#FF6600]/20 cursor-default">{c.group_name || 'Active Cohort'}</span>
                           </div>
                         </td>
                         <td className="px-8 py-8 text-right">
                           <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                              <a href={`mailto:${c.email}`} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all border border-transparent hover:border-white/10"><Mail className="w-5 h-5" /></a>
                              {c.phone && (
                                 <a href={getWhatsAppLink(c)} target="_blank" rel="noopener noreferrer" className="p-3 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white rounded-xl text-emerald-500 transition-all border border-transparent hover:border-emerald-500/20"><MessageCircle className="w-5 h-5" /></a>
                              )}
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                </div>
              )}
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
