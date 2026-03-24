'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Activity, Shield, Link as LinkIcon, 
  Layers, FolderRoot, UserPlus, FileText, Target, Calendar,
  Trash2, CheckCircle, Eye, EyeOff, MessageCircle, Key, ChartBar,
  AlertCircle, ChevronLeft, ChevronRight, ArrowRight, Search, List, Trash, RefreshCcw, LayoutDashboard,
  TrendingUp, Zap, Sparkles, Filter, Download, Camera, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function SuperAdminHQ() {
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();

  // Core Data States
  const [view, setView] = useState('dashboard'); // dashboard | programs | programDetails | projects | staff | activity | recycleBin
  const [activeProgramId, setActiveProgramId] = useState(null);
  const [activeProgramCard, setActiveProgramCard] = useState(null); // concept | mission | kpis | schedule | team

  const [staffList, setStaffList] = useState([]);
  const [programList, setProgramList] = useState([]);
  const [projectList, setProjectList] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);

  // Modals
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);
  // Forms
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [showPasswordMap, setShowPasswordMap] = useState({});
  const [copied, setCopied] = useState(false);

  // Table State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    const sa = localStorage.getItem('sa_session');
    const userData = localStorage.getItem('user');
    
    if (sa !== 'prime-2026-active' || !userData) {
      router.replace('/sa-hq-sp-2026-v1/login');
      return;
    }
    
    setUser(JSON.parse(userData));
    setStaffList(JSON.parse(localStorage.getItem('impactos_staff') || '[]'));
    setProgramList(JSON.parse(localStorage.getItem('impactos_programs') || '[]'));
    setProjectList(JSON.parse(localStorage.getItem('impactos_projects') || '[]'));
    setActivityLogs(JSON.parse(localStorage.getItem('impactos_logs') || '[]'));
    setTimeout(() => setIsLoaded(true), 500);
  }, [router]);

  const saveState = (key, data) => { localStorage.setItem(key, JSON.stringify(data)); };
  
  const saveLogs = (newLogs) => { setActivityLogs(newLogs); saveState('impactos_logs', newLogs); };
  const logAction = (action) => {
    const newLog = { id: Date.now(), text: action, time: new Date().toLocaleString() };
    saveLogs([newLog, ...activityLogs]);
  };

  const copyRegLink = () => {
    const link = `${window.location.origin}/register-staff`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddStaff = (formData) => {
    setFeedback({ message: '', type: '' });
    const cleanEmail = formData.email.replace(/\s+/g, '').toLowerCase();

    const isDuplicate = staffList.some(s => !s.deleted && (s.email || '').replace(/\s+/g, '').toLowerCase() === cleanEmail);
    
    if (isDuplicate) {
      setFeedback({ message: 'Personnel with this email already exists.', type: 'error' });
      return;
    }

    const unsecurePassword = Math.random().toString(36).slice(-8);
    const newStaff = { 
      ...formData, 
      id: Date.now(), 
      password: unsecurePassword, 
      status: 'approved', 
      deleted: false 
    };
    
    const updatedList = [...staffList, newStaff];
    setStaffList(updatedList);
    saveState('impactos_staff', updatedList);
    logAction(`Added new personnel: ${newStaff.fullName}`);

    setFeedback({ message: 'Personnel registered successfully!', type: 'success' });
    setTimeout(() => {
      setShowStaffModal(false);
      setFeedback({ message: '', type: '' });
    }, 1500); 
  };

  const deleteStaffSoft = (id) => {
    if(!window.confirm("Soft Delete: Move this person to the Recycle Bin?")) return;
    const newList = staffList.map(x => x.id === id ? { ...x, deleted: true } : x);
    setStaffList(newList);
    saveState('impactos_staff', newList);
    logAction(`Moved a staff member to Recycle Bin.`);
  };

  const restoreStaff = (id) => {
    const newList = staffList.map(x => x.id === id ? { ...x, deleted: false } : x);
    setStaffList(newList);
    saveState('impactos_staff', newList);
    logAction(`Restored a staff member from Recycle Bin.`);
  };

  const permDeleteStaff = (id) => {
    if(!window.confirm("WARNING: Permanently delete this record? This cannot be undone.")) return;
    const newList = staffList.filter(x => x.id !== id);
    setStaffList(newList);
    saveState('impactos_staff', newList);
    logAction(`Permanently deleted a staff member.`);
  };

  const deleteIndividualLog = (id) => {
    const pw = window.prompt("SECURITY VERIFICATION: Enter Super Admin access code to delete this audit record.");
    if (pw === '147369') {
      const updated = activityLogs.filter(log => log.id !== id);
      saveLogs(updated);
    } else if (pw !== null) {
      alert("INCORRECT ACCESS CODE: Authorization failed.");
    }
  };

  const resetPassword = (id) => {
    if(!window.confirm("Are you sure you want to reset their password?")) return;
    const newPassword = Math.random().toString(36).slice(-8);
    const newList = staffList.map(s => s.id === id ? { ...s, password: newPassword } : s);
    setStaffList(newList);
    saveState('impactos_staff', newList);
    logAction(`Reset password for a staff member.`);
    alert(`Password reset successfully!\nNew Password: ${newPassword}`);
  };

  const togglePassword = (id) => { setShowPasswordMap(prev => ({ ...prev, [id]: !prev[id] })); };

  // --- PROGRAM HANDLERS ---
  const handleAddProgram = (formData) => {
    const newProgram = { 
      ...formData, id: Date.now(), status: 'Active', deleted: false,
      conceptNote: "Define the core concept here...",
      missionVision: "Define the Mission & Vision here...",
      kpis: "Define trackable KPIs here...",
      weeks: 0, topics: "Define the syllabus topics...",
      teamRequested: []
    };
    
    if (formData.assignedManager) {
      const updatedStaff = staffList.map(s => {
        if (s.id.toString() === formData.assignedManager) {
           logAction(`Promoted ${s.fullName} to Program Manager for ${newProgram.name}`);
           return { ...s, role: 'program_manager', programId: newProgram.id, programName: newProgram.name };
        }
        return s;
      });
      setStaffList(updatedStaff);
      saveState('impactos_staff', updatedStaff);
    }

    const updated = [...programList, newProgram];
    setProgramList(updated);
    saveState('impactos_programs', updated);
    logAction(`Created new program: ${newProgram.name}`);

    setShowProgramModal(false);
  };

  const deleteProgramSoft = (id) => {
    if(!window.confirm("Soft Delete: Move this program to the Recycle Bin?")) return;
    const newList = programList.map(x => x.id === id ? { ...x, deleted: true } : x);
    setProgramList(newList);
    saveState('impactos_programs', newList);
    logAction(`Moved a program to Recycle Bin.`);
  };

  const restoreProgram = (id) => {
    const newList = programList.map(x => x.id === id ? { ...x, deleted: false } : x);
    setProgramList(newList);
    saveState('impactos_programs', newList);
    logAction(`Restored a program from Recycle Bin.`);
  };

  // Safe Filtered Lists
  const activeStaff = staffList.filter(s => !s.deleted);
  const activePrograms = programList.filter(p => !p.deleted);
  const activeProjects = projectList.filter(p => !p.deleted);
  const deletedStaff = staffList.filter(s => s.deleted);
  const deletedPrograms = programList.filter(p => p.deleted);

  const filteredStaff = activeStaff.filter(s => 
    s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const totalPages = Math.ceil(filteredStaff.length / itemsPerPage);
  const currentStaffDisplay = filteredStaff.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleViewChange = (newView) => {
    setView(newView);
    setShowStaffModal(false);
    setShowProgramModal(false);
  };

  const goToProgramDetails = (id) => { 
    setActiveProgramId(id); 
    setActiveProgramCard(null); 
    handleViewChange('programDetails'); 
  };
  const theProgram = activeProgramId ? activePrograms.find(p => p.id === activeProgramId) : null;

  if (!isLoaded) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <DashboardLayout 
      role="super_admin" 
      activeTab={view} 
      onTabChange={handleViewChange}
      modals={
        <AnimatePresence>
          {showStaffModal && (
            <StaffModal 
              isOpen={showStaffModal} 
              onClose={() => setShowStaffModal(false)} 
              onSave={handleAddStaff}
              feedback={feedback}
            />
          )}

          {showProgramModal && (
            <ProgramModal 
              isOpen={showProgramModal} 
              onClose={() => setShowProgramModal(false)} 
              onSave={handleAddProgram}
              staffList={staffList}
            />
          )}
        </AnimatePresence>
      }
    >
      <div key={view} className="animation-reveal">
        {/* --- MAIN HIGH-LEVEL DASHBOARD --- */}
        {view === 'dashboard' && (
          <div className="space-y-12">
            <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
              <div>
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Main Dashboard</h2>
                <p className="text-slate-400 font-bold tracking-tight">
                  Manage your <span className="text-indigo-400">FutureStudio</span> programs and staff here.
                </p>
              </div>
              <div className="flex gap-4">
                 <button className="btn-ghost !py-3"><RefreshCcw className="w-4 h-4 mr-2" /> Refresh Data</button>
                 <button onClick={() => setView('activity')} className="btn-prime !py-3 shadow-indigo-600/10"><Shield className="w-4 h-4 mr-2" /> Security Log</button>
              </div>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <DashboardStat title="Active Programs" value={activePrograms.length} icon={Layers} color="text-indigo-400" badge="STABLE" />
              <DashboardStat title="Total Projects" value={activeProjects.length} icon={FolderRoot} color="text-emerald-400" badge="GROWING" />
              <DashboardStat title="Total Staff" value={activeStaff.length} icon={Users} color="text-amber-400" badge="ACTIVE" />
              <DashboardStat title="System Activity" value={activityLogs.length} icon={Activity} color="text-rose-400" badge="SECURE" />
            </div>

            <div className="ios-card h-[400px] flex items-center justify-center bg-mesh group overflow-hidden">
               <div className="text-center relative z-10 transition-transform group-hover:scale-110 duration-700">
                 <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/5 group-hover:border-indigo-500/30">
                    <ChartBar className="w-10 h-10 text-slate-500" />
                 </div>
                 <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Intelligence Engine</h4>
                 <p className="text-slate-400 text-sm font-bold max-w-xs mx-auto">AI-driven KPI signals and portfolio visualizations will sync as data points mature.</p>
               </div>
               
               {/* Decorative Overlay */}
               <div className="absolute inset-0 bg-gradient-to-t from-[#080810] via-transparent to-transparent opacity-60" />
            </div>
          </div>
        )}

        {/* --- ALL PROGRAMS VIEW --- */}
        {view === 'programs' && (
          <div className="space-y-8">
            <header className="flex flex-col lg:flex-row justify-between items-center gap-6">
              <div>
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">All Programs</h2>
                <p className="text-slate-400 font-bold tracking-tight">Manage your program structures.</p>
              </div>
              <button 
                onClick={() => setShowProgramModal(true)} 
                className="btn-prime !py-4 shadow-indigo-600/10"
              >
                <Plus className="w-5 h-5 mr-2" /> Create New Program
              </button>
            </header>

            {activePrograms.length === 0 ? (
              <EmptyState icon={Layers} title="No Programs Found" subtitle="Click 'Design New Program' to build your first structure." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {activePrograms.map(p => {
                   const manager = activeStaff.find(s => s.id.toString() === p.assignedManager);
                   return (
                     <div key={p.id} onClick={() => goToProgramDetails(p.id)} className="ios-card group cursor-pointer hover:border-indigo-500/30 transition-all duration-500">
                       <div className="flex justify-between items-start mb-6">
                          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                             <Layers className="w-6 h-6" />
                          </div>
                          <span className="badge badge-glow-success uppercase text-[8px] font-black">ACTIVE</span>
                       </div>
                       
                       <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2 group-hover:text-indigo-400 transition-colors">{p.name}</h3>
                       <p className="text-slate-400 text-xs font-bold line-clamp-2 mb-6 opacity-70 leading-relaxed">{p.description}</p>
                       
                       <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 mb-6">
                          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden">
                             {manager?.image ? <img src={manager.image} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-slate-500" />}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Manager ID</p>
                            <p className="text-sm font-black text-white">{manager ? manager.fullName : 'UNASSIGNED'}</p>
                          </div>
                       </div>
                       
                       <div className="flex items-center justify-between pt-4 border-t border-white/5">
                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Open Ops Terminal</span>
                         <ArrowRight className="w-4 h-4 text-slate-600 group-hover:translate-x-2 transition-transform" />
                       </div>
                     </div>
                   )
                })}
              </div>
            )}
          </div>
        )}

        {/* --- PROGRAM DETAILS (HIERARCHY) VIEW --- */}
        {view === 'programDetails' && theProgram && (
          <div className="space-y-10">
            <button 
              onClick={() => { setView('programs'); setActiveProgramId(null); setActiveProgramCard(null); }} 
              className="btn-ghost !py-2 !px-4 hover:bg-white/5"
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> Back to Catalog
            </button>
            
            <header className="flex flex-col lg:flex-row justify-between items-end gap-10 pb-8 border-b border-white/5">
              <div className="animation-reveal">
                 <div className="flex items-center gap-4 mb-3">
                    <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Structure HQ</span>
                    <div className="h-px w-10 bg-indigo-500/30" />
                 </div>
                 <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">
                   {theProgram.name}
                 </h2>
                 <p className="text-slate-400 font-bold mt-4 max-w-xl opacity-70">Define operations, mission, and KPI signals for this lifecycle.</p>
              </div>
              <button className="btn-prime !py-4 shadow-emerald-600/10 border-emerald-500/20 from-emerald-600 to-emerald-500">
                Sync with Live Projects <ChevronRight className="w-5 h-5 ml-2" />
              </button>
            </header>

            {!activeProgramCard ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <ProgramCard icon={FileText} title="Concept Note" subtitle="The AI-linked core philosophy definitions." onClick={() => setActiveProgramCard('concept')} />
                <ProgramCard icon={Target} title="Mission & Vision" subtitle="Strategic goals and future scaling outlook." onClick={() => setActiveProgramCard('mission')} />
                <ProgramCard icon={ChartBar} title="KPI Signal Mapping" subtitle="Trackable metrics for venture success." onClick={() => setActiveProgramCard('kpis')} />
                <ProgramCard icon={Calendar} title="Operational Schedule" subtitle="Curriculum phases and weekly topics." onClick={() => setActiveProgramCard('schedule')} />
                <ProgramCard icon={Users} title="Personnel Requests" subtitle="Manage staff assignments for this program." onClick={() => setActiveProgramCard('team')} />
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
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

                      <div className="ios-card overflow-hidden bg-white/[0.02] border-white/5">
                        {theProgram.conceptNoteUrl && (
                          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 inline-flex items-center gap-3">
                             <LinkIcon className="w-5 h-5 text-indigo-400" />
                             <a href={theProgram.conceptNoteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-indigo-400 uppercase tracking-widest hover:underline">
                               View External Document
                             </a>
                          </div>
                        )}
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Content</h4>
                        <div className="text-slate-300 font-bold leading-relaxed whitespace-pre-wrap">
                           {theProgram.conceptNote || "No details provided yet. The Program Manager will update this."}
                        </div>
                      </div>
                    </div>
                 )}
                 {activeProgramCard === 'mission' && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Mission & Vision</h3>
                        <p className="text-slate-400 font-bold opacity-70">The strategic core of this program's existence.</p>
                      </div>

                      <div className="ios-card overflow-hidden bg-white/[0.02] border-white/5">
                        {theProgram.missionUrl && (
                          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 inline-flex items-center gap-3">
                             <LinkIcon className="w-5 h-5 text-indigo-400" />
                             <a href={theProgram.missionUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-indigo-400 uppercase tracking-widest hover:underline">
                               View External Document
                             </a>
                          </div>
                        )}
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Content</h4>
                        <div className="text-slate-300 font-bold leading-relaxed whitespace-pre-wrap">
                           {theProgram.missionVision || "No details provided yet. The Program Manager will update this."}
                        </div>
                      </div>
                    </div>
                 )}
                 {activeProgramCard === 'kpis' && (
                    <div className="space-y-8">
                       <div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">KPI Signal Mapping</h3>
                        <p className="text-slate-400 font-bold opacity-70">List trackable parameters for program success.</p>
                      </div>

                      <div className="ios-card overflow-hidden bg-white/[0.02] border-white/5">
                        {theProgram.kpisUrl && (
                          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 inline-flex items-center gap-3">
                             <LinkIcon className="w-5 h-5 text-indigo-400" />
                             <a href={theProgram.kpisUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-indigo-400 uppercase tracking-widest hover:underline">
                               View External Document
                             </a>
                          </div>
                        )}
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Content</h4>
                        <div className="text-slate-300 font-bold leading-relaxed whitespace-pre-wrap">
                           {theProgram.kpis || "No KPIs defined yet. The Program Manager will update this."}
                        </div>
                      </div>
                    </div>
                 )}
                 {activeProgramCard === 'schedule' && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Curriculum Flow</h3>
                        <p className="text-slate-400 font-bold opacity-70">Define weekly phases and milestones.</p>
                      </div>

                      <div className="ios-card overflow-hidden bg-white/[0.02] border-white/5">
                        {theProgram.scheduleUrl && (
                          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 inline-flex items-center gap-3">
                             <LinkIcon className="w-5 h-5 text-indigo-400" />
                             <a href={theProgram.scheduleUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-indigo-400 uppercase tracking-widest hover:underline">
                               View External Document
                             </a>
                          </div>
                        )}
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Content</h4>
                        <div className="text-slate-300 font-bold leading-relaxed whitespace-pre-wrap">
                           {theProgram.topics || "No schedule phases defined yet. The Program Manager will map these out."}
                        </div>
                      </div>
                    </div>
                 )}
                 {activeProgramCard === 'team' && (
                    <div className="space-y-8">
                      <div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Personnel Pipeline</h3>
                        <p className="text-slate-400 font-bold opacity-70">Requested staff assignments for this lifecycle.</p>
                      </div>
                      <div className="p-20 text-center bg-white/5 rounded-[3rem] border border-dashed border-white/10 group">
                         <Users className="w-16 h-16 text-slate-700 mx-auto mb-6 group-hover:text-indigo-500 transition-colors duration-500" />
                         <p className="text-slate-500 font-bold max-w-xs mx-auto">Personnel requests will appear here once submitted by the Program Manager.</p>
                      </div>
                    </div>
                 )}
              </motion.div>
            )}
          </div>
        )}

        {/* --- PROJECTS DIRECTORY --- */}
        {view === 'projects' && (
          <div className="space-y-8">
            <header className="flex flex-col lg:flex-row justify-between items-center gap-6">
              <div>
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Project List</h2>
                <p className="text-slate-400 font-bold tracking-tight">Track the status of all your projects.</p>
              </div>
              <div className="flex gap-4">
                 <button className="btn-ghost !py-3"><Filter className="w-4 h-4 mr-2" /> Filter List</button>
                 <button className="btn-prime !py-3 shadow-indigo-600/10"><Download className="w-4 h-4 mr-2" /> Export Report</button>
              </div>
            </header>
            
            {activeProjects.length === 0 ? (
              <EmptyState icon={FolderRoot} title="No Projects" subtitle="Projects will appear here once they are started." />
            ) : (
              <div className="ios-card !p-0 overflow-hidden">
                 <table className="executive-table">
                   <thead>
                     <tr>
                       {['Project Name', 'Program Name', 'Status', 'Condition'].map(h => (
                         <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{h}</th>
                       ))}
                     </tr>
                   </thead>
                   <tbody>
                      {activeProjects.map(p => (
                        <tr key={p.id}>
                          <td className="px-6 py-6 font-black text-white uppercase tracking-tighter text-base">{p.name}</td>
                          <td className="px-6 py-6 text-slate-400 font-bold">{p.programName || 'Impact Alpha'}</td>
                          <td className="px-6 py-6">
                             <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                                <span className="text-xs font-black text-white uppercase tracking-widest">{p.status}</span>
                             </div>
                          </td>
                          <td className="px-6 py-6">
                             <span className="badge badge-glow-success uppercase font-black text-[9px]">HEALTHY</span>
                          </td>
                        </tr>
                      ))}
                   </tbody>
                 </table>
              </div>
            )}
          </div>
        )}

        {/* --- STAFF VIEW TABLE --- */}
        {view === 'staff' && (
          <div className="space-y-8 min-h-[60vh]">
            <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
              <div>
                 <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Staff List</h2>
                 <p className="text-slate-400 font-bold tracking-tight">Manage your team and their login details.</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={copyRegLink}
                  className="btn-ghost !py-4"
                >
                  {copied ? <CheckCircle className="w-5 h-5 mr-2 text-emerald-400" /> : <LinkIcon className="w-5 h-5 mr-2" />}
                  {copied ? 'Link Copied' : 'Share Sign-up Link'}
                </button>
                <button 
                  onClick={() => setShowStaffModal(true)}
                  className="btn-prime !py-4 shadow-indigo-600/10"
                >
                  <UserPlus className="w-5 h-5 mr-2" /> Add New Staff
                </button>
              </div>
            </header>

            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Search staff by name or email..." 
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-indigo-500/30 transition-colors font-bold placeholder:text-slate-600"
                />
              </div>
            </div>

            {activeStaff.length === 0 ? (
              <EmptyState icon={Users} title="No Staff Added" subtitle="Add new staff members to get started." />
            ) : filteredStaff.length === 0 ? (
              <EmptyState icon={Search} title="No Matches" subtitle="We couldn't find anyone matching your search." />
            ) : (
              <div className="animation-reveal">
                <div className="ios-card !p-0 overflow-visible bg-transparent border-none">
                  <table className="executive-table w-full">
                    <thead>
                      <tr className="bg-transparent border-none shadow-none">
                        <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-left">Full Name</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-left">Login Access</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentStaffDisplay.map((s) => (
                        <tr key={s.id} className="group hover:bg-white/[0.02] transition-colors rounded-3xl border-b border-white/[0.03]">
                          <td className="px-8 py-7">
                            <div className="flex items-center gap-4">
                               <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center overflow-hidden shadow-2xl">
                                  {s.image ? <img src={s.image} className="w-full h-full object-cover" /> : <Users className="w-6 h-6 text-indigo-400 opacity-40" />}
                               </div>
                               <div>
                                 <p className="font-black text-white uppercase tracking-tighter text-base mb-1">{s.fullName}</p>
                                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-md inline-block">{s.role.replace('_', ' ')}</p>
                               </div>
                            </div>
                          </td>
                          <td className="px-8 py-7">
                             <p className="text-sm font-bold text-slate-400 mb-2 opacity-70">{s.email}</p>
                             <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-white bg-white/5 border border-white/5 px-3 py-1 rounded-lg tracking-widest shadow-inner">
                                  {showPasswordMap[s.id] ? s.password : '••••••••'}
                                </span>
                                <button onClick={() => togglePassword(s.id)} className="text-slate-500 hover:text-indigo-400 transition-colors">
                                   {showPasswordMap[s.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-400 uppercase tracking-widest ml-2">
                                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                   Active
                                </span>
                             </div>
                          </td>
                          <td className="px-8 py-7 text-right">
                             <div className="flex items-center justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                               <button 
                                 onClick={() => alert('Assignment Logic Pending')} 
                                 className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-indigo-600/20"
                               >
                                 <UserPlus className="w-4 h-4" /> Assign
                               </button>
                               <button onClick={() => sendToWhatsapp(s)} className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all shadow-lg" title="Send Access Details"><MessageCircle className="w-5 h-5" /></button>
                               <button onClick={() => resetPassword(s.id)} className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all shadow-lg" title="Reset Password"><Key className="w-5 h-5" /></button>
                               <button onClick={() => deleteStaffSoft(s.id)} className="p-3 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-lg" title="Remove Staff"><Trash2 className="w-5 h-5" /></button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-between px-8 py-6 bg-white/[0.02] border border-white/5 rounded-[2rem] shadow-2xl">
                       <div>
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Personnel Entry</p>
                         <p className="text-xs font-bold text-white">Showing {currentStaffDisplay.length} in this block</p>
                       </div>
                       <div className="flex gap-4">
                         <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-ghost !p-3 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                         <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-ghost !p-3 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- GLOBAL PARTICIPANTS VIEW --- */}
        {view === 'participants' && (
          <div className="space-y-8 min-h-[60vh]">
            <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
              <div>
                 <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Global Roster</h2>
                 <p className="text-slate-400 font-bold tracking-tight">View all registered participants across active programs.</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={copyRegLink}
                  className="btn-ghost !py-4"
                >
                  {copied ? <CheckCircle className="w-5 h-5 mr-2 text-emerald-400" /> : <LinkIcon className="w-5 h-5 mr-2" />}
                  {copied ? 'Link Copied' : 'Share Sign-up Link'}
                </button>
              </div>
            </header>

            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Search participants by name or email..." 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-indigo-500/30 transition-colors font-bold placeholder:text-slate-600"
                />
              </div>
            </div>

            {JSON.parse(localStorage.getItem('impactos_participants') || '[]').length === 0 ? (
              <EmptyState icon={Users} title="Global Roster Empty" subtitle="No participants have registered across any programs yet." />
            ) : (
              <div className="animation-reveal">
                <div className="ios-card !p-0 overflow-visible bg-transparent border-none">
                  <table className="executive-table w-full">
                    <thead>
                      <tr className="bg-transparent border-none shadow-none">
                        <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-left">Applicant</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-left">Contact Data</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-left">Program Mapped</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] text-right">Documents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {JSON.parse(localStorage.getItem('impactos_participants') || '[]').map((p) => {
                        const progName = programList.find(pr => String(pr.id) === String(p.programId))?.name || 'Unknown Program';
                        return (
                          <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors rounded-3xl border-b border-white/[0.03]">
                            <td className="px-8 py-7">
                              <div className="flex items-center gap-4">
                                 <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center overflow-hidden shadow-2xl">
                                    <span className="font-black text-indigo-400">{p.fullName?.charAt(0)}</span>
                                 </div>
                                 <div>
                                   <p className="font-black text-white uppercase tracking-tighter text-base mb-1">{p.fullName}</p>
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
                             <td className="px-8 py-7">
                               <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 shadow-inner">
                                  {progName}
                               </span>
                            </td>
                            <td className="px-8 py-7 text-right">
                               <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                 <button 
                                   onClick={() => alert(`Project Name/Idea: \n${p.projectIdea}`)} 
                                   className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 font-black text-[10px] uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all shadow-lg"
                                 >
                                   <FileText className="w-4 h-4" /> Insight
                                 </button>
                                 {p.cvFile && (
                                   <button 
                                     onClick={() => {
                                       const a = document.createElement("a");
                                       a.href = p.cvFile;
                                       a.download = `CV_${p.fullName.replace(/\s+/g,'_')}.pdf`;
                                       a.click();
                                     }}
                                     className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-indigo-600/20"
                                   >
                                     <Download className="w-4 h-4" /> Pull CV
                                   </button>
                                 )}
                               </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- RECYCLE BIN --- */}
        {view === 'recycleBin' && (
          <div className="space-y-10">
            <header className="flex flex-col lg:flex-row justify-between items-center gap-6">
              <div>
                <h2 className="text-4xl font-black text-rose-500 tracking-tighter uppercase mb-2">Recycle Bin</h2>
                <p className="text-slate-400 font-bold tracking-tight">Restore deleted items or remove them permanently.</p>
              </div>
               <Activity className="w-12 h-12 text-rose-500/20" />
            </header>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Deleted Staff */}
              <section className="space-y-6">
                 <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                   <Users className="w-5 h-5 text-rose-500" /> Deleted Staff
                 </h3>
                 <div className="space-y-4">
                  {deletedStaff.length === 0 ? (
                    <p className="text-slate-600 font-bold text-sm italic">Recycle bin is empty.</p>
                  ) : (
                    deletedStaff.map(s => (
                      <div key={s.id} className="ios-card bg-rose-500/5 border-rose-500/10 flex justify-between items-center group">
                         <div>
                           <p className="font-black text-white uppercase tracking-tighter">{s.fullName}</p>
                           <p className="text-[10px] font-bold text-rose-400/60 uppercase">{s.email}</p>
                         </div>
                         <div className="flex gap-2">
                           <button onClick={() => restoreStaff(s.id)} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-colors"><RefreshCcw className="w-4 h-4" /></button>
                           <button onClick={() => permDeleteStaff(s.id)} className="p-2 rounded-lg bg-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"><Trash2 className="w-4 h-4" /></button>
                         </div>
                      </div>
                    ))
                  )}
                 </div>
              </section>

              {/* Deleted Programs */}
              <section className="space-y-6">
                 <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                   <Layers className="w-5 h-5 text-rose-500" /> Deleted Programs
                 </h3>
                 <div className="space-y-4">
                  {deletedPrograms.length === 0 ? (
                    <p className="text-slate-600 font-bold text-sm italic">Recycle bin is empty.</p>
                  ) : (
                    deletedPrograms.map(p => (
                      <div key={p.id} className="ios-card bg-rose-500/5 border-rose-500/10 flex justify-between items-center">
                         <p className="font-black text-white uppercase tracking-tighter">{p.name}</p>
                         <button onClick={() => restoreProgram(p.id)} className="btn-ghost !py-2 !px-4 text-emerald-400 hover:text-emerald-300"><RefreshCcw className="w-4 h-4 mr-2" /> Restore</button>
                      </div>
                    ))
                  )}
                 </div>
              </section>
            </div>
          </div>
        )}

        {/* --- ACTIVITY LOGS --- */}
        {view === 'activity' && (
          <div className="space-y-8">
            <header className="flex flex-col lg:flex-row justify-between items-center gap-6">
              <div>
                <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Activity Logs</h2>
                <p className="text-slate-400 font-bold tracking-tight">Record of all actions taken in the system.</p>
              </div>
            </header>
            
            <div className="ios-card overflow-hidden">
              {activityLogs.length === 0 ? (
                <EmptyState icon={Activity} title="No activity recorded" subtitle="System activities will appear here as they happen." />
              ) : (
                <div className="divide-y divide-white/5">
                  {activityLogs.map(log => (
                    <div key={log.id} className="p-6 flex items-start gap-4 hover:bg-white/[0.02] transition-colors group">
                       <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                       <div className="flex-1">
                         <p className="text-white font-bold mb-1">{log.text}</p>
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                           <Calendar className="w-3 h-3" /> {log.time}
                         </p>
                       </div>
                       <button 
                         onClick={() => deleteIndividualLog(log.id)}
                         className="p-3 rounded-xl bg-rose-500/10 text-rose-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white"
                         title="Delete audit record"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// --- SUB-COMPONENTS ---

function DashboardStat({ title, value, icon: Icon, color, badge }) {
  return (
    <div className="ios-card group hover:border-white/10 transition-colors">
       <div className="flex justify-between items-start mb-6">
          <div className={`p-4 rounded-2xl bg-white/5 border border-white/5 ${color}`}>
             <Icon className="w-6 h-6" />
          </div>
          {badge && <span className="badge badge-glow-indigo uppercase text-[8px] font-black">{badge}</span>}
       </div>
       <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{title}</h4>
       <div className="text-3xl font-black text-white tracking-tighter">{value}</div>
    </div>
  );
}

function ProgramCard({ icon: Icon, title, subtitle, onClick }) {
  return (
    <button 
      onClick={onClick}
      className="ios-card !p-8 text-left group hover:bg-white/[0.02] transition-all hover:border-indigo-500/30"
    >
      <div className="p-4 rounded-xl bg-white/5 border border-white/5 w-fit mb-6 group-hover:bg-indigo-500/10 group-hover:text-indigo-400 group-hover:border-indigo-500/20 transition-all text-slate-500">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-2">{title}</h4>
      <p className="text-xs font-bold text-slate-500 leading-relaxed">{subtitle}</p>
    </button>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="p-20 text-center bg-white/[0.02] rounded-[3rem] border border-dashed border-white/5 animation-reveal">
      <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/5 shadow-2xl">
        <Icon className="w-10 h-10 text-slate-700" />
      </div>
      <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">{title}</h3>
      <p className="text-slate-500 text-sm font-bold max-w-xs mx-auto leading-relaxed">{subtitle}</p>
    </div>
  );
}

// --- STAFF MODAL COMPONENT ---
const StaffModal = ({ isOpen, onClose, onSave, feedback }) => {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', role: 'unassigned', image: null });

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setForm({ ...form, image: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[250] flex items-center justify-center p-4 pointer-events-auto">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#080810]/95 backdrop-blur-2xl" 
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="ios-card relative z-[260] w-full max-w-2xl !p-8 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-y-auto max-h-[95vh] custom-scrollbar border-white/10"
      >
         <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/5">
           <h3 className="text-2xl font-black text-white tracking-tighter uppercase flex items-center gap-3">
             <UserPlus className="w-6 h-6 text-indigo-400" /> Register Personnel
           </h3>
           <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5">
              <X className="w-6 h-6" />
           </button>
         </div>
         
         <form onSubmit={handleSubmit} className="space-y-6">
           {feedback.message && (
             <div className={`p-4 rounded-xl border font-bold text-sm ${feedback.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
               {feedback.message}
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 focus-within:text-indigo-400 transition-colors">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                 <input required type="text" placeholder="John Doe" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-indigo-500/40 transition-all" />
              </div>
              <div className="space-y-1.5 focus-within:text-indigo-400 transition-colors">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                 <input required type="email" placeholder="john@example.com" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-indigo-500/40 transition-all" />
              </div>
              <div className="space-y-1.5 focus-within:text-indigo-400 transition-colors">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Phone Number</label>
                 <input required type="text" placeholder="+234..." value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-indigo-500/40 transition-all" />
              </div>
              <div className="space-y-1.5 focus-within:text-indigo-400 transition-colors">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Select Role</label>
                 <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-white outline-none focus:border-indigo-500/40 transition-all appearance-none cursor-pointer">
                    <option value="unassigned" className="bg-[#0f0f1a]">Unassigned</option>
                    <option value="program_manager" className="bg-[#0f0f1a]">Program Manager</option>
                 </select>
              </div>
           </div>

           <div className="pt-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-3 block">Profile Picture</label>
              <div className="flex items-center gap-5 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                   <div className="w-16 h-16 rounded-2xl bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden group hover:border-indigo-500/30 transition-colors relative flex-shrink-0">
                      {form.image ? (
                        <img src={form.image} className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-6 h-6 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                      )}
                      <input type="file" accept="image/*" capture="user" onChange={handleUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                   </div>
                   <div className="flex-1">
                      <p className="text-[11px] font-black text-white uppercase tracking-tight mb-1">Capture ID Photo</p>
                      <p className="text-[10px] text-slate-500 font-medium leading-tight">Touch the box to take a live picture or upload from gallery.</p>
                   </div>
                </div>
             </div>

             <div className="flex gap-4 pt-4 border-t border-white/5">
               <button type="button" onClick={onClose} className="btn-ghost flex-1 !p-3">Cancel</button>
               <button type="submit" className="btn-prime flex-1 shadow-indigo-600/20 !p-3">Save Details</button>
             </div>
           </form>
        </motion.div>
    </div>
  );
};

// --- PROGRAM MODAL COMPONENT ---
const ProgramModal = ({ isOpen, onClose, onSave, staffList }) => {
  const [form, setForm] = useState({ name: '', description: '', assignedManager: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="absolute inset-0 z-[250] flex items-center justify-center p-4 pointer-events-auto">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#080810]/95 backdrop-blur-2xl" 
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="ios-card relative z-[260] w-full max-w-2xl !p-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-y-auto max-h-[95vh] custom-scrollbar border-white/10"
      >
         <div className="flex justify-between items-center mb-10 pb-5 border-b border-white/5">
           <h3 className="text-3xl font-black text-white tracking-tighter uppercase flex items-center gap-4">
             <Layers className="w-8 h-8 text-indigo-400" /> Create New Program
           </h3>
           <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5">
              <X className="w-7 h-7" />
           </button>
         </div>
         
         <form onSubmit={handleSubmit} className="space-y-8">
           <div className="space-y-2.5 focus-within:text-indigo-400 transition-colors">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.25em] ml-1">Program Name</label>
              <input 
                required type="text" 
                placeholder="e.g. Fintech Accelerate 2026" 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4.5 text-lg text-white outline-none focus:border-indigo-500/40 transition-all" 
              />
           </div>
           
           <div className="space-y-2.5 focus-within:text-indigo-400 transition-colors">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.25em] ml-1">Program Description</label>
              <textarea 
                required 
                placeholder="Briefly describe the objective of this program..." 
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})} 
                className="w-full h-40 bg-white/5 border border-white/10 rounded-2xl p-4.5 text-white outline-none focus:border-indigo-500/40 transition-all resize-none leading-relaxed" 
              />
           </div>

           <div className="space-y-2.5 focus-within:text-indigo-400 transition-colors">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.25em] ml-1">Assign Program Manager</label>
              <select 
                value={form.assignedManager} 
                onChange={e => setForm({...form, assignedManager: e.target.value})} 
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4.5 text-white outline-none focus:border-indigo-500/40 transition-all appearance-none cursor-pointer"
              >
                 <option value="" className="bg-[#0f0f1a]">Select from Available Personnel</option>
                 {staffList.filter(s => !s.deleted && s.role === 'unassigned').map(s => (
                   <option key={s.id} value={s.id} className="bg-[#0f0f1a]">{s.fullName}</option>
                 ))}
              </select>
           </div>

           <div className="flex gap-4 pt-6 mt-4 border-t border-white/5">
             <button type="button" onClick={onClose} className="btn-ghost flex-1 !py-4 text-sm font-black uppercase tracking-widest">Cancel</button>
             <button type="submit" className="btn-prime flex-1 shadow-indigo-600/20 !py-4 text-sm font-black uppercase tracking-widest">Launch Program</button>
           </div>
         </form>
      </motion.div>
    </div>
  );
};

function sendToWhatsapp(s) {
  const msg = `Hello ${s.fullName},\n\nYour ImpactOS access is ready!\n\nEmail: ${s.email}\nPassword: ${s.password}\nPortal Link: ${window.location.origin}/login\n\nPlease log in to access your dashboard and manage your projects.`;
  const url = `https://wa.me/${s.phone.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}
