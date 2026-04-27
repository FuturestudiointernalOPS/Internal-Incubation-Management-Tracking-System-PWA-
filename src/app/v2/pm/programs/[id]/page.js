'use client';
import { Zap as SignalIcon } from 'lucide-react';

import React, { useState, useEffect, use } from 'react';
import { 
  ChevronLeft, Plus, Calendar, 
  Users, Layers, Settings, MessageSquare, 
  Globe, LayoutDashboard, Search, Filter,
  ArrowRight, Activity, Shield, Zap, Target, CheckCircle2, AlertCircle, Clock, Send, Briefcase, ChevronDown, Trash2, Edit3, Link2, ChevronRight, X, FileText, Video, Image as ImageIcon, Link as LinkIcon, FileCheck, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

/**
 * PROJECT MANAGER PROGRAM WORKSPACE (V2.7 - MANIFEST DYNAMICS)
 * Industry-Standard Curriculum Management with Tabular Manifest Staging & Operational Sync.
 */
export default function PMProgramTerminalV2({ params }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  const [isMessaging, setIsMessaging] = useState(false);
  const [signalData, setSignalData] = useState({ subject: '', body: '', target_type: 'staff' });
  const router = useRouter();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState({});
  const [activeTab, setActiveTab] = useState('curriculum'); 
  const [reports, setReports] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [isReportsLoading, setIsReportsLoading] = useState(false);
  const [pmReportInputs, setPmReportInputs] = useState({}); // { week: { notes: '', saving: false } }

  const handleSendSignal = async () => {
    if (!signalData.body || !signalData.subject) return;
    try {
      const res = await fetch('/api/v2/internal-comms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: user.cid || user.id,
          program_id: id,
          ...signalData,
          priority: 'normal'
        })
      });
      if ((await res.json()).success) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: 'Signal Transmitted.' } 
        }));
        setIsMessaging(false);
        setSignalData({ subject: '', body: '', target_type: 'staff' });
      }
    } catch (e) { console.error(e); }
  };
  const [program, setProgram] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [docRequirements, setDocRequirements] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [standardTypes, setStandardTypes] = useState({ tasks: [], assignments: [], deliverables: [], media: [] });

  const openMaterial = (material) => {
    if (!material || !material.data) return;
    try {
      const base64 = material.data.split(',')[1];
      const type = material.data.split(';')[0].split(':')[1];
      const bin = atob(base64);
      const array = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) array[i] = bin.charCodeAt(i);
      const blob = new Blob([array], { type: type || 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      console.error("Material Viewport Error:", e);
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
        detail: { type: 'error', message: 'Failed to generate asset viewport.' } 
      }));
    }
  };

  // Curriculum State
  const [expandedWeeks, setExpandedWeeks] = useState([1]);
  const [selectedTask, setSelectedTask] = useState(null);   
  const [showTaskSelector, setShowTaskSelector] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // New Requirement Inline State (V2.7 - Manifest Staging)
  const [newReq, setNewReq] = useState({ 
    isAdding: false, 
    manifest: [], // Array of { title, format }
    customTitle: '',
    customFormat: ''
  });


  // Teams Management State
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', handler_id: '', handler_name: '' });

  // Requirement Edit State
  const [editingReq, setEditingReq] = useState(null);

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(sessionUser);
    fetchPMData();
    fetchFollowups();
  }, [id]);

  const fetchFollowups = async () => {
    try {
      const res = await fetch(`/api/v2/followups?program_id=${id}`);
      const data = await res.json();
      if (data.success) setFollowups(data.followups || []);
    } catch (e) {}
  };

  const fetchPMData = async () => {
    try {
      const url = `/api/v2/pm/full-state?id=${id}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.program) {
        setProgram(data.program);
        setParticipants(data.participants || []);
        setTeams(data.teams || []);
        setSessions(data.sessions || []);
        setStaffList(data.staffList || []);
        setDocRequirements(data.documents || []);
      }

      // Fetch Standard Types (Expanded Categories)
      const typeRes = await fetch('/api/v2/superadmin/standard-types');
      const typeData = await typeRes.json();
      if (typeData.success) {
         setStandardTypes({
            tasks: typeData.types.filter(t => t.category === 'task'),
            assignments: typeData.types.filter(t => t.category === 'assignment'),
            deliverables: typeData.types.filter(t => t.category === 'deliverable'),
            media: typeData.types.filter(t => t.category === 'media')
         });
      }

      setIsLoaded(true);
      fetchReports(); // Ensure reports are synced for the curriculum view
    } catch (e) {
      console.error(e);
      setIsLoaded(true);
    }
  };

  const fetchReports = async () => {
     setIsReportsLoading(true);
     try {
        const res = await fetch(`/api/v2/teacher/reports?program_id=${id}`);
        const data = await res.json();
        if (data.success) setReports(data.reports || []);
     } catch (e) {}
     finally { setIsReportsLoading(false); }
  };

  useEffect(() => {
     if (activeTab === 'reports') fetchReports();
  }, [activeTab]);

  const handleToggleSessionStatus = async (sessionId, newStatus) => {
    try {
      const res = await fetch('/api/v2/pm/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: id, action: 'toggle_status', id: sessionId, status: newStatus })
      });
      if ((await res.json()).success) fetchPMData();
    } catch (e) { console.error(e); }
  };

  const handleToggleDeliverableStatus = async (delId, isCompleted) => {
    try {
      const res = await fetch('/api/v2/pm/curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: id, action: 'toggle_deliverable', id: delId, is_completed: isCompleted })
      });
      if ((await res.json()).success) fetchPMData();
    } catch (e) { console.error(e); }
  };

  const handleSaveTaskConfig = async (taskData) => {
     setIsProcessing(true);
     try {
        const isNew = !taskData.id;
        const res = await fetch('/api/v2/pm/curriculum', {
           method: isNew ? 'POST' : 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
              program_id: id, 
              action: 'add_session',
              type: 'session',
              ...taskData 
           })
        });
        const data = await res.json();
        if (data.success) {
           const sid = data.id || taskData.id;
           // If there's a staged manifest, deploy it now
           if (newReq.manifest.length > 0 && sid) {
              await deployManifestItems(sid);
           }
           window.dispatchEvent(new CustomEvent('impactos:notify', { 
              detail: { type: 'success', message: 'Saved' } 
           }));
           
           setSelectedTask(null);
           setNewReq({ isAdding: false, manifest: [], customTitle: '', customFormat: '' });
           fetchPMData();
        } else {
           window.dispatchEvent(new CustomEvent('impactos:notify', { 
              detail: { type: 'error', message: data.error || 'Configuration failed.' } 
           }));
        }
     } catch (e) { 
        console.error(e);
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'error', message: 'Sync Error.' } 
        }));
     } finally { 
        setIsProcessing(false); 
     }
  };

  const deployManifestItems = async (sid) => {
     for (const item of newReq.manifest) {
        await fetch('/api/v2/pm/curriculum', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
              program_id: id, 
              action: 'add_requirement',
              title: item.title,
              session_id: sid,
              allowed_format: item.format || 'pdf',
              weight: 1
           })
        });
     }
     setNewReq({ isAdding: false, manifest: [], customTitle: '', customFormat: '' });
  };

  const handleAddRequirements = async () => {
      if (newReq.manifest.length === 0 || !selectedTask.id) return;
      setIsProcessing(true);
      try {
         await deployManifestItems(selectedTask.id);
         await fetchPMData();
      } catch (e) { console.error(e); }
      finally { setIsProcessing(false); }
  };

   const handleSavePMReport = async (wn) => {
      const notes = pmReportInputs[wn]?.notes;
      if (!notes) return;
      
      setPmReportInputs(prev => ({ ...prev, [wn]: { ...prev[wn], saving: true } }));
      try {
         const user = JSON.parse(localStorage.getItem('user') || '{}');
         const res = await fetch('/api/v2/teacher/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               program_id: id,
               week_number: wn,
               teacher_id: user.cid || user.id,
               teacher_name: (user.name || 'Program Manager') + ' (PM)',
               progress_notes: notes,
               student_reception: 'PM Oversight',
               action_taken: 'PM Strategic Review',
               reception_score: 10
            })
         });
         
         if ((await res.json()).success) {
            window.dispatchEvent(new CustomEvent('impactos:notify', { 
               detail: { type: 'success', message: 'Report Synchronized' } 
            }));
            fetchReports();
            setPmReportInputs(prev => ({ ...prev, [wn]: { notes: '', saving: false } }));
         }
      } catch (e) { console.error(e); }
      finally {
         setPmReportInputs(prev => ({ ...prev, [wn]: { ...prev[wn], saving: false } }));
      }
   };

  const handleDeleteRequirement = async (reqId) => {
     if (!confirm("Delete this delivery requirement?")) return;
     try {
        const res = await fetch('/api/v2/pm/curriculum', {
           method: 'DELETE',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ id: reqId, type: 'requirement' })
        });
        if ((await res.json()).success) {
           await fetchPMData();
        }
     } catch (e) {}
  };

  const handleDeleteSession = async (sessionId) => {
     if (!confirm("Delete this entire session and its requirements?")) return;
     try {
        const res = await fetch('/api/v2/pm/curriculum', {
           method: 'DELETE',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ id: sessionId, type: 'session' })
        });
        if ((await res.json()).success) {
           await fetchPMData();
           setSelectedTask(null);
        }
     } catch (e) {}
  };

  const toggleWeek = (wn) => {
     setExpandedWeeks(prev => prev.includes(wn) ? prev.filter(w => w !== wn) : [...prev, wn]);
  };

  const getFormatIcon = (format) => {
     switch(format?.toLowerCase()) {
        case 'pdf': return <FileText className="w-5 h-5 text-rose-500" />;
        case 'doc': return <FileText className="w-5 h-5 text-blue-500" />;
        case 'sheet': return <FileCheck className="w-5 h-5 text-emerald-500" />;
        case 'url': return <LinkIcon className="w-5 h-5 text-[#FF6600]" />;
        case 'vid': return <Video className="w-5 h-5 text-orange-500" />;
        case 'images': return <ImageIcon className="w-5 h-5 text-purple-500" />;
        default: return <Link2 className="w-5 h-5 text-slate-400" />;
     }
  };

  // Progression Calculations (FLAT EQUITY MODEL - All items = 1)
  const totalWeight = sessions.length;
  
   const getWeekStats = (wn) => {
      const weekSessions = sessions.filter(s => s.week_number === wn);
      const sessionIds = weekSessions.map(s => s.id);
      const weekDocs = docRequirements.filter(dr => sessionIds.includes(dr.session_id));
      const weekReports = reports.filter(r => r.week_number === wn);
      
      // Each week now requires a "Program Weekly Report" node (Weight: 10 points)
      // This ensures 100% is only possible if the report is synchronized
      const reportPoints = weekReports.length > 0 ? 10 : 0;
      const totalPoints = (weekSessions.length * 5) + (weekDocs.length * 2) + 10; 
      const completedPoints = (weekSessions.filter(s => s.status === 'completed').length * 5) + (weekDocs.filter(d => d.is_completed).length * 2) + reportPoints;
      
      const internalPercentage = totalPoints > 0 ? ((completedPoints / totalPoints) * 100).toFixed(1) : 0;
      const title = weekSessions.length > 0 ? weekSessions[0].title : "Pending Program Phase";
      
      return { 
        weight: weekSessions.length, 
        completedWeight: weekSessions.filter(s => s.status === 'completed').length, 
        percentage: internalPercentage, 
        title,
        totalDocs: weekDocs.length,
        completedDocs: weekDocs.filter(d => d.is_completed).length,
        hasReport: weekReports.length > 0
      };
   };

  const maxWeek = Math.max(program?.duration_weeks || 1, ...sessions.map(s => s.week_number), 1);
  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1);

  if (!isLoaded || !program) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
     </div>
  );

  return (
    <DashboardLayout 
       role="program_manager" 
       activeTab="v2"
       modals={
          <AnimatePresence>
             {showTaskSelector && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
                   <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="ios-card w-full max-w-4xl !p-12 space-y-10 border-white/10 relative overflow-hidden bg-white/[0.03]">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6600]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                      
                      <div className="flex justify-between items-start">
                         <div className="space-y-3">
                            <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter">Program Mode Registry</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select the delivery modes for this program phase</p>
                         </div>
                         <button onClick={() => setShowTaskSelector(false)} className="p-4 rounded-2xl bg-white/5 text-slate-400 hover:text-white transition-all"><X className="w-6 h-6" /></button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         {standardTypes.tasks?.map(type => {
                            const current = (selectedTask.task_type || '').split(',').filter(x => x);
                            const isSelected = current.includes(type.label);
                            const label = type.label.toLowerCase();
                            const Icon = label.includes('workshop') ? FileText : label.includes('master') ? Shield : label.includes('practical') ? Zap : Target;

                            return (
                               <button
                                  key={type.id}
                                  onClick={() => {
                                     const next = isSelected ? current.filter(x => x !== type.label) : [...current, type.label];
                                     setSelectedTask({...selectedTask, task_type: next.join(',')});
                                  }}
                                  className={`p-8 rounded-[2rem] text-left transition-all border flex flex-col gap-6 group relative overflow-hidden ${isSelected ? 'bg-[#FF6600] border-[#FF6600] shadow-2xl shadow-[#FF6600]/20' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                               >
                                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isSelected ? 'bg-black text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
                                     <Icon className="w-6 h-6" />
                                  </div>
                                  <div className="space-y-1">
                                     <p className={`text-lg font-black uppercase italic leading-none ${isSelected ? 'text-black' : 'text-white'}`}>{type.label}</p>
                                     <p className={`text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-black/60' : 'text-slate-500'}`}>{isSelected ? 'Active Mode' : 'Deployment Node'}</p>
                                  </div>
                                  {isSelected && <CheckCircle2 className="absolute top-6 right-6 w-5 h-5 text-black" />}
                               </button>
                            );
                         })}
                      </div>

                      <button 
                         onClick={() => setShowTaskSelector(false)}
                         className="w-full py-8 bg-white text-black font-black uppercase text-[12px] tracking-[0.4em] rounded-[2rem] hover:bg-[#FF6600] transition-all shadow-xl"
                      >
                         Confirm Configuration
                      </button>
                   </motion.div>
                </div>
             )}
          </AnimatePresence>
       }
    >
      <div className="space-y-12 pb-20">
        
        {/* HEADER */}
        <header className="flex flex-col xl:flex-row justify-between items-start gap-10">
          <div className="space-y-4">
             <button 
                onClick={() => router.push('/v2/pm/programs')} 
                className="group flex items-center gap-3 px-6 py-3 bg-white/5 text-slate-400 rounded-xl font-black uppercase text-[9px] tracking-widest hover:text-[#FF6600] hover:bg-[#FF6600]/5 transition-all border border-white/5 hover:border-[#FF6600]/20 w-fit"
             >
                <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                <span>Return to Program Hub</span>
             </button>
             <h2 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-[0.85]">{program.name}</h2>
             <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-3">
                   <span className="px-3 py-1 bg-[#FF6600]/10 text-[#FF6600] text-[10px] font-black uppercase tracking-widest border border-[#FF6600]/20 rounded-md shadow-[0_0_15px_rgba(255,102,0,0.1)]">Completion Index</span>
                   <div className="h-px w-6 bg-white/10" />
                   <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest opacity-60 font-sans italic">Scheduling & Assignments Active</p>
                </div>
                
                <div className="flex items-center gap-4 bg-white/5 px-6 py-2 rounded-2xl border border-white/5">
                   <div className="text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Project Velocity</p>
                      <p className="text-xl font-black text-[#FF6600] italic leading-none drop-shadow-[0_0_10px_rgba(255,102,0,0.3)]">
                         {((
                            (sessions.filter(s => s.status === 'completed').length * 5) + 
                            (docRequirements.filter(d => d.is_completed).length * 2)
                         ) / ((sessions.length * 5 + docRequirements.length * 2) || 1) * 100).toFixed(1)}%
                      </p>
                   </div>
                   <div className="w-10 h-10 rounded-full border-2 border-[#FF6600]/20 flex items-center justify-center relative">
                      <svg className="w-8 h-8 transform -rotate-90">
                         <circle cx="16" cy="16" r="14" fill="transparent" stroke="currentColor" strokeWidth="3" className="text-white/5" />
                         <circle cx="16" cy="16" r="14" fill="transparent" stroke="currentColor" strokeWidth="3" className="text-[#FF6600]" strokeDasharray={88} strokeDashoffset={88 - (88 * (
                            ((sessions.filter(s => s.status === 'completed').length * 5) + (docRequirements.filter(d => d.is_completed).length * 2)) / 
                            ((sessions.length * 5 + docRequirements.length * 2) || 1)
                         ))} strokeLinecap="round" />
                      </svg>
                   </div>
                </div>
             </div>
          </div>
        </header>

        {/* NAVIGATION */}
        <nav className="flex items-center gap-12 border-b border-white/5">
           {[
              { id: 'resources', label: 'Knowledge Base', icon: BookOpen },
              { id: 'curriculum', label: 'Curriculum', icon: Layers },
              { id: 'teams', label: 'Teams', icon: Target },
              { id: 'participants', label: 'Participants', icon: Users },
              { id: 'progress', label: 'Progress', icon: Activity }
           ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-6 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === tab.id ? 'text-[#FF6600]' : 'text-slate-400 hover:text-white'}`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-[#FF6600]' : 'opacity-40'}`} />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div layoutId="pmTabAnchorV2" className="absolute bottom-0 left-0 right-0 h-1 bg-[#FF6600] rounded-t-full shadow-[0_0_20px_rgba(255,102,0,1)]" />
                )}
              </button>
           ))}
        </nav>

        {/* CONTENT */}
        <div className="font-sans">
           {activeTab === 'curriculum' && (
              <div className="max-w-4xl space-y-6">
                 <div className="flex justify-between items-end mb-10">
                    <div>
                       <h3 className="text-2xl font-black text-white uppercase tracking-widest italic">Phase Overview</h3>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Active Modules: {totalWeight}</p>
                    </div>
                    <button 
                       onClick={() => setSelectedTask({ week_number: maxWeek, title: '', description: '', status: 'pending' })}
                       className="px-10 py-4 bg-[#FF6600] text-black font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white transition-all shadow-xl shadow-[#FF6600]/10"
                    >
                       + Add New Phase
                    </button>
                 </div>

                 {weeks.map(wn => {
                    const weekSessions = sessions.filter(s => s.week_number === wn);
                    const isOpen = expandedWeeks.includes(wn);
                    const stats = getWeekStats(wn);
                    
                    return (
                       <div key={wn} className="ios-card bg-white/[0.01] border-white/5 !p-0 overflow-hidden shadow-2xl">
                          <button 
                             onClick={() => toggleWeek(wn)}
                             className="w-full flex items-center justify-between p-8 hover:bg-white/[0.02] transition-colors"
                          >
                             <div className="flex items-center gap-8">
                                <div className="w-16 h-16 bg-[#FF6600]/10 rounded-2xl flex items-center justify-center text-[#FF6600] font-black text-2xl italic border border-[#FF6600]/20">
                                   {String(wn).padStart(2, '0')}
                                </div>
                                <div className="text-left">
                                   <div className="flex items-center gap-3 mb-2">
                                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Phase Objective</p>
                                      <div className="w-1.5 h-1.5 rounded-full bg-[#FF6600]" />
                                      <span className="text-[10px] font-black text-[#FF6600] uppercase italic">{stats.percentage}% Contribution</span>
                                   </div>
                                   <h4 className="text-3xl font-black text-white uppercase italic leading-none tracking-tighter group-hover:text-[#FF6600] transition-colors">{stats.title}</h4>
                                </div>
                             </div>
                             <div className="flex items-center gap-8">
                                <div className="text-right hidden md:block">
                                   <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">Phase Velocity</p>
                                   <p className="text-xs font-black text-white uppercase tracking-tighter">
                                      <span className="text-[#FF6600]">{stats.completedWeight}</span> / {stats.weight} Done ({stats.percentage}%)
                                   </p>
                                </div>
                                <ChevronDown className={`w-6 h-6 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                             </div>
                          </button>

                          <AnimatePresence>
                             {isOpen && (
                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="border-t border-white/5 bg-white/[0.005]">
                                   <div className="p-6 space-y-4">
                                      {weekSessions.map(session => {
                                         const sessionFollowups = followups.filter(f => f.session_id === session.id);
                                         
                                         return (
                                            <div key={session.id} className="space-y-4">
                                               <div 
                                                  key={session.id} 
                                                  onClick={() => setSelectedTask(session)}
                                                  className={`group flex items-center justify-between p-7 rounded-3xl border ${sessionFollowups.length > 0 ? 'border-[#FF6600]/40 bg-[#FF6600]/5' : 'border-white/5'} hover:border-[#FF6600]/40 hover:bg-[#FF6600]/5 cursor-pointer transition-all`}
                                               >
                                                  <div className="flex items-center gap-8">
                                                     <div className="flex flex-col items-center gap-1">
                                                        <div className={`w-3 h-3 rounded-full ${session.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-[#FF6600]/30'}`} />
                                                        <div className="w-px h-6 bg-white/5" />
                                                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                                                     </div>
                                                     <div className="text-left">
                                                        <div className="flex items-center gap-3">
                                                           <h5 className="font-black text-white uppercase tracking-tighter text-xl leading-none italic group-hover:text-[#FF6600] transition-colors">{session.title}</h5>
                                                           {sessionFollowups.length > 0 && (
                                                              <div className="px-3 py-1 bg-[#FF6600] text-black text-[8px] font-black uppercase tracking-widest rounded-full animate-bounce">
                                                                 Executive Feedback
                                                              </div>
                                                           )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-3 mt-3">
                                                           <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/5 rounded-lg">
                                                              <p className="text-[10px] text-[#FF6600] font-black uppercase tracking-widest italic opacity-70">
                                                                 {session.scheduled_date ? `${session.scheduled_date}` : 'No Date Set'}
                                                              </p>
                                                           </div>
                                                           
                                                           <select 
                                                              value={session.team_id || ''} 
                                                              onChange={async (e) => {
                                                                 try {
                                                                    const tid = e.target.value;
                                                                    const res = await fetch('/api/v2/pm/curriculum', {
                                                                       method: 'POST',
                                                                       headers: { 'Content-Type': 'application/json' },
                                                                       body: JSON.stringify({ program_id: id, action: 'assign_team', id: session.id, team_id: tid })
                                                                    });
                                                                    if ((await res.json()).success) fetchPMData();
                                                                 } catch (e) {}
                                                              }}
                                                              onClick={e => e.stopPropagation()}
                                                              className="bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-[9px] font-black text-white uppercase tracking-widest outline-none focus:border-[#FF6600]"
                                                           >
                                                              <option value="">Unassigned Unit</option>
                                                              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                           </select>

                                                           <span className="text-slate-800 font-black">•</span>
                                                           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{docRequirements.filter(dr => dr.session_id == session.id).length} Tracked Deliverables</p>
                                                        </div>
                                                     </div>
                                                  </div>
                                                  <div className="flex items-center gap-3 group-hover:translate-x-3 transition-transform">
                                                     <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic font-sans opacity-0 group-hover:opacity-100 transition-opacity">Configure Node</span>
                                                     <ChevronRight className="w-6 h-6 text-[#FF6600]/30 group-hover:text-[#FF6600] transition-colors" />
                                                  </div>
                                               </div>

                                               {/* EXECUTIVE FEEDBACK DISPLAY */}
                                               {sessionFollowups.length > 0 && (
                                                  <div className="ml-12 p-6 rounded-2xl bg-[#FF6600]/10 border border-[#FF6600]/20 space-y-4">
                                                     <div className="flex items-center gap-3">
                                                        <AlertCircle className="w-4 h-4 text-[#FF6600]" />
                                                        <p className="text-[10px] font-black text-white uppercase tracking-widest italic">Strategic Directives from Super Admin</p>
                                                     </div>
                                                     <div className="space-y-3">
                                                        {sessionFollowups.map(f => (
                                                           <div key={f.id} className="p-4 rounded-xl bg-black/20 border border-white/5">
                                                              <p className="text-xs text-white font-bold italic leading-relaxed">"{f.comment}"</p>
                                                              <p className="text-[8px] font-black text-[#FF6600]/60 uppercase mt-2">{new Date(f.created_at).toLocaleString()}</p>
                                                           </div>
                                                        ))}
                                                     </div>
                                                  </div>
                                               )}
                                            </div>
                                         );
                                      })}
                                      <button 
                                         onClick={() => setSelectedTask({ week_number: wn, title: '', description: '', status: 'pending' })}
                                         className="w-full py-6 border-2 border-dashed border-[#FF6600]/10 rounded-3xl text-[11px] font-black text-slate-600 uppercase tracking-[0.4em] hover:bg-[#FF6600]/5 hover:text-[#FF6600] hover:border-[#FF6600]/30 transition-all group flex items-center justify-center gap-4 italic"
                                      >
                                         <Plus className="w-4 h-4" /> Deploy Module for Phase {wn}
                                      </button>

                                      {/* PROGRAM WEEKLY REPORT (Tactical Intel) */}
                                      {reports.filter(r => r.week_number === wn).length > 0 && (
                                         <div className="mt-12 space-y-8 pt-12 border-t border-white/5 text-left">
                                            <div className="flex items-center gap-4">
                                               <div className="p-2.5 rounded-xl bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/20">
                                                  <FileText className="w-5 h-5" />
                                               </div>
                                               <div>
                                                  <h5 className="text-xl font-black text-white uppercase tracking-tighter italic leading-none">Program Weekly Report</h5>
                                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Qualitative Intelligence Feed</p>
                                               </div>
                                            </div>

                                            {reports.filter(r => r.week_number === wn).map(report => (
                                               <div key={report.id} className="space-y-8 bg-white/[0.01] p-10 rounded-[2.5rem] border border-white/5">
                                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                                                     <div className="space-y-4">
                                                        <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-[#FF6600] pl-4 italic">Execution Status</h6>
                                                        <p className="text-sm text-slate-200 font-bold leading-relaxed whitespace-pre-wrap">{report.progress_notes || 'No execution data provided.'}</p>
                                                     </div>
                                                     <div className="space-y-4">
                                                        <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-[#FF6600] pl-4 italic">Cohort Reception</h6>
                                                        <p className="text-sm text-slate-200 font-bold leading-relaxed whitespace-pre-wrap">{report.student_reception || 'No reception metrics.'}</p>
                                                     </div>
                                                     <div className="space-y-4">
                                                        <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-[#FF6600] pl-4 italic">Strategic Impact</h6>
                                                        <p className="text-sm text-slate-200 font-bold leading-relaxed whitespace-pre-wrap">{report.action_taken || 'No behavioral shifts recorded.'}</p>
                                                     </div>
                                                  </div>
                                                  <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                                                     <p className="text-[9px] font-black text-slate-500 uppercase italic">Authenticated by {report.teacher_name}</p>
                                                     <div className="flex items-center gap-2">
                                                        <p className="text-[9px] font-black text-[#FF6600] uppercase italic">Reception Velocity: {report.reception_score}/10</p>
                                                     </div>
                                                  </div>
                                               </div>
                                            ))}
                                         </div>
                                      )}

                                      {/* PM WEEKLY REPORT INPUT (Tactical Oversight) */}
                                      <div className="mt-12 pt-12 border-t border-white/5 text-left space-y-6">
                                         <div className="flex items-center gap-4">
                                            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                               <Target className="w-5 h-5" />
                                            </div>
                                            <div>
                                               <h5 className="text-xl font-black text-white uppercase tracking-tighter italic leading-none">PM Weekly Review</h5>
                                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Mission Authority Oversight</p>
                                            </div>
                                         </div>
                                         
                                         <div className="relative group">
                                            <textarea 
                                               rows={4}
                                               placeholder="Enter your tactical oversight report for this week... (Required for 100% Progress)"
                                               className="w-full bg-black/40 border border-white/10 rounded-[2rem] p-8 text-slate-200 font-bold text-sm outline-none focus:border-[#FF6600]/50 transition-all resize-none shadow-inner"
                                               value={pmReportInputs[wn]?.notes || ''}
                                               onChange={e => setPmReportInputs(prev => ({ ...prev, [wn]: { ...prev[wn], notes: e.target.value } }))}
                                            />
                                            <button 
                                               onClick={() => handleSavePMReport(wn)}
                                               disabled={pmReportInputs[wn]?.saving || !pmReportInputs[wn]?.notes}
                                               className="absolute bottom-6 right-6 px-8 py-3 bg-[#FF6600] text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-white transition-all shadow-xl shadow-[#FF6600]/20 disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                               {pmReportInputs[wn]?.saving ? 'Syncing...' : 'Lock Report'}
                                            </button>
                                         </div>
                                      </div>

                                   </div>
                                </motion.div>
                             )}
                          </AnimatePresence>
                       </div>
                    );
                 })}
              </div>
           )}
           {activeTab === 'resources' && (
              <div className="max-w-4xl space-y-12">
                 <div className="space-y-6 text-left">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">Program Concept Note</h3>
                    <div className="ios-card bg-white/[0.02] border-white/5 !p-12 leading-relaxed text-slate-300 font-bold whitespace-pre-wrap text-lg italic shadow-inner">
                       {program.note_description || program.description || 'No conceptual overview provided for this program.'}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6 text-left">
                       <h3 className="text-xl font-black text-[#FF6600] uppercase tracking-widest italic">Core Assets</h3>
                       <div className="space-y-4">
                          {program.note_files && program.note_files.length > 0 ? (
                             program.note_files.map((file, idx) => (
                                <button 
                                   key={idx} 
                                   onClick={() => openMaterial({ name: file.name, data: file.url })}
                                   className="w-full ios-card bg-white/[0.02] border-[#FF6600]/20 !p-8 flex items-center justify-between group hover:bg-[#FF6600]/5 transition-all cursor-pointer"
                                >
                                   <div className="flex items-center gap-6">
                                      <div className="w-12 h-12 bg-[#FF6600]/10 rounded-2xl flex items-center justify-center text-[#FF6600]">
                                         <FileText className="w-6 h-6" />
                                      </div>
                                      <span className="text-sm font-black text-white uppercase tracking-widest italic truncate max-w-[180px]">{file.name || 'Core Asset'}</span>
                                   </div>
                                   <ChevronRight className="w-6 h-6 text-slate-600 group-hover:text-[#FF6600]" />
                                </button>
                             ))
                          ) : (
                             <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic p-10 border border-white/5 rounded-[2rem] bg-white/[0.01]">Awaiting Core Assets...</p>
                          )}
                       </div>
                    </div>

                    <div className="space-y-6 text-left">
                       <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest italic">Supplementary Material</h3>
                       <div className="space-y-4">
                          {program.materials && program.materials.length > 0 ? (
                             program.materials.map((file, idx) => (
                                <button 
                                   key={idx} 
                                   onClick={() => openMaterial(file)}
                                   className="w-full ios-card bg-white/[0.01] border-white/5 !p-8 flex items-center justify-between group hover:bg-white/[0.05] transition-all cursor-pointer text-left"
                                >
                                   <div className="flex items-center gap-6">
                                      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400">
                                         <BookOpen className="w-6 h-6" />
                                      </div>
                                      <span className="text-sm font-black text-white uppercase tracking-widest italic truncate max-w-[180px]">{file.name || 'Material'}</span>
                                   </div>
                                   <ChevronRight className="w-6 h-6 text-slate-600 group-hover:text-white" />
                                </button>
                             ))
                          ) : (
                             <div className="ios-card bg-white/[0.01] border-white/5 !p-12 flex flex-col items-center justify-center gap-4 opacity-40">
                                <Plus className="w-8 h-8 text-slate-800" />
                                <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest italic">Knowledge Nodes Offline</p>
                             </div>
                          )}
                       </div>
                    </div>
                 </div>
              </div>
           )}


            {activeTab === 'progress' && (
               <div className="max-w-5xl space-y-12">
                  <div className="grid grid-cols-1 gap-8">
                     {sessions.map(session => (
                        <div key={session.id} className="ios-card bg-white/[0.01] border-white/5 !p-8 space-y-8 group hover:border-[#FF6600]/20 transition-all">
                           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                              <div className="flex items-center gap-6">
                                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                                    session.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
                                    session.status === 'in progress' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 
                                    'bg-white/5 border-white/10 text-slate-400'
                                 }`}>
                                    <Zap className="w-6 h-6" />
                                 </div>
                                 <div>
                                    <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">{session.title}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Week {session.week_number} • {session.assignment_type || 'Module'}</p>
                                 </div>
                              </div>
                              
                               <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-2xl border border-white/5">
                                 {['not started', 'in progress', 'completed'].map(st => (
                                    <button 
                                       key={st}
                                       onClick={() => handleToggleSessionStatus(session.id, st)}
                                       className={`px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                          session.status === st ? (
                                             st === 'completed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                                             st === 'in progress' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' :
                                             'bg-white/10 text-white shadow-lg'
                                          ) : 'text-slate-500 hover:text-white'
                                       }`}
                                    >
                                       {st}
                                    </button>
                                 ))}
                              </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8 border-t border-white/5">
                              {docRequirements.filter(dr => dr.session_id == session.id).map(req => (
                                 <div key={req.id} className={`flex items-center justify-between p-6 rounded-3xl border transition-all group/item ${req.is_completed ? 'bg-[#FF6600]/10 border-[#FF6600]/40 shadow-lg shadow-[#FF6600]/5' : 'bg-white/[0.02] border-white/5 hover:border-white/20'}`}>
                                    <div className="flex items-center gap-5">
                                       <button 
                                          onClick={() => handleToggleDeliverableStatus(req.id, !req.is_completed)}
                                          className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${
                                             req.is_completed 
                                             ? 'bg-[#FF6600] border-[#FF6600] text-black scale-110 shadow-[0_0_20px_rgba(255,102,0,0.5)]' 
                                             : 'bg-black/40 border-white/10 hover:border-[#FF6600] hover:scale-105'
                                          }`}
                                       >
                                          {req.is_completed ? (
                                             <CheckCircle2 className="w-5 h-5 stroke-[3px]" />
                                          ) : (
                                             <div className="w-2 h-2 rounded-full bg-white/10 group-hover/item:bg-[#FF6600]/50" />
                                          )}
                                       </button>
                                       <div>
                                          <span className={`text-xs font-black uppercase tracking-widest italic transition-colors ${req.is_completed ? 'text-white' : 'text-slate-400 group-hover/item:text-slate-300'}`}>{req.title}</span>
                                          {req.is_completed && <p className="text-[7px] font-black text-[#FF6600] uppercase tracking-[0.2em] mt-1 animate-pulse">Requirement Validated</p>}
                                       </div>
                                    </div>
                                    <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-tighter border ${req.is_completed ? 'bg-black/40 border-[#FF6600]/30 text-[#FF6600]' : 'bg-white/5 border-white/5 text-slate-600'}`}>
                                       {req.is_completed ? 'Authenticated' : 'Pending'}
                                    </div>
                                 </div>
                              ))}
                              {docRequirements.filter(dr => dr.session_id == session.id).length === 0 && (
                                 <p className="col-span-full text-[10px] font-black text-slate-600 uppercase italic">No active deliverables anchored to this node.</p>
                              )}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}
            {activeTab === 'teams' && (
               <div className="space-y-10">
                  <div className="flex justify-between items-end mb-12">
                     <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-widest italic">Squad Registry</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Active Units: {teams.length}</p>
                     </div>
                     <button 
                        onClick={() => setShowTeamModal(true)}
                        className="px-10 py-4 bg-[#FF6600] text-black font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white transition-all shadow-xl shadow-[#FF6600]/10"
                     >
                        + Deploy New Unit
                     </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {teams.map(team => (
                        <div key={team.id} className="ios-card bg-white/[0.01] border-white/5 p-12 flex flex-col justify-between group hover:border-[#FF6600]/20 transition-all shadow-2xl relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-40 h-40 bg-[#FF6600]/5 rounded-full -mr-20 -mt-20 blur-[80px]" />
                           <div className="space-y-10 relative z-10">
                              <div className="w-16 h-16 rounded-3xl bg-[#FF6600]/10 flex items-center justify-center text-[#FF6600] border border-[#FF6600]/20 shadow-xl shadow-[#FF6600]/5">
                                 <Target className="w-8 h-8" />
                              </div>
                              <div>
                                 <h4 className="text-4xl font-black text-white uppercase tracking-tighter italic leading-[0.8] mb-4">{team.name}</h4>
                                 <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                                    <span className="text-slate-600">Handler:</span> {team.handler_name || 'Unassigned'}
                                 </p>
                              </div>
                           </div>
                           <div className="mt-16 pt-8 border-t border-white/5 flex justify-between items-center relative z-10">
                              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic">Unit Healthy</span>
                              <div className="flex items-center gap-3">
                                 <button onClick={async () => {
                                    if(confirm('Decommission this unit?')) {
                                       await fetch('/api/v2/pm/teams', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: team.id}) });
                                       fetchPMData();
                                    }
                                 }} className="p-3 rounded-xl bg-white/5 text-slate-600 hover:text-rose-500 transition-all"><Trash2 className="w-4 h-4"/></button>
                                 <button className="p-4 rounded-2xl bg-[#FF6600]/10 text-[#FF6600] hover:bg-[#FF6600] hover:text-black transition-all"><ArrowRight className="w-5 h-5" /></button>
                              </div>
                           </div>
                        </div>
                     ))}
                     {teams.length === 0 && <div className="col-span-full py-60 ios-card border-dashed flex flex-col items-center justify-center italic text-slate-600 text-[11px] uppercase tracking-widest">Awaiting Unit Deployment...</div>}
                  </div>
               </div>
            )}

            {activeTab === 'participants' && (
               <div className="space-y-10">
                  <div className="flex justify-between items-end mb-12">
                     <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-widest italic">Enrollment Registry</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Total Participants: {participants.length}</p>
                     </div>
                  </div>

                  <div className="ios-card bg-white/[0.01] border-white/5 !p-0 overflow-hidden shadow-2xl">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="border-b border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] bg-white/[0.02]">
                              <th className="p-8">Participant Node</th>
                              <th className="p-8">Email Index</th>
                              <th className="p-8">Squad Assignment</th>
                              <th className="p-8">Status</th>
                              <th className="p-8 text-right">Action</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                           {participants.map(p => (
                              <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                                 <td className="p-8 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-xs">
                                       {p.name.charAt(0)}
                                    </div>
                                    <div>
                                       <p className="text-sm font-black text-white uppercase tracking-tighter italic leading-none">{p.name}</p>
                                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-60">ID: {p.cid || 'N/A'}</p>
                                    </div>
                                 </td>
                                 <td className="p-8 font-bold text-slate-400 text-xs lowercase">{p.email}</td>
                                 <td className="p-8">
                                    <div className="relative group/sel">
                                       <select 
                                          className="bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-[10px] font-black text-slate-400 outline-none focus:border-[#FF6600] appearance-none cursor-pointer uppercase tracking-widest hover:text-white transition-all pr-10"
                                          defaultValue={p.group_name || ''}
                                          onChange={async (e) => {
                                             const newGroup = e.target.value;
                                             try {
                                                await fetch('/api/contacts', {
                                                   method: 'PUT',
                                                   headers: { 'Content-Type': 'application/json' },
                                                   body: JSON.stringify({ cid: p.cid, group_name: newGroup })
                                                });
                                                window.dispatchEvent(new CustomEvent('impactos:notify', { 
                                                   detail: { type: 'success', message: 'Squad Updated.' } 
                                                }));
                                                fetchPMData();
                                             } catch(e) {}
                                          }}
                                       >
                                          <option value="" className="bg-[#0f0f1a]">No Squad</option>
                                          {teams.map(t => <option key={t.id} value={t.name} className="bg-[#0f0f1a]">{t.name.toUpperCase()}</option>)}
                                       </select>
                                       <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none group-hover/sel:text-white" />
                                    </div>
                                 </td>
                                 <td className="p-8">
                                    <span className="badge badge-glow-blue text-[8px] font-black uppercase italic">Operational</span>
                                 </td>
                                 <td className="p-8 text-right">
                                    <button className="p-3 rounded-xl bg-white/5 text-slate-600 hover:text-[#FF6600] transition-all"><ArrowRight className="w-4 h-4"/></button>
                                 </td>
                              </tr>
                           ))}
                           {participants.length === 0 && (
                              <tr>
                                 <td colSpan={5} className="p-20 text-center text-[10px] font-black text-slate-600 uppercase tracking-widest italic">No participants anchored to this program node.</td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            )}


        </div>
      </div>

      <AnimatePresence>
         {selectedTask && (
            <div className="fixed inset-0 z-[500] flex items-start pt-20 justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto" onClick={() => { setSelectedTask(null); setNewReq({...newReq, isAdding: false}); }}>
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95 }} 
                 animate={{ opacity: 1, scale: 1 }} 
                 exit={{ opacity: 0, scale: 0.95 }} 
                 onClick={(e) => e.stopPropagation()}
                 className="ios-card w-full max-w-4xl bg-[#0d0d18] border-white/10 shadow-3xl p-16 overflow-y-auto max-h-[90vh] custom-scrollbar relative"
               >
                  
                  <div className="space-y-14">
                     <header className="flex justify-between items-start relative z-10">
                        <div className="space-y-4 text-left">
                           <div className="flex items-center gap-4">
                              <Activity className="w-5 h-5 text-[#FF6600]" />
                              <span className="text-[11px] font-bold text-[#FF6600] uppercase tracking-[0.5em]">Phase Logic</span>
                           </div>
                           <h3 className="text-5xl font-black text-white uppercase tracking-tighter italic leading-none">{selectedTask.id ? 'Mission Configuration' : 'Deploy New Module'}</h3>
                        </div>
                        <button onClick={() => { setSelectedTask(null); setNewReq({...newReq, isAdding: false}); }} className="p-4 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-all">
                           <X className="w-8 h-8" />
                        </button>
                     </header>

                     <div className="space-y-10">
                        <div className="space-y-3">
                           <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2 italic opacity-60">Module Name</label>
                           <input 
                              placeholder="Define the primary module objective..." 
                              className="w-full bg-[#0d0d18] border border-white/10 p-7 rounded-3xl text-white outline-none focus:border-[#FF6600] transition-all font-black text-xl shadow-inner" 
                              value={selectedTask.title || ''} 
                              onChange={e => setSelectedTask({...selectedTask, title: e.target.value})} 
                           />
                        </div>

                        <div className="space-y-3">
                           <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2 italic opacity-60">Objective Description</label>
                           <textarea 
                              rows={4} 
                              placeholder="Architect operational requirements..." 
                              className="w-full bg-[#0d0d18] border border-white/10 p-7 rounded-3xl text-white outline-none focus:border-[#FF6600] transition-all font-bold resize-none leading-relaxed text-md shadow-inner" 
                              value={selectedTask.description || ''} 
                              onChange={e => setSelectedTask({...selectedTask, description: e.target.value})} 
                           />
                        </div>

                        <div className="space-y-3">
                           <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2 italic opacity-60">Knowledge Resource URL</label>
                           <input 
                              placeholder="https://knowledge-node.com/..." 
                              className="w-full bg-[#0d0d18] border border-white/10 p-7 rounded-3xl text-white outline-none focus:border-[#FF6600] transition-all font-bold text-md shadow-inner" 
                              value={selectedTask.material_url || ''} 
                              onChange={e => setSelectedTask({...selectedTask, material_url: e.target.value})} 
                           />
                        </div>

                        <div className="space-y-6 bg-white/5 p-6 md:p-8 rounded-3xl border border-white/5">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                              <div className="space-y-3 text-left">
                                 <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2 italic opacity-60">Start Date *</label>
                                 <input 
                                    type="date"
                                    required
                                    className="w-full bg-[#0d0d18] border border-white/10 p-6 rounded-2xl text-white outline-none font-black shadow-inner focus:border-[#FF6600] [color-scheme:dark]"
                                    value={selectedTask.scheduled_date || ''}
                                    onChange={e => setSelectedTask({...selectedTask, scheduled_date: e.target.value})}
                                 />
                              </div>
                              <div className="space-y-3 text-left">
                                 <label className="text-[12px] font-black text-white uppercase tracking-[0.3em] ml-2 italic">End Date *</label>
                                 <input 
                                    type="date"
                                    required
                                    className="w-full bg-[#0d0d18] border border-white/10 p-6 rounded-2xl text-white outline-none font-black shadow-inner focus:border-[#FF6600] [color-scheme:dark]"
                                    value={selectedTask.end_date || ''}
                                    onChange={e => setSelectedTask({...selectedTask, end_date: e.target.value})}
                                 />
                              </div>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                              <div className="space-y-3 text-left opacity-60">
                                 <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2 italic">Start Time (Optional)</label>
                                 <input 
                                    type="time"
                                    className="w-full bg-[#0d0d18] border border-white/10 p-6 rounded-2xl text-white outline-none font-black shadow-inner focus:border-[#FF6600]"
                                    value={selectedTask.start_time || ''}
                                    onChange={e => setSelectedTask({...selectedTask, start_time: e.target.value})}
                                 />
                              </div>
                              <div className="space-y-3 text-left opacity-60">
                                 <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2 italic">End Time (Optional)</label>
                                 <input 
                                    type="time"
                                    className="w-full bg-[#0d0d18] border border-white/10 p-6 rounded-2xl text-white outline-none font-black shadow-inner focus:border-[#FF6600]"
                                    value={selectedTask.end_time || ''}
                                    onChange={e => setSelectedTask({...selectedTask, end_time: e.target.value})}
                                 />
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3 text-left">
                               <label className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2 italic opacity-60">Deployment Status</label>
                               <div className="relative">
                                  <select 
                                     className="w-full bg-[#0d0d18] border border-white/10 p-7 rounded-3xl text-white outline-none font-black appearance-none cursor-pointer focus:border-[#FF6600] shadow-inner"
                                     value={selectedTask.status}
                                     onChange={e => setSelectedTask({...selectedTask, status: e.target.value})}
                                  >
                                     <option value="pending" className="bg-[#080810]">PENDING</option>
                                     <option value="active" className="bg-[#080810]">ACTIVE</option>
                                     <option value="completed" className="bg-[#080810]">COMPLETE</option>
                                  </select>
                                  <ChevronDown className="absolute right-7 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500 pointer-events-none" />
                               </div>
                            </div>
                            <div className="space-y-3 text-left">
                               <label className="text-[12px] font-black text-[#FF6600] uppercase tracking-[0.3em] ml-2 italic">Assigned Personnel (Teacher)</label>
                               <div className="relative">
                                  <select 
                                     className="w-full bg-[#0d0d18] border border-white/10 p-7 rounded-3xl text-white outline-none font-black appearance-none cursor-pointer focus:border-[#FF6600] shadow-inner"
                                     value={selectedTask.handler_id || ''}
                                     onChange={e => {
                                        const s = staffList.find(x => x.cid === e.target.value);
                                        setSelectedTask({...selectedTask, handler_id: e.target.value, handler_name: s ? s.name : ''});
                                     }}
                                  >
                                     <option value="" className="bg-[#080810]">Awaiting Assignment...</option>
                                     {staffList.map(s => <option key={s.cid} value={s.cid} className="bg-[#080810]">{(s.name || 'Unknown').toUpperCase()}</option>)}
                                  </select>
                                  <ChevronDown className="absolute right-7 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500 pointer-events-none" />
                               </div>
                            </div>
                        </div>
                        <div className="space-y-3 text-left">
                         {/* UNIFIED TASK MULTI-SELECT ARCHITECTURE */}
                         <div className="space-y-10 py-6 border-t border-white/5">
                            <div className="space-y-4 text-left">
                               <label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] ml-1">Delivery Mode</label>
                               <div className="flex flex-wrap gap-3 p-2">
                                  {standardTypes.tasks?.map(type => {
                                     const current = (selectedTask.task_type || '').split(',').filter(x => x);
                                     const isSelected = current.includes(type.label);
                                     return (
                                        <button
                                           key={type.id}
                                           onClick={() => {
                                              const next = isSelected ? current.filter(x => x !== type.label) : [...current, type.label];
                                              setSelectedTask({...selectedTask, task_type: next.join(',')});
                                           }}
                                           className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${isSelected ? 'bg-[#FF6600] text-black border-[#FF6600] shadow-xl shadow-[#FF6600]/10' : 'bg-white/5 text-slate-400 border-white/5 hover:border-white/10'}`}
                                        >
                                           {type.label}
                                        </button>
                                     );
                                  })}
                               </div>
                            </div>
                         </div>
                        </div>

                        {/* DELIVERABLE ANCHORING (Manifest Staging) */}
                        <div className="pt-8 border-t border-white/5 space-y-12">
                           <div className="flex justify-between items-center">
                              <h5 className="text-[13px] font-black text-white uppercase tracking-[0.4em] italic mb-0 leading-none font-sans">Expected deliverables from the student</h5>
                              <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest bg-[#FF6600]/10 px-4 py-1.5 rounded-full border border-[#FF6600]/20 shadow-lg animate-pulse">
                                 {docRequirements.filter(dr => String(dr.session_id) === String(selectedTask.id)).length} Active Nodes
                              </span>
                           </div>

                           <div className="space-y-6">
                               {/* THE MANIFEST GRID (Deployed Items) */}
                               {selectedTask.id && (
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {docRequirements.filter(dr => String(dr.session_id) === String(selectedTask.id)).map(req => (
                                       <div key={req.id} className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl flex items-center justify-between group hover:border-[#FF6600]/30 transition-all shadow-lg">
                                          <div className="flex items-center gap-4 text-left">
                                             <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#FF6600]">
                                                {getFormatIcon(req.allowed_format)}
                                             </div>
                                             <div>
                                                {editingReq?.id === req.id ? (
                                                  <div className="flex flex-col gap-2">
                                                     <input 
                                                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-xs text-white outline-none focus:border-[#FF6600]"
                                                        value={editingReq.title}
                                                        onChange={e => setEditingReq({...editingReq, title: e.target.value})}
                                                        onBlur={async () => {
                                                           try {
                                                              await fetch('/api/v2/pm/curriculum', {
                                                                 method: 'PUT',
                                                                 headers: { 'Content-Type': 'application/json' },
                                                                 body: JSON.stringify({ id: req.id, title: editingReq.title, allowed_format: editingReq.allowed_format })
                                                              });
                                                              await fetchPMData();
                                                              setEditingReq(null);
                                                           } catch(e) {}
                                                        }}
                                                        autoFocus
                                                     />
                                                     <select 
                                                        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[9px] text-[#FF6600] font-black uppercase outline-none"
                                                        value={editingReq.allowed_format}
                                                        onChange={e => setEditingReq({...editingReq, allowed_format: e.target.value})}
                                                     >
                                                        {standardTypes.media?.map(t => <option key={t.id} value={t.label.toLowerCase()}>{t.label}</option>)}
                                                     </select>
                                                  </div>
                                                ) : (
                                                  <>
                                                     <p className="text-xs font-black text-white uppercase tracking-tighter italic leading-none">{req.title}</p>
                                                     <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">{req.allowed_format?.toUpperCase()}</p>
                                                  </>
                                                )}
                                             </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                             <button onClick={() => setEditingReq(req)} className="p-2 text-slate-800 hover:text-[#FF6600] opacity-0 group-hover:opacity-100 transition-all">
                                                <Edit3 className="w-4 h-4" />
                                             </button>
                                             <button onClick={() => handleDeleteRequirement(req.id)} className="p-2 text-slate-800 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110">
                                                <Trash2 className="w-4 h-4" />
                                             </button>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                               )}

                                  {/* MANIFEST STAGING TERMINAL (Drafting Area) */}
                                   {newReq.isAdding ? (
                                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="ios-card bg-white/[0.02] border-white/5 !p-8 space-y-10 shadow-3xl">
                                         
                                         <div className="space-y-6">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-1">1. Build Manifest from Registry</label>
                                            <div className="flex flex-wrap gap-2 p-2 bg-black/20 rounded-2xl border border-white/5">
                                               {standardTypes.deliverables?.map(t => {
                                                  const isSelected = newReq.manifest.some(m => m.title === t.label);
                                                  return (
                                                     <button 
                                                        key={t.id}
                                                        onClick={() => {
                                                           if (isSelected) {
                                                              setNewReq({...newReq, manifest: newReq.manifest.filter(m => m.title !== t.label)});
                                                           } else {
                                                              setNewReq({...newReq, manifest: [...newReq.manifest, { title: t.label, format: 'pdf' }]});
                                                           }
                                                        }}
                                                        className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${isSelected ? 'bg-[#FF6600] text-black border-[#FF6600] shadow-lg' : 'bg-white/5 text-slate-400 border-white/5 hover:border-white/10'}`}
                                                     >
                                                        {t.label}
                                                     </button>
                                                  );
                                               })}
                                            </div>
                                         </div>

                                         <div className="space-y-4">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] ml-1">Or Manual Entry</label>
                                            <div className="flex gap-3">
                                               <input 
                                                  placeholder="Type custom requirement name..." 
                                                  className="flex-1 bg-black/20 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-[#FF6600]/50 font-bold text-sm shadow-inner"
                                                  value={newReq.customTitle}
                                                  onChange={e => setNewReq({...newReq, customTitle: e.target.value})}
                                               />
                                               <button 
                                                  onClick={() => {
                                                     if (!newReq.customTitle) return;
                                                     setNewReq({
                                                        ...newReq, 
                                                        manifest: [...newReq.manifest, { title: newReq.customTitle, format: 'pdf' }],
                                                        customTitle: ''
                                                     });
                                                  }}
                                                  className="px-8 bg-white/5 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-[#FF6600] hover:text-black transition-all border border-white/5"
                                               >
                                                  + Add to Staged
                                               </button>
                                            </div>
                                         </div>

                                         {/* THE MANIFEST TABLE */}
                                         {newReq.manifest.length > 0 && (
                                            <div className="space-y-4">
                                               <label className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.4em] ml-1">2. Audit Staged Manifest</label>
                                               <div className="overflow-hidden rounded-3xl border border-white/5 bg-black/20">
                                                  <table className="w-full text-left">
                                                     <thead>
                                                        <tr className="border-b border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                           <th className="p-6">Requirement Node</th>
                                                           <th className="p-6">Content Type</th>
                                                           <th className="p-6 text-right">Remove</th>
                                                        </tr>
                                                     </thead>
                                                     <tbody className="divide-y divide-white/5">
                                                        {newReq.manifest.map((item, idx) => (
                                                           <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                                              <td className="p-6 font-black text-white text-xs uppercase italic">{item.title}</td>
                                                              <td className="p-6">
                                                                 <select 
                                                                    className="bg-[#0d0d18] border border-white/10 rounded-xl px-4 py-2 text-[10px] font-black text-[#FF6600] outline-none focus:border-[#FF6600] appearance-none cursor-pointer uppercase tracking-widest"
                                                                    value={item.format}
                                                                    onChange={(e) => {
                                                                       const updated = [...newReq.manifest];
                                                                       updated[idx].format = e.target.value;
                                                                       setNewReq({...newReq, manifest: updated});
                                                                    }}
                                                                 >
                                                                    {standardTypes.media?.map(t => <option key={t.id} value={t.label.toLowerCase()} className="bg-[#0f0f1a]">{t.label}</option>)}
                                                                 </select>
                                                              </td>
                                                              <td className="p-6 text-right">
                                                                 <button 
                                                                    onClick={() => setNewReq({...newReq, manifest: newReq.manifest.filter((_, i) => i !== idx)})}
                                                                    className="p-2 text-slate-800 hover:text-rose-500 transition-colors"
                                                                 >
                                                                    <Trash2 className="w-4 h-4" />
                                                                 </button>
                                                              </td>
                                                           </tr>
                                                        ))}
                                                     </tbody>
                                                  </table>
                                               </div>
                                            </div>
                                         )}

                                         <div className="pt-6 flex gap-4">
                                            <button 
                                               onClick={handleAddRequirements}
                                               disabled={isProcessing || newReq.manifest.length === 0}
                                               className="flex-1 h-[64px] bg-[#FF6600] text-black font-black uppercase text-[11px] tracking-[0.4em] rounded-3xl flex items-center justify-center gap-3 hover:bg-white transition-all shadow-xl shadow-[#FF6600]/10 disabled:opacity-20 italic"
                                            >
                                               {isProcessing ? <Clock className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4" />}
                                               {selectedTask.id ? 'Anchor to Module' : 'Stage for Deployment'} ({newReq.manifest.length})
                                            </button>
                                            <button onClick={() => setNewReq({...newReq, isAdding: false, manifest: []})} className="h-[64px] px-10 bg-white/5 rounded-3xl text-[11px] font-black text-slate-500 hover:text-white transition-all uppercase tracking-widest">Cancel</button>
                                         </div>
                                      </motion.div>
                                   ) : (
                                      <button 
                                         onClick={() => setNewReq({...newReq, isAdding: true})}
                                         className="w-full py-10 bg-white/[0.01] border border-white/5 rounded-[2.5rem] text-[11px] font-bold text-slate-500 uppercase tracking-widest hover:bg-[#FF6600]/5 hover:text-[#FF6600] transition-all flex items-center justify-center gap-4 border-dashed"
                                      >
                                         <Plus className="w-4 h-4" /> Define Deliverable Manifest
                                      </button>
                                   )}
                              </div>
                           </div>

                        {/* ACTION BUTTONS (Moved to the bottom) */}
                        <div className="flex gap-8 pt-8 border-t border-white/5">
                            <button onClick={() => { setSelectedTask(null); setNewReq({...newReq, isAdding: false}); }} className="flex-1 py-6 rounded-3xl bg-white/5 text-slate-600 font-black uppercase text-[11px] tracking-widest hover:text-white transition-all italic border border-transparent">Cancel</button>
                            <button 
                               onClick={() => handleSaveTaskConfig(selectedTask)} 
                               disabled={isProcessing}
                               className="flex-[2] py-6 rounded-3xl bg-[#FF6600] text-black font-black uppercase text-[11px] tracking-widest hover:bg-white transition-all shadow-xl shadow-[#FF6600]/20 italic"
                            >
                               {isProcessing ? 'Saving...' : 'Save Configuration'}
                            </button>
                         </div>
                     </div>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
      {/* TEAM DEPLOYMENT MODAL */}
      <AnimatePresence>
         {showTeamModal && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="ios-card w-full max-w-md !p-12 space-y-10 border-white/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-[#FF6600]/5 rounded-full -mr-20 -mt-20 blur-3xl" />
                  <div className="flex flex-col items-center gap-6 mb-4 text-center">
                     <div className="p-5 bg-[#FF6600]/10 rounded-3xl text-[#FF6600] border border-[#FF6600]/20 shadow-xl">
                        <Target className="w-8 h-8" />
                     </div>
                     <div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Deploy Unit</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Initialize squad operational parameters</p>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic">Unit Identity</label>
                        <input 
                           placeholder="Team Alpha / Squad Zero..." 
                           className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl text-white outline-none focus:border-[#FF6600] transition-all font-black text-lg shadow-inner" 
                           value={newTeam.name}
                           onChange={e => setNewTeam({...newTeam, name: e.target.value})}
                        />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 italic">Mission Handler (Staff)</label>
                        <div className="relative">
                           <select 
                              className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl text-white outline-none font-black appearance-none cursor-pointer focus:border-[#FF6600] shadow-inner"
                              value={newTeam.handler_id}
                              onChange={e => {
                                 const s = staffList.find(x => x.cid === e.target.value);
                                 setNewTeam({...newTeam, handler_id: e.target.value, handler_name: s ? s.name : ''});
                              }}
                           >
                              <option value="">Awaiting Assignment...</option>
                              {staffList.map(s => <option key={s.cid} value={s.cid} className="bg-[#080810]">{s.name.toUpperCase()}</option>)}
                           </select>
                           <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500 pointer-events-none" />
                        </div>
                     </div>

                     <div className="flex gap-6 pt-6">
                        <button onClick={() => setShowTeamModal(false)} className="flex-1 py-5 rounded-2xl bg-white/5 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all italic">Abort</button>
                        <button 
                           onClick={async () => {
                              if (!newTeam.name) return;
                              setIsProcessing(true);
                              const res = await fetch('/api/v2/pm/teams', {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({ ...newTeam, program_id: id })
                              });
                              if ((await res.json()).success) {
                                 await fetchPMData();
                                 setShowTeamModal(false);
                                 setNewTeam({ name: '', handler_id: '', handler_name: '' });
                              }
                              setIsProcessing(false);
                           }}
                           disabled={isProcessing || !newTeam.name}
                           className="flex-1 py-5 rounded-2xl bg-[#FF6600] text-black font-black uppercase text-[10px] tracking-widest hover:bg-white transition-all shadow-xl shadow-[#FF6600]/20 italic"
                        >
                           {isProcessing ? 'Deploying...' : 'Deploy Unit'}
                        </button>
                     </div>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
