'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, Briefcase, Plus, CheckCircle2, Clock, 
  TrendingUp, Calendar, Shield, Zap, 
  Filter, Download, MoreVertical, ArrowUpRight,
  Activity, Settings, UserCheck, ChevronRight,
  Target, ChartBar, ChevronLeft, LinkIcon, FileText, Layers, FolderRoot
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

const ProgramCard = ({ title, subtitle, icon: Icon, onClick }) => (
  <button 
    onClick={onClick}
    className="ios-card group text-left w-full hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
  >
     <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-indigo-500/0 group-hover:from-indigo-500/5 group-hover:to-transparent transition-colors duration-500" />
     <div className="relative z-10 flex flex-col gap-6">
       <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500/20 transition-all duration-500 shadow-[0_0_20px_rgba(99,102,241,0.1)] group-hover:shadow-[0_0_30px_rgba(99,102,241,0.2)]">
         <Icon className="w-8 h-8 text-indigo-400 group-hover:text-white transition-colors" />
       </div>
       <div>
         <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2 group-hover:text-indigo-400 transition-colors">{title}</h3>
         <p className="text-sm text-slate-400 font-bold leading-relaxed">{subtitle}</p>
       </div>
       <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
          <span>Manage Module</span>
          <ChevronRight className="w-3 h-3" />
       </div>
     </div>
  </button>
);

