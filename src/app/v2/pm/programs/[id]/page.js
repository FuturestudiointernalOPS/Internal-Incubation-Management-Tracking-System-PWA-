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
import { getPrefetchedData } from '@/utils/prefetch';
import { IMPACT_CACHE } from '@/utils/impactCache';

export default function PMProgramTerminalV2({ params }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  const router = useRouter();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState({});
  const [activeTab, setActiveTab] = useState('overview'); // overview | sessions | staff | participants
  const [program, setProgram] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [docRequirements, setDocRequirements] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [staffList, setStaffList] = useState([]); // For handler assignment
  const [sessions, setSessions] = useState([]);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [activeRecipient, setActiveRecipient] = useState(null); // null for "all" or contact object
  const [newParticipant, setNewParticipant] = useState({ name: '', email: '', screening_status: 'applied' });

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(sessionUser);
    fetchPMData();
  }, [id]);

  const fetchPMData = async () => {
    try {
      const pmSession = localStorage.getItem('pm_session');
      const url = `/api/v2/pm/full-state?id=${id}`;

      const processData = (data) => {
        setProgram(data.program);
        setParticipants(data.participants || []);
        setTeams(data.teams || []);
        setSessions(data.sessions || []);
        setStaffList(data.staffList || []);
        setEvents(data.events || []);
        setKpis(data.kpis || []);
        setDocRequirements(data.documents || []);
        setFollowups(data.followups || []);
      };

      // 1. Check Prefetch Store (Zero Latency)
      const prefetched = getPrefetchedData(url);
      if (prefetched) {
         processData(prefetched);
         setIsLoaded(true);
         return;
      }

      // 2. Check Cache (Fast Feedback)
      const cached = IMPACT_CACHE.get(`pm_program_${id}`);
      if (cached) {
         processData(cached);
         setIsLoaded(true);
      }

      // UNITARY FULL-STATE SYNC
      const res = await fetch(url);
      const data = await res.json();

      if (!data.success || !data.program) {
         router.replace('/v2/pm');
         return;
      }

      // Security check: Match PM identity to Program assignment OR is Super Admin
      const isSuperAdmin = user.role === 'super_admin';
      if (!isSuperAdmin && (data.program.assigned_pm_id !== user.id || !pmSession)) {
         router.replace('/v2/pm');
         return;
      }

      processData(data);
      IMPACT_CACHE.set(`pm_program_${id}`, data);
      setIsLoaded(true);
    } catch (e) {
      console.error(e);
      setIsLoaded(true);
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

  const handleAddTeam = async (teamName, handlerId) => {
     try {
        const handlerName = staffList.find(s => s.cid === handlerId)?.name || 'Unassigned';
        const res = await fetch('/api/v2/teams', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ program_id: id, name: teamName, handler_id: handlerId, handler_name: handlerName })
        });
        const data = await res.json();
        if (data.success) {
           setTeams([...teams, data.team]);
           setShowTeamModal(false);
        }
     } catch (e) { console.error(e); }
  };

  const handleAddEvent = async (eventData) => {
     try {
        const res = await fetch('/api/v2/events', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ ...eventData, program_id: id, created_by: 'PM' })
        });
        const data = await res.json();
        if (data.success) {
           setEvents([...events, data.event]);
           setShowEventModal(false);
        }
     } catch (e) { console.error(e); }
  };

  const handleAddFollowup = async (comment, week) => {
     try {
        const res = await fetch('/api/v2/followups', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ program_id: id, week_number: week, comment })
        });
        const data = await res.json();
        if (data.success) {
           setFollowups([data.followup, ...followups]);
        }
     } catch (e) { console.error(e); }
  };

  const handleSendMessage = async (subject, body, recipient) => {
     try {
        const res = await fetch('/api/v2/messages', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              program_id: id,
              sender_id: user.cid || user.id,
              recipient_id: recipient === 'all' ? 'all' : recipient.email,
              subject,
              body
           })
        });
        if ((await res.json()).success) {
           alert("Message broadcasted via email nodes.");
           setShowMessageModal(false);
        }
     } catch (e) { alert("Comms failure."); }
  };

  const userRole = user.roleLabel || user.role;
  const isReadOnly = userRole === 'super_admin';

  const handleContactAdmin = () => {
    const method = confirm("Initialize External Comms Hub?\n\nOK: Microsoft Teams\nCancel: WhatsApp");
    if (method) {
      window.open(`https://teams.microsoft.com/l/chat/0/0?users=admin@impactos.com`, '_blank');
    } else {
      window.open(`https://wa.me/PM_ADMIN_LINK_PLACEHOLDER`, '_blank');
    }
  };

  // Detailed Progress Calculation
  const totalTopics = sessions.length || 0;
  const completedTopics = sessions.filter(s => s.status === 'completed').length;
  const granularProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  if (!isLoaded || !program) return (
     <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#0066FF]/20 border-t-[#0066FF] rounded-full animate-spin" />
     </div>
  );

  return (
    <DashboardLayout role="program_manager" activeTab="v2">
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
               <span className="text-[#0066FF] font-black text-[10px] uppercase tracking-[0.4em]">Operations Management</span>
               <div className="h-px w-10 bg-[#0066FF]/30" />
               <span className="badge badge-glow-indigo uppercase text-[8px] font-black italic">Lifecycle Node</span>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">
              {program.name}
            </h2>
            <p className="text-slate-500 font-bold mt-4 opacity-70 max-w-2xl leading-relaxed">{program.description || 'No description provided.'}</p>
          </div>
          
          <div className="flex gap-4">
              <button 
                onClick={handleContactAdmin}
                className="ios-card bg-[#0066FF]/10 border-[#0066FF]/20 !px-6 !py-4 flex items-center gap-3 group hover:bg-[#0066FF]/20 transition-all text-left"
              >
                 <div className="w-8 h-8 rounded-full bg-[#0066FF]/20 flex items-center justify-center text-[#0066FF] group-hover:scale-110 transition-transform">
                    <MessageSquare className="w-4 h-4" />
                 </div>
                 <div className="text-left">
                    <p className="text-[9px] font-black text-[#0066FF] uppercase tracking-widest">Connect Hub</p>
                    <p className="text-xs font-black text-white uppercase">{isReadOnly ? 'Message PM' : 'Message Admin'}</p>
                 </div>
              </button>
              
              <div className="ios-card bg-[#0066FF]/5 border-[#0066FF]/10 !px-8 !py-6 text-right">
                 <p className="text-[10px] font-black text-[#0066FF] uppercase tracking-widest mb-1">Execution Index</p>
                 <p className="text-xl font-black text-white uppercase tracking-tighter italic">Week 1 / {program.duration_weeks || 13}</p>
              </div>
           </div>
        </header>

        <nav className="flex items-center gap-8 border-b border-white/5 pb-0">
           {['overview', 'teams', 'participants', 'calendar', 'config', 'sessions'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-6 text-[11px] font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === tab ? 'text-[#0066FF]' : 'text-slate-500 hover:text-white'}`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div 
                    layoutId="activeTabUnderlinePM"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-[#0066FF] rounded-t-full shadow-[0_0_15px_rgba(0,102,255,1)]" 
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
                       <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 px-2">Operational Pulse</h4>
                       <div className="space-y-4">
                          <div className="flex justify-between p-4 rounded-xl bg-[#0066FF]/5 border border-[#0066FF]/10 text-left">
                             <div>
                                <p className="text-[9px] font-black text-[#0066FF] uppercase tracking-widest mb-1">Granular Progress</p>
                                <p className="text-xl font-black text-white italic">{granularProgress}%</p>
                             </div>
                             <div className="text-right">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Topics Completed</p>
                                <p className="text-xl font-black text-white italic">{completedTopics} / {totalTopics}</p>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="ios-card bg-[#0d0d18] border-white/5">
                       <div className="flex items-center justify-between mb-6 px-2">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Follow-up Ledger</h4>
                          {!isReadOnly && (
                             <button 
                               onClick={() => {
                                  const comm = prompt("Enter Executive Weekly Follow-up:");
                                  if(comm) handleAddFollowup(comm, 1);
                               }}
                               className="text-[9px] font-black text-[#0066FF] uppercase tracking-widest hover:text-white"
                             >
                                + ADD COMMENTARY
                             </button>
                          )}
                       </div>
                       <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                          {followups.map(fol => (
                             <div key={fol.id} className="p-4 rounded-xl bg-white/5 border border-white/5 text-left">
                                <p className="text-[8px] font-black text-[#0066FF] uppercase tracking-widest mb-2 italic">Week {fol.week_number} Documentation</p>
                                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">{fol.comment}</p>
                                <p className="text-[7px] text-slate-600 font-black uppercase tracking-widest mt-2">{new Date(fol.created_at).toLocaleDateString()}</p>
                             </div>
                          ))}
                          {followups.length === 0 && <p className="text-[10px] text-slate-700 font-black text-center py-8 italic uppercase tracking-widest">No follow-up commentary recorded.</p>}
                       </div>
                    </div>

                    <div className="ios-card bg-[#0d0d18] border-white/5">
                       <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Program Snapshot</h4>
                       <div className="space-y-4">
                          <div className="flex justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                             <span className="text-[10px] font-black text-white uppercase tracking-widest">Participants</span>
                             <span className="text-[10px] font-black text-[#0066FF] uppercase tracking-widest">{participants.length} CAPS</span>
                          </div>
                          <div className="flex justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                             <span className="text-[10px] font-black text-white uppercase tracking-widest">Active Units (Teams)</span>
                             <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{teams.length} NODES</span>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           )}

           {activeTab === 'teams' && (
              <div className="space-y-8">
                 <div className="flex justify-between items-center px-4">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Program Sub-Teams</h3>
                    <button onClick={() => setShowTeamModal(true)} className="btn-prime !py-3 !px-10">+ Create Team Node</button>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teams.map(team => (
                       <div key={team.id} className="ios-card bg-white/[0.02] border-white/5 p-8 flex flex-col justify-between group">
                          <div>
                             <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-[#0066FF]/10 flex items-center justify-center text-[#0066FF]">
                                   <Layers className="w-4 h-4" />
                                </div>
                                <h4 className="text-xl font-black text-white uppercase tracking-tighter">{team.name}</h4>
                             </div>
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">Execution Unit</p>
                             
                             <div className="space-y-4">
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 transition-colors group-hover:bg-white/[0.08]">
                                   <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-[#0d0d18] flex items-center justify-center overflow-hidden">
                                      <Shield className="w-5 h-5 text-slate-600" />
                                   </div>
                                   <div>
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Assigned Handler</p>
                                      <p className="text-xs font-black text-white uppercase mt-1 italic">{team.handler_name || 'No Manager Assigned'}</p>
                                   </div>
                                </div>
                             </div>
                          </div>
                          <button className="mt-8 text-[9px] font-black text-[#0066FF] uppercase tracking-widest flex items-center gap-2 hover:text-white transition-colors">
                             MANAGE TEAM RECIPIENTS <ArrowRight className="w-3 h-3" />
                          </button>
                       </div>
                    ))}
                 </div>
              </div>
           )}

           {activeTab === 'calendar' && (
              <div className="space-y-8">
                 <div className="flex justify-between items-center px-4">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Operational Calendar</h3>
                    <button onClick={() => setShowEventModal(true)} className="btn-prime !py-3 !px-10">+ Schedule Event</button>
                 </div>
                 <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    <div className="xl:col-span-3 ios-card bg-[#0d0d18] border-white/5 p-12 min-h-[600px] flex flex-col items-center justify-center">
                       <Calendar className="w-16 h-16 text-slate-800 mb-6" />
                       <p className="text-slate-600 font-bold uppercase text-[10px] tracking-[0.3em] italic">Initializing Holographic Timeline...</p>
                    </div>
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Upcoming Benchmarks</h4>
                       {events.length === 0 ? (
                          <div className="p-10 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 italic text-slate-600 text-xs">No scheduled events detected.</div>
                       ) : (
                          events.map(ev => (
                             <div key={ev.id} className="ios-card bg-white/5 p-6 border-white/5">
                                <div className="flex items-center gap-3 mb-2 text-left">
                                   <span className={`w-2 h-2 rounded-full ${ev.event_type === 'masterclass' ? 'bg-emerald-400' : 'bg-[#0066FF]'}`} />
                                   <h5 className="text-[10px] font-black text-white uppercase tracking-widest">{ev.title}</h5>
                                </div>
                                <p className="text-[9px] font-bold text-slate-500 mb-4">{new Date(ev.start_time).toLocaleString()}</p>
                                <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{ev.description}</p>
                             </div>
                          ))
                       )}
                    </div>
                 </div>
              </div>
           )}

           {activeTab === 'config' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                 <div className="space-y-8">
                    <div className="flex justify-between items-center pr-4">
                       <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Key Performance Indicators</h3>
                       <button onClick={() => setShowConfigModal(true)} className="text-[#0066FF] hover:text-white transition-colors"><Plus className="w-5 h-5" /></button>
                    </div>
                    <div className="space-y-4">
                       {kpis.map(kpi => (
                          <div key={kpi.id} className="ios-card bg-[#0d0d18] p-8 border-white/5">
                             <div className="flex justify-between items-start">
                                <div>
                                   <h5 className="text-sm font-black text-white uppercase tracking-tighter">{kpi.title}</h5>
                                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Goal Metric</p>
                                </div>
                                <span className="text-xl font-black text-[#0066FF] italic">{kpi.target_value}</span>
                             </div>
                          </div>
                       ))}
                       <div onClick={() => setShowConfigModal(true)} className="p-8 border-2 border-dashed border-white/5 rounded-3xl flex items-center justify-center group cursor-pointer hover:bg-white/5 transition-all text-center">
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest group-hover:text-[#0066FF] transition-colors">Add KPI Parameter</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-8">
                    <div className="flex justify-between items-center pr-4">
                       <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Document Checklist</h3>
                       <button 
                         onClick={() => setShowDocModal(true)}
                         className="text-emerald-400 hover:text-white transition-colors"
                       >
                          <Plus className="w-5 h-5" />
                       </button>
                    </div>
                    <div className="space-y-4">
                       {docRequirements.map(doc => {
                          const linkedSession = sessions.find(s => s.id === doc.session_id);
                          return (
                             <div key={doc.id} className="ios-card bg-[#0d0d18] p-8 border-white/5 flex items-center justify-between">
                                <div>
                                   <div className="flex items-center gap-2 mb-1">
                                      <h5 className="text-sm font-black text-white uppercase tracking-tighter">{doc.title}</h5>
                                      {linkedSession && <span className="text-[7px] font-black px-2 py-0.5 rounded bg-white/5 text-slate-500 uppercase tracking-widest">{linkedSession.title}</span>}
                                   </div>
                                   <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase leading-none">{doc.description}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                   <Shield className="w-4 h-4" />
                                </div>
                             </div>
                          );
                       })}
                       <div onClick={() => setShowDocModal(true)} className="p-8 border-2 border-dashed border-white/5 rounded-3xl flex items-center justify-center group cursor-pointer hover:bg-white/5 transition-all">
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">Add Submission Requirement</p>
                       </div>
                    </div>
                 </div>
              </div>
           )}

           {activeTab === 'participants' && (
              <div className="space-y-8">
                 <div className="flex justify-between items-center px-4">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Participant Asset Registry</h3>
                    <div className="flex gap-4">
                       <button 
                          onClick={() => {
                             const url = `${window.location.origin}/register-participant?program=${encodeURIComponent(program.name)}`;
                             navigator.clipboard.writeText(url);
                             alert("Registration Node Link copied to clipboard!");
                          }}
                          className={`btn-ghost !py-3 !px-8 text-[#0066FF] border-[#0066FF]/20 ${isReadOnly ? 'opacity-50 pointer-events-none' : ''}`}
                       >
                          Copy Register Link
                       </button>
                       <button 
                          onClick={() => {
                             if(isReadOnly) return;
                             setActiveRecipient('all');
                             setShowMessageModal(true);
                          }}
                          className={`btn-prime !py-3 !px-10 bg-[#0066FF] ${isReadOnly ? 'opacity-50 pointer-events-none' : ''}`}
                       >
                          Broadcast to All
                       </button>
                    </div>
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
                                {['Identity Node', 'Mail Vector', 'Sync Status', 'Evaluation Index', 'Actions'].map(h => (
                                   <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{h}</th>
                                ))}
                             </tr>
                          </thead>
                          <tbody>
                             {participants.map(p => (
                                <tr key={p.id}>
                                   <td className="px-8 py-6 font-black text-white uppercase tracking-tighter">{p.name}</td>
                                   <td className="px-8 py-6 text-slate-400 font-bold">{p.email}</td>
                                   <td className="px-8 py-6 uppercase font-black text-[10px] text-[#0066FF] tracking-widest">{p.status}</td>
                                   <td className="px-8 py-6 uppercase font-black text-[10px] text-emerald-400 tracking-widest">LEVEL 1</td>
                                   <td className="px-8 py-6">
                                      <button 
                                        onClick={() => {
                                           setActiveRecipient(p);
                                           setShowMessageModal(true);
                                        }}
                                        className="p-3 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                                      >
                                         <MessageSquare className="w-4 h-4" />
                                      </button>
                                   </td>
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
                           className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-[#0066FF]/30 font-bold"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Mail Identity</label>
                         <input 
                           type="email" 
                           value={newParticipant.email}
                           onChange={e => setNewParticipant({...newParticipant, email: e.target.value})}
                           className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-[#0066FF]/30 font-bold"
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

          {showTeamModal && (
             <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
                <TeamModal 
                  staff={staffList} 
                  onClose={() => setShowTeamModal(false)} 
                  onSubmit={handleAddTeam} 
                />
             </div>
          )}

          {showEventModal && (
             <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
                <EventModal 
                  onClose={() => setShowEventModal(false)} 
                  onSubmit={handleAddEvent} 
                />
             </div>
          )}

          {showConfigModal && (
             <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
                <KpiModal 
                  onClose={() => setShowConfigModal(false)} 
                  onSubmit={handleAddKpi} 
                />
             </div>
          )}

          {showMessageModal && (
             <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
                <MessageModal 
                  recipient={activeRecipient}
                  onClose={() => setShowMessageModal(false)} 
                  onSubmit={handleSendMessage} 
                />
             </div>
          )}

          {showDocModal && (
             <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
                <DocModal 
                   sessions={sessions}
                   onClose={() => setShowDocModal(false)} 
                   onSubmit={handleAddDocRequirement} 
                />
             </div>
          )}
       </AnimatePresence>
    </DashboardLayout>
  );
}

function DocModal({ sessions, onClose, onSubmit }) {
   const [form, setForm] = useState({ title: '', description: '', session_id: '' });
   return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="ios-card w-full max-w-lg !p-12 space-y-8">
         <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Submission Protocol</h3>
         <div className="space-y-4">
            <input placeholder="Requirement Title (e.g. BMC Canvas)" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <textarea placeholder="Instructional Commentary..." className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none min-h-[100px]" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            <select className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none" value={form.session_id} onChange={e => setForm({...form, session_id: e.target.value})}>
               <option value="">Link to Session/Topic (Optional)...</option>
               {sessions.map(s => <option key={s.id} value={s.id} className="bg-[#080810]">{s.title}</option>)}
            </select>
         </div>
         <div className="flex gap-4 mt-8">
            <button onClick={onClose} className="flex-1 btn-ghost">Cancel</button>
            <button onClick={() => onSubmit(form)} className="flex-1 btn-prime bg-emerald-600">Secure Protocol</button>
         </div>
      </motion.div>
   );
}

function MessageModal({ recipient, onClose, onSubmit }) {
   const [subject, setSubject] = useState('');
   const [body, setBody] = useState('');
   return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="ios-card w-full max-w-lg !p-12 space-y-8">
         <div>
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Comms Link</h3>
            <p className="text-[10px] font-black text-[#0066FF] uppercase tracking-widest mt-2 italic">
               To: {recipient === 'all' ? 'All Program Participants' : recipient.name}
            </p>
         </div>
         <div className="space-y-4">
            <input placeholder="Subject (e.g. Critical Program Update)" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none" value={subject} onChange={e => setSubject(e.target.value)} />
            <textarea placeholder="Message Body..." className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none min-h-[150px]" value={body} onChange={e => setBody(e.target.value)} />
         </div>
         <div className="flex gap-4 mt-8">
            <button onClick={onClose} className="flex-1 btn-ghost">Cancel</button>
            <button onClick={() => onSubmit(subject, body, recipient)} className="flex-1 btn-prime bg-[#0066FF]">Broadcast Node</button>
         </div>
      </motion.div>
   );
}

function TeamModal({ staff, onClose, onSubmit }) {
   const [name, setName] = useState('');
   const [handlerId, setHandlerId] = useState('');
   return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="ios-card w-full max-w-lg !p-12 space-y-8">
         <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Team Node Creation</h3>
         <div className="space-y-4">
            <input placeholder="Team Name (e.g. Squad Alpha)" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none" value={name} onChange={e => setName(e.target.value)} />
            <select className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none" value={handlerId} onChange={e => setHandlerId(e.target.value)}>
               <option value="">Select Handler (Staff)...</option>
               {staff.map(s => <option key={s.cid} value={s.cid} className="bg-[#080810]">{s.name}</option>)}
            </select>
         </div>
         <div className="flex gap-4 mt-8">
            <button onClick={onClose} className="flex-1 btn-ghost">Cancel</button>
            <button onClick={() => onSubmit(name, handlerId)} className="flex-1 btn-prime">Create Node</button>
         </div>
      </motion.div>
   );
}

function EventModal({ onClose, onSubmit }) {
   const [form, setForm] = useState({ title: '', description: '', event_type: 'meeting', start_time: '', location: '' });
   return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="ios-card w-full max-w-lg !p-12 space-y-6">
         <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Event Protocol</h3>
         <input placeholder="Event Title" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white underline-none" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
         <textarea placeholder="Description" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none min-h-[100px]" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
         <div className="grid grid-cols-2 gap-4">
            <select className="bg-white/5 border border-white/10 p-4 rounded-xl text-white underline-none" value={form.event_type} onChange={e => setForm({...form, event_type: e.target.value})}>
               <option value="meeting">Meeting</option>
               <option value="masterclass">Masterclass</option>
               <option value="workshop">Workshop</option>
            </select>
            <input type="datetime-local" className="bg-white/5 border border-white/10 p-4 rounded-xl text-white underline-none" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} />
         </div>
         <input placeholder="Location / Link" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white underline-none" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
         <div className="flex gap-4 mt-8">
            <button onClick={onClose} className="flex-1 btn-ghost">Cancel</button>
            <button onClick={() => onSubmit(form)} className="flex-1 btn-prime">Schedule</button>
         </div>
      </motion.div>
   );
}

function KpiModal({ onClose, onSubmit }) {
   const [form, setForm] = useState({ title: '', target_value: '' });
   return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="ios-card w-full max-w-md !p-12 space-y-8">
         <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">KPI Baseline</h3>
         <div className="space-y-4">
            <input placeholder="Metric Title (e.g. Revenue Target)" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white underline-none" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <input placeholder="Target Value (e.g. $10,000)" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white underline-none" value={form.target_value} onChange={e => setForm({...form, target_value: e.target.value})} />
         </div>
         <div className="flex gap-4 mt-8">
            <button onClick={onClose} className="flex-1 btn-ghost">Cancel</button>
            <button onClick={() => onSubmit(form)} className="flex-1 btn-prime">Define Metric</button>
         </div>
      </motion.div>
   );
}
