'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, Briefcase, Plus, Search, Filter, Mail, Phone,
  ChevronRight, ChevronLeft, LinkIcon, CheckCircle, FileText, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function PMParticipants() {
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [myPrograms, setMyPrograms] = useState([]);
  const [allParticipants, setAllParticipants] = useState([]);
  const [activeProgramId, setActiveProgramId] = useState(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    if (!userData) { router.replace('/terminal'); return; }
    setUser(userData);
    
    // Load programs mapped to this user
    const programsData = JSON.parse(localStorage.getItem('impactos_programs') || '[]');
    const mapped = programsData.filter(p => !p.deleted && String(p.assignedManager) === String(userData.id));
    setMyPrograms(mapped);

    // Load participants
    const participantsData = JSON.parse(localStorage.getItem('impactos_participants') || '[]');
    setAllParticipants(participantsData);
    
    setTimeout(() => setIsLoaded(true), 400);
  }, [router]);

  const copyRegLink = () => {
    const link = `${window.location.origin}/register-participant`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCV = (fileStr, name) => {
    if (!fileStr) return alert("No CV Found");
    // Just a basic mock download logic for base64 file
    const a = document.createElement("a");
    a.href = fileStr;
    a.download = `CV_${name.replace(/\s+/g,'_')}.pdf`;
    a.click();
  };

  if (!isLoaded) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  const theProgram = myPrograms.find(p => p.id === activeProgramId);
  const programParticipants = activeProgramId ? allParticipants.filter(p => String(p.programId) === String(activeProgramId)) : [];

  return (
    <DashboardLayout role="program_manager">
      {!activeProgramId ? (
        <>
          <header className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-12">
            <div className="animation-reveal">
               <div className="flex items-center gap-4 mb-3">
                  <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Audience Overview</span>
                  <div className="h-px w-10 bg-indigo-500/30" />
               </div>
              <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Participant Rosters</h2>
              <p className="text-slate-400 font-bold tracking-tight">
                Select one of your assigned programs to view, manage, and onboard participants.
              </p>
            </div>
          </header>

          {myPrograms.length === 0 ? (
            <div className="ios-card flex flex-col items-center justify-center py-20 text-center">
               <Briefcase className="w-16 h-16 text-indigo-500/30 mb-6" />
               <h3 className="text-2xl font-black text-white tracking-tighter uppercase mb-2">No Programs Assigned</h3>
               <p className="text-slate-400 font-bold max-w-sm">You have not been assigned to lead any active programs yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {myPrograms.map(prog => {
                 const count = allParticipants.filter(x => String(x.programId) === String(prog.id)).length;
                 return (
                  <div key={prog.id} className="ios-card group hover:border-indigo-500/30 transition-all cursor-pointer" onClick={() => setActiveProgramId(prog.id)}>
                    <div className="flex justify-between items-center mb-6">
                      <div className="p-3 bg-indigo-500/10 rounded-xl"><Users className="w-6 h-6 text-indigo-400" /></div>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-md">{count} Members</span>
                    </div>
                    <h4 className="text-2xl font-black text-white uppercase tracking-tight mb-2">{prog.name}</h4>
                    <p className="text-xs text-slate-400 font-bold max-w-[200px] truncate">{prog.description}</p>
                  </div>
                 )
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-10 animation-reveal">
          <button 
            onClick={() => setActiveProgramId(null)} 
            className="btn-ghost !py-2 !px-4 hover:bg-white/5"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Back to Programs
          </button>
          
          <header className="flex flex-col lg:flex-row justify-between items-center gap-6 pb-8 border-b border-white/5">
            <div>
               <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none mb-4">
                 {theProgram?.name} Roster
               </h2>
               <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                  <span className="text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-md">{programParticipants.length} Participants</span>
                  <span className="text-slate-500">Live Enrollment Active</span>
               </div>
            </div>
            <div className="flex gap-4">
               <button onClick={copyRegLink} className="btn-ghost">
                  {copied ? <CheckCircle className="w-5 h-5 mr-2 text-emerald-400" /> : <LinkIcon className="w-5 h-5 mr-2" />}
                  {copied ? 'Link Copied' : 'Share Sign-up Link'}
               </button>
               <button className="btn-prime !py-4" onClick={() => alert("Manual insertion can easily be built similar to the public form.")}>
                  <Plus className="w-5 h-5 mr-2" /> Add Participant
               </button>
            </div>
          </header>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input 
              type="text" placeholder="Search by name or email..." 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-indigo-500/30 transition-colors font-bold placeholder:text-slate-600"
            />
          </div>

          {programParticipants.length === 0 ? (
             <div className="ios-card flex flex-col items-center justify-center py-20 text-center">
                <Users className="w-16 h-16 text-slate-700 mx-auto mb-6" />
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase mb-2">Roster Empty</h3>
                <p className="text-slate-500 font-bold max-w-sm">No one has registered for this program yet. Copy the sign up link and broadcast it!</p>
             </div>
          ) : (
            <div className="ios-card !p-0 overflow-hidden bg-transparent border-none">
              <table className="executive-table w-full">
                <thead>
                  <tr className="bg-transparent border-none shadow-none">
                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-left">Identity</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-left">Contact Info</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-right">App Package</th>
                  </tr>
                </thead>
                <tbody>
                  {programParticipants.map((p) => (
                    <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors rounded-3xl border-b border-white/[0.03]">
                      <td className="px-8 py-7">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-[1rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center font-black text-indigo-400 shadow-xl">
                              {p.fullName.charAt(0)}
                           </div>
                           <div>
                             <p className="font-black text-white uppercase tracking-tighter text-sm mb-1">{p.fullName}</p>
                             <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{p.status}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-7">
                         <div className="flex flex-col gap-2">
                            <span className="flex items-center gap-2 text-xs font-bold text-slate-400"><Mail className="w-3.5 h-3.5" /> {p.email}</span>
                            <span className="flex items-center gap-2 text-xs font-bold text-slate-400"><Phone className="w-3.5 h-3.5" /> {p.phone}</span>
                         </div>
                      </td>
                      <td className="px-8 py-7 text-right">
                         <div className="flex items-center justify-end gap-3">
                           <button 
                             onClick={() => alert(`Project Name/Idea: \n${p.projectIdea}`)} 
                             className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors font-black text-[10px] uppercase tracking-widest shadow-lg"
                             title="Read Startup Idea"
                           >
                              <FileText className="w-4 h-4" />
                           </button>
                           {p.cvFile && (
                             <button 
                               onClick={() => downloadCV(p.cvFile, p.fullName)} 
                               className="p-3 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-lg"
                               title="Download Curriculum Vitae"
                             >
                                <Download className="w-4 h-4" />
                             </button>
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
      )}
    </DashboardLayout>
  );
}