export default function PMPrograms() {
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [myPrograms, setMyPrograms] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [activeProgramId, setActiveProgramId] = useState(null);
  const [activeProgramCard, setActiveProgramCard] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    if (!userData) { router.replace('/terminal'); return; }
    setUser(userData);
    
    // Load programs mapped to this user
    const programsData = JSON.parse(localStorage.getItem('impactos_programs') || '[]');
    const mapped = programsData.filter(p => !p.deleted && String(p.assignedManager) === String(userData.id));
    setMyPrograms(mapped);

    // Load projects
    const projectsData = JSON.parse(localStorage.getItem('impactos_projects') || '[]');
    setAllProjects(projectsData.filter(p => !p.deleted));
    
    setTimeout(() => setIsLoaded(true), 400);
  }, [router]);

  const saveState = (key, data) => localStorage.setItem(key, JSON.stringify(data));

  const handleSaveProgramDetails = (type) => {
    let urlId = ''; let textId = ''; let urlKey = ''; let textKey = '';
    
    if (type === 'concept') { urlId = 'conceptUrl'; textId = 'conceptText'; urlKey = 'conceptNoteUrl'; textKey = 'conceptNote'; }
    if (type === 'mission') { urlId = 'missionUrl'; textId = 'missionText'; urlKey = 'missionUrl'; textKey = 'missionVision'; }
    if (type === 'kpis') { urlId = 'kpisUrl'; textId = 'kpisText'; urlKey = 'kpisUrl'; textKey = 'kpis'; }
    if (type === 'schedule') { urlId = 'scheduleUrl'; textId = 'scheduleText'; urlKey = 'scheduleUrl'; textKey = 'topics'; }

    const urlValue = document.getElementById(urlId)?.value || '';
    const textValue = document.getElementById(textId)?.value || '';

    const allPrograms = JSON.parse(localStorage.getItem('impactos_programs') || '[]');
    const updatedPrograms = allPrograms.map(p => {
      if (p.id === activeProgramId) { return { ...p, [urlKey]: urlValue, [textKey]: textValue }; }
      return p;
    });

    saveState('impactos_programs', updatedPrograms);
    setMyPrograms(updatedPrograms.filter(p => !p.deleted && String(p.assignedManager) === String(user.id)));
    
    setActiveProgramCard(null);
  };

  if (!isLoaded) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  const theProgram = myPrograms.find(p => p.id === activeProgramId);
  const programProjects = activeProgramId ? allProjects.filter(p => String(p.programId) === String(activeProgramId)) : [];

  return (
    <DashboardLayout role="program_manager">
      {!activeProgramId ? (
        <>
          <header className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-12">
            <div className="animation-reveal">
               <div className="flex items-center gap-4 mb-3">
                  <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Program Hierarchy</span>
                  <div className="h-px w-10 bg-indigo-500/30" />
               </div>
              <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">My Assigned Programs</h2>
              <p className="text-slate-400 font-bold tracking-tight">
                Select a program to configure its settings and view its nested projects.
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
              {myPrograms.map(prog => (
                <div key={prog.id} className="ios-card group hover:border-indigo-500/30 transition-all cursor-pointer" onClick={() => setActiveProgramId(prog.id)}>
                  <div className="flex justify-between items-center mb-6">
                    <div className="p-3 bg-indigo-500/10 rounded-xl"><Layers className="w-6 h-6 text-indigo-400" /></div>
                    <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-md">Active</span>
                  </div>
                  <h4 className="text-2xl font-black text-white uppercase tracking-tight mb-2">{prog.name}</h4>
                  <p className="text-xs text-slate-400 font-bold max-w-[200px] truncate">{prog.description}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-10 animation-reveal">
          <button 
            onClick={() => { setActiveProgramId(null); setActiveProgramCard(null); }} 
            className="btn-ghost !py-2 !px-4 hover:bg-white/5"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Back to My Programs
          </button>
          
          <header className="flex flex-col lg:flex-row justify-between items-end gap-10 pb-8 border-b border-white/5">
            <div>
               <div className="flex items-center gap-4 mb-3">
                  <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Structure HQ</span>
                  <div className="h-px w-10 bg-indigo-500/30" />
               </div>
               <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">
                 {theProgram?.name}
               </h2>
               <p className="text-slate-400 font-bold mt-4 max-w-xl opacity-70">Define operations, mission, and KPI signals for this lifecycle.</p>
            </div>
          </header>

          {!activeProgramCard ? (
            <div className="space-y-10">
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                 <ProgramCard icon={FileText} title="Concept Note" subtitle="The AI-linked core philosophy definitions." onClick={() => setActiveProgramCard('concept')} />
                 <ProgramCard icon={Target} title="Mission & Vision" subtitle="Strategic goals and future scaling outlook." onClick={() => setActiveProgramCard('mission')} />
                 <ProgramCard icon={ChartBar} title="KPI Signal Mapping" subtitle="Trackable metrics for venture success." onClick={() => setActiveProgramCard('kpis')} />
                 <ProgramCard icon={Calendar} title="Operational Schedule" subtitle="Curriculum phases and weekly topics." onClick={() => setActiveProgramCard('schedule')} />
                 <ProgramCard icon={Users} title="Personnel Requests" subtitle="Manage staff assignments for this program." onClick={() => setActiveProgramCard('team')} />
               </div>

               {/* PROJECTS DIRECTORY SECTION */}
               <div className="pt-10 border-t border-white/5 space-y-6">
                 <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Nested Projects</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-md">{programProjects.length} Total</span>
                 </div>
                 {programProjects.length === 0 ? (
                    <div className="ios-card flex flex-col items-center justify-center py-10 text-center">
                       <FolderRoot className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                       <h3 className="text-xl font-black text-white tracking-tighter uppercase mb-2">No Projects Found</h3>
                       <p className="text-slate-500 font-bold">There are currently no projects nested under this program.</p>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                       {programProjects.map(proj => (
                         <div key={proj.id} className="ios-card group border border-white/[0.02]">
                            <div className="flex justify-between items-start mb-6">
                               <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-[12px] text-white">
                                 {proj.name.charAt(0)}
                               </div>
                               <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${proj.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                 {proj.status}
                               </span>
                            </div>
                            <h4 className="text-lg font-black text-white uppercase tracking-tight mb-2 truncate">{proj.name}</h4>
                            <p className="text-xs text-slate-500 font-bold capitalize mb-4">{proj.type}</p>
                            <div className="pt-4 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white cursor-pointer transition-colors">
                               Open Project <ArrowUpRight className="w-3 h-3" />
                            </div>
                         </div>
                       ))}
                    </div>
                 )}
               </div>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="ios-card !p-12 space-y-10"
            >
               <button onClick={() => setActiveProgramCard(null)} className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] flex items-center gap-2 hover:opacity-70 transition-opacity">
                  <ChevronLeft className="w-4 h-4" /> Return to Modules
               </button>

               {activeProgramCard === 'concept' && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Program Concept Note</h3>
                      <p className="text-slate-400 font-bold opacity-70">Formally define the boundaries and expectations of operations.</p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Provide a Link (Optional)</label>
                      <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-white focus-within:border-indigo-500/40 transition-colors hover:border-white/10">
                        <LinkIcon className="w-5 h-5 text-indigo-400" />
                        <input id="conceptUrl" type="url" placeholder="Paste a link to Google Docs, Notion, PDF, etc." defaultValue={theProgram?.conceptNoteUrl || ''} className="bg-transparent w-full outline-none text-sm font-bold placeholder:text-slate-600" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Or Type Details Directly</label>
                      <textarea id="conceptText"
                        placeholder="Write concept note details here..." 
                        defaultValue={theProgram?.conceptNote} 
                        className="w-full min-h-[250px] bg-white/[0.03] border border-white/5 rounded-3xl p-8 text-white outline-none focus:border-indigo-500/40 transition-colors custom-scrollbar font-bold leading-relaxed hover:border-white/10" 
                      />
                    </div>
                    <button onClick={() => handleSaveProgramDetails('concept')} className="btn-prime !py-4 !px-10">Save Concept Note</button>
                  </div>
               )}
               
               {activeProgramCard === 'mission' && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Mission & Vision</h3>
                      <p className="text-slate-400 font-bold opacity-70">The strategic core of this program&apos;s existence.</p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Provide a Link (Optional)</label>
                      <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-white focus-within:border-indigo-500/40 transition-colors hover:border-white/10">
                        <LinkIcon className="w-5 h-5 text-indigo-400" />
                        <input id="missionUrl" type="url" placeholder="Paste a link to Google Docs, Notion, PDF, etc." defaultValue={theProgram?.missionUrl || ''} className="bg-transparent w-full outline-none text-sm font-bold placeholder:text-slate-600" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Or Type Details Directly</label>
                      <textarea id="missionText"
                        placeholder="Write the mission and vision..." 
                        defaultValue={theProgram?.missionVision} 
                        className="w-full min-h-[250px] bg-white/[0.03] border border-white/5 rounded-3xl p-8 text-white outline-none focus:border-indigo-500/40 transition-colors custom-scrollbar font-bold leading-relaxed hover:border-white/10" 
                      />
                    </div>
                    <button onClick={() => handleSaveProgramDetails('mission')} className="btn-prime !py-4 !px-10">Save Strategy</button>
                  </div>
               )}
               
               {activeProgramCard === 'kpis' && (
                  <div className="space-y-8">
                     <div>
                      <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">KPI Signal Mapping</h3>
                      <p className="text-slate-400 font-bold opacity-70">List trackable parameters for program success.</p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Provide a Link (Optional)</label>
                      <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-white focus-within:border-indigo-500/40 transition-colors hover:border-white/10">
                        <LinkIcon className="w-5 h-5 text-indigo-400" />
                        <input id="kpisUrl" type="url" placeholder="Paste a link to Google Docs, Notion, PDF, etc." defaultValue={theProgram?.kpisUrl || ''} className="bg-transparent w-full outline-none text-sm font-bold placeholder:text-slate-600" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Or Type Details Directly</label>
                      <textarea id="kpisText"
                        placeholder="List what will be tracked for success..." 
                        defaultValue={theProgram?.kpis} 
                        className="w-full min-h-[250px] bg-white/[0.03] border border-white/5 rounded-3xl p-8 text-white outline-none focus:border-indigo-500/40 transition-colors custom-scrollbar font-bold leading-relaxed hover:border-white/10" 
                      />
                    </div>
                    <button onClick={() => handleSaveProgramDetails('kpis')} className="btn-prime !py-4 !px-10">Save KPIs</button>
                  </div>
               )}
               
               {activeProgramCard === 'schedule' && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Curriculum Flow</h3>
                      <p className="text-slate-400 font-bold opacity-70">Define weekly phases and milestones.</p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Provide a Link (Optional)</label>
                      <div className="flex items-center gap-4 bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-white focus-within:border-indigo-500/40 transition-colors hover:border-white/10">
                        <LinkIcon className="w-5 h-5 text-indigo-400" />
                        <input id="scheduleUrl" type="url" placeholder="Paste a link to Google Docs, Notion, PDF, etc." defaultValue={theProgram?.scheduleUrl || ''} className="bg-transparent w-full outline-none text-sm font-bold placeholder:text-slate-600" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Or Type Details Directly</label>
                      <textarea id="scheduleText"
                        placeholder="Week 1: Pre-incubation basics...&#10;Week 2: Product Validation..." 
                        defaultValue={theProgram?.topics} 
                        className="w-full min-h-[250px] bg-white/[0.03] border border-white/5 rounded-3xl p-8 text-white outline-none focus:border-indigo-500/40 transition-colors custom-scrollbar font-bold leading-relaxed hover:border-white/10" 
                      />
                    </div>
                    <button onClick={() => handleSaveProgramDetails('schedule')} className="btn-prime !py-4 !px-10">Save Schedule</button>
                  </div>
               )}
               
               {activeProgramCard === 'team' && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Personnel Pipeline</h3>
                      <p className="text-slate-400 font-bold opacity-70">Assign staff to this program.</p>
                    </div>
                    
                    <div className="p-12 text-center bg-white/5 rounded-[3rem] border border-dashed border-white/10 group">
                       <Users className="w-16 h-16 text-slate-700 mx-auto mb-6 group-hover:text-indigo-500 transition-colors duration-500" />
                       <p className="text-slate-500 font-bold max-w-xs mx-auto">This UI is reserved for assigning staff members logically. (Pending detailed implementation)</p>
                    </div>
                  </div>
               )}
            </motion.div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
