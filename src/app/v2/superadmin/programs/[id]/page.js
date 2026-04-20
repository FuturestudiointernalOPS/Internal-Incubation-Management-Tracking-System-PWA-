'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  ChevronLeft, Plus, Trash2, Calendar, 
  Users, Layers, Settings, MessageSquare, 
  Globe, LayoutDashboard, Search, Filter,
  ArrowRight, Activity, Shield, Sparkles, Target, X, ChevronRight, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import TimelineEngine from '@/components/v2/TimelineEngine';
import BulkParticipantImporter from '@/components/v2/BulkParticipantImporter';

/**
 * OPERATIONS TERMINAL — VERSION 2
 * Central workspace for managing a specific program instance.
 */
export default function ProgramTerminalV2({ params }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  const router = useRouter();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview | sessions | staff | participants | settings
  const [program, setProgram] = useState(null);
  
  // Modals
  // Participants & Groups
  const [participants, setParticipants] = useState([]);
  const [groups, setGroups] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showDeliverableModal, setShowDeliverableModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showPmAssignmentModal, setShowPmAssignmentModal] = useState(false);
  const [showKnowledgeAssignmentModal, setShowKnowledgeAssignmentModal] = useState(false);
  
   const [sessions, setSessions] = useState([]);
  const [conceptNotes, setConceptNotes] = useState([]);
  const [contactsList, setContactsList] = useState([]);
  const [pmSearch, setPmSearch] = useState('');
  const [pmToEmail, setPmToEmail] = useState(null);

  useEffect(() => {
     const sa = localStorage.getItem('sa_session');
     if (sa !== 'prime-2026-active') {
       router.replace('/terminal');
       return;
     }
     fetchProgram();
     fetchSessions();
     fetchGroups();
     fetchDeliverables();
     fetchFeedback();
     fetchKnowledge();
     fetchContacts();
     fetchParticipants();
   }, [id, router]);

   const fetchKnowledge = async () => {
      try {
        const res = await fetch('/api/v2/knowledge');
        const data = await res.json();
        if (data.success) {
           setConceptNotes(data.conceptNotes || []);
        }
      } catch (err) {}
   };

  const fetchContacts = async () => {
     try {
       const res = await fetch('/api/contacts');
       const data = await res.json();
       if (data.success) {
          setContactsList(data.contacts || []);
       }
     } catch (err) {}
  };

  const fetchProgram = async () => {
    try {
      const res = await fetch('/api/v2/programs');
      const data = await res.json();
      const match = data.programs.find(p => p.id === id);
      setProgram(match);
      setIsLoaded(true);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSessions = async () => {
     try {
       const res = await fetch(`/api/v2/sessions?program_id=${id}`);
       const data = await res.json();
       if (data.success) {
          setSessions(data.sessions);
       }
     } catch (e) {
        console.error(e);
     }
  };

  const fetchParticipants = async () => {
     try {
       const res = await fetch(`/api/v2/participants?program_id=${id}`);
       const data = await res.json();
       if (data.success) {
          setParticipants(data.participants);
       }
     } catch (e) {
        console.error(e);
     }
  };

  const fetchGroups = async () => {
     try {
       const res = await fetch(`/api/v2/groups?program_id=${id}`);
       const data = await res.json();
       if (data.success) {
          setGroups(data.groups);
       }
     } catch (e) {
        console.error(e);
     }
  };

  const fetchDeliverables = async () => {
     try {
       const res = await fetch(`/api/v2/deliverables?program_id=${id}`);
       const data = await res.json();
       if (data.success) {
          setDeliverables(data.deliverables);
       }
     } catch (e) {
        console.error(e);
     }
  };

  const fetchFeedback = async () => {
     try {
       const res = await fetch(`/api/v2/feedback?program_id=${id}`);
       const data = await res.json();
       if (data.success) {
          setFeedback(data.feedback);
       }
     } catch (e) { console.error(e); }
  };

  const [newDeliverable, setNewDeliverable] = useState({ title: '', description: '', week_number: 1, type: 'Group' });

  const handleCreateDeliverable = async () => {
     try {
       const res = await fetch('/api/v2/deliverables', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newDeliverable, program_id: id })
       });
       const data = await res.json();
       if (data.success) {
          setDeliverables([...deliverables, data.deliverable]);
          setShowDeliverableModal(false);
          setNewDeliverable({ title: '', description: '', week_number: 1, type: 'Group' });
       }
     } catch (e) {
        alert("Deliverable creation failed.");
     }
  };

  const handleCreateSession = async () => {
    try {
      const res = await fetch('/api/v2/sessions', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ ...newSession, program_id: id })
      });
      const data = await res.json();
      if (data.success) {
         setSessions([...sessions, data.session]);
         setShowSessionModal(false);
         setNewSession({ title: '', week_number: 1, type: 'Masterclass', start_at: '' });
      }
    } catch (e) {
       alert("Scheduling failed.");
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
          setNewParticipant({ name: '', email: '', phone: '', screening_status: 'applied' });
       }
     } catch (e) {
        alert("Addition failed.");
     }
  };

  const handleCreateGroup = async () => {
     try {
       const res = await fetch('/api/v2/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newGroup, program_id: id })
       });
       const data = await res.json();
       if (data.success) {
          setGroups([...groups, data.group]);
          setShowGroupModal(false);
          setNewGroup({ name: '', project_description: '' });
       }
     } catch (e) {
        alert("Group creation failed.");
     }
  };

  const handleToggleFeedback = async () => {
     const status = !program.feedback_enabled;
     try {
       // Mock patch or handle in backend as needed
       setProgram({ ...program, feedback_enabled: status });
       alert(`Lifecycle Pulse Collection ${status ? 'Activated' : 'Suspended'}.`);
     } catch (e) { alert("Toggle failed."); }
  };

  const handleDeployProject = async () => {
     const name = prompt("Enter Project Instance Name (e.g., Venture Cohort Alpha)");
     if (!name) return;

     try {
       const res = await fetch('/api/v2/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, program_id: id, status: 'Active' })
       });
       const data = await res.json();
       if (data.success) {
          alert("Project node successfully anchored to program.");
          // Update overview if needed
       }
     } catch (e) {
        alert("Deployment failed.");
     }
  };

  if (!isLoaded || !program) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  const SessionModal = () => (
     <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="ios-card w-full max-w-lg !p-12 space-y-10"
        >
           <div>
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Blueprint Scheduling</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Define an executable masterclass or workshop.</p>
           </div>
           
           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Session Title</label>
                 <input 
                   type="text" 
                   value={newSession.title}
                   onChange={e => setNewSession({...newSession, title: e.target.value})}
                   className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold"
                 />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Week Index</label>
                    <input 
                      type="number" 
                      value={newSession.week_number}
                      onChange={e => setNewSession({...newSession, week_number: e.target.value})}
                      className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Type</label>
                    <select 
                      value={newSession.type}
                      onChange={e => setNewSession({...newSession, type: e.target.value})}
                      className="w-full bg-[#121220] border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold appearance-none"
                    >
                       <option value="Masterclass">Masterclass</option>
                       <option value="Workshop">Workshop</option>
                       <option value="Review">Review Session</option>
                    </select>
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Assigned Staff (Node ID)</label>
                 <input 
                   type="text" 
                   value={newSession.teacher_id || ''}
                   onChange={e => setNewSession({...newSession, teacher_id: e.target.value})}
                   placeholder="e.g., T-2026-X"
                   className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold"
                 />
              </div>
           </div>

           <div className="flex gap-4 pt-6">
              <button 
                 onClick={() => setShowSessionModal(false)}
                 className="flex-1 btn-ghost !py-4"
              >
                 Cancel Node
              </button>
              <button 
                 onClick={handleCreateSession}
                 className="flex-1 btn-prime !py-4"
              >
                 Confirm Node
              </button>
           </div>
        </motion.div>
     </div>
  );

  const ParticipantModal = () => (
     <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="ios-card w-full max-w-2xl !p-12 space-y-10"
        >
           <div className="flex justify-between items-start">
              <div>
                 <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Onboard Participant</h3>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Add specific records to this lifecycle.</p>
              </div>
              <button 
                 onClick={() => setShowParticipantModal(false)}
                 className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-600 hover:text-white transition-colors"
              >
                 <Trash2 className="w-5 h-5" />
              </button>
           </div>
           
           <nav className="flex items-center gap-8 border-b border-white/5 pb-0">
              {['Manual Node', 'Bulk Sync'].map(tab => (
                 <button 
                    key={tab}
                    onClick={() => {
                       // We can handle local tab state if needed
                    }}
                    className="py-4 text-[9px] font-black uppercase tracking-widest text-indigo-400 border-b-2 border-indigo-500"
                 >
                    {tab}
                 </button>
              ))}
           </nav>

           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Email Identity</label>
                    <input 
                      type="email" 
                      value={newParticipant.email}
                      onChange={e => setNewParticipant({...newParticipant, email: e.target.value})}
                      className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold"
                    />
                 </div>
              </div>

              <div className="h-px w-full bg-white/5 my-8" />
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">--- OR ---</p>
              
              <BulkParticipantImporter 
                 programId={id} 
                 onComplete={() => {
                    fetchParticipants();
                    setShowParticipantModal(false);
                 }} 
              />
           </div>

           <div className="flex gap-4 pt-6">
              <button 
                 onClick={handleAddParticipant}
                 className="w-full btn-prime !py-4"
              >
                 Confirm Onboarding
              </button>
           </div>
        </motion.div>
     </div>
  );

  const GroupModal = () => (
     <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="ios-card w-full max-w-lg !p-12 space-y-10"
        >
           <div>
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Form Team</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Initialize a new venture group node.</p>
           </div>
           
           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Team Name</label>
                 <input 
                   type="text" 
                   value={newGroup.name}
                   onChange={e => setNewGroup({...newGroup, name: e.target.value})}
                   className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Concept Description</label>
                 <textarea 
                   rows={3}
                   value={newGroup.project_description}
                   onChange={e => setNewGroup({...newGroup, project_description: e.target.value})}
                   className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold resize-none"
                 />
              </div>
           </div>

           <div className="flex gap-4 pt-6">
              <button 
                 onClick={() => setShowGroupModal(false)}
                 className="flex-1 btn-ghost !py-4"
              >
                 Cancel
              </button>
              <button 
                 onClick={handleCreateGroup}
                 className="flex-1 btn-prime !py-4"
              >
                 Establish Team
              </button>
           </div>
        </motion.div>
     </div>
  );

  const DeliverableModal = () => (
     <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
        <motion.div 
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="ios-card w-full max-w-lg !p-12 space-y-10"
        >
           <div>
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Define Deliverable</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Map an evaluation node to a lifecycle week.</p>
           </div>
           
           <div className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Title</label>
                 <input 
                   type="text" 
                   value={newDeliverable.title}
                   onChange={e => setNewDeliverable({...newDeliverable, title: e.target.value})}
                   className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold"
                 />
              </div>
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Week Index</label>
                    <input 
                      type="number" 
                      value={newDeliverable.week_number}
                      onChange={e => setNewDeliverable({...newDeliverable, week_number: e.target.value})}
                      className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-2">Submission Mode</label>
                    <select 
                      value={newDeliverable.type}
                      onChange={e => setNewDeliverable({...newDeliverable, type: e.target.value})}
                      className="w-full bg-[#121220] border border-white/5 rounded-xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 font-bold appearance-none"
                    >
                       <option value="Group">Group Unit</option>
                       <option value="Individual">Individual Node</option>
                    </select>
                 </div>
              </div>
           </div>

           <div className="flex gap-4 pt-6">
              <button 
                 onClick={() => setShowDeliverableModal(false)}
                 className="flex-1 btn-ghost !py-4"
              >
                 Cancel
              </button>
              <button 
                 onClick={handleCreateDeliverable}
                 className="flex-1 btn-prime !py-4"
              >
                 Sync Node
              </button>
           </div>
        </motion.div>
     </div>
  );

  const filteredPMs = contactsList.filter(c => c.name.toLowerCase().includes(pmSearch.toLowerCase()) || (c.email && c.email.toLowerCase().includes(pmSearch.toLowerCase())));

  const handleAssignPM = async (pm) => {
     try {
       const res = await fetch('/api/v2/programs', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ id: program.id, manager_name: pm.name, assigned_pm_id: pm.cid })
       });
       const data = await res.json();
       
       if (data.success) {
         setProgram({ ...program, manager_name: pm.name, assigned_pm_id: pm.cid });
         setShowPmAssignmentModal(false);
         setPmToEmail(pm); // Triggers email popup
         window.dispatchEvent(new CustomEvent('impactos:notify', { 
             detail: { type: 'success', message: `${pm.name} assigned to execution.` } 
         }));
       } else {
         window.dispatchEvent(new CustomEvent('impactos:notify', { 
             detail: { type: 'error', message: data.error } 
         }));
       }
     } catch(e) {
        console.error(e);
     }
  };

  const handleAssignKnowledge = async (note) => {
     try {
       const res = await fetch('/api/v2/programs', {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ id: program.id, document_title: note.title, document_id: note.id })
       });
       const data = await res.json();
       
       if (data.success) {
         setProgram({ ...program, document_title: note.title, document_id: note.id });
         setShowKnowledgeAssignmentModal(false);
         window.dispatchEvent(new CustomEvent('impactos:notify', { 
             detail: { type: 'success', message: `Knowledge Document anchored to this Program.` } 
         }));
       } else {
         window.dispatchEvent(new CustomEvent('impactos:notify', { 
             detail: { type: 'error', message: data.error } 
         }));
       }
     } catch(e) {
        console.error(e);
     }
  };

  const PmAssignmentModal = () => (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
         <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ios-card w-full max-w-lg !p-12 space-y-8"
         >
            <div className="flex justify-between items-start border-b border-white/5 pb-4">
               <div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Delegate Authority</h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Assign the PM who will manage this program.</p>
               </div>
               <button onClick={() => setShowPmAssignmentModal(false)} className="text-slate-600 hover:text-white"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
               <input 
                 type="text" 
                 placeholder="Search contacts by name or email..." 
                 value={pmSearch}
                 onChange={e => setPmSearch(e.target.value)}
                 className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-6 text-white outline-none focus:border-indigo-500/50 font-bold"
               />
            </div>

            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
               {filteredPMs.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 font-bold py-10 uppercase tracking-widest">No staff found.</p>
               ) : (
                 filteredPMs.map(pm => (
                    <div 
                       key={pm.cid}
                       onClick={() => handleAssignPM(pm)}
                       className="p-6 rounded-2xl border bg-white/[0.02] border-white/5 hover:border-indigo-500/50 hover:bg-indigo-500/10 cursor-pointer transition-all flex items-center justify-between group"
                    >
                       <div>
                         <p className="font-black text-white uppercase tracking-tighter">{pm.name}</p>
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{pm.email}</p>
                       </div>
                       <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </div>
                 ))
               )}
            </div>
         </motion.div>
      </div>
  );

  const EmailDispatchModal = () => (
      <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
         <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="ios-card w-full max-w-md !p-12 space-y-8 text-center"
         >
            <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
               <Mail className="w-10 h-10 text-indigo-400" />
            </div>
            <div>
               <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Send Dispatch</h3>
               <p className="text-xs font-bold text-slate-400 leading-relaxed">
                  You have anchored <span className="text-white uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded ml-1 mr-1">{pmToEmail?.name}</span>
                  to this framework.
               </p>
            </div>
            <div className="bg-white/5 border border-white/5 p-6 rounded-2xl text-left space-y-4">
               <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Target Identity</p>
                  <p className="text-sm font-black text-white">{pmToEmail?.email || 'No email securely attached'}</p>
               </div>
               <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Payload Envelope</p>
                  <p className="text-[10px] font-bold text-slate-400 bg-black/20 p-3 rounded-lg border border-black/50">
                     Automatically transmits dashboard login URL, uniquely generated password credentials, and primary brief directives.
                  </p>
               </div>
            </div>
            <div className="flex gap-4 pt-4">
               <button 
                  onClick={() => setPmToEmail(null)}
                  className="flex-1 btn-ghost !py-4"
               >
                  Skip
               </button>
               <button 
                  onClick={() => {
                     // Trigger simulated email logic
                     window.dispatchEvent(new CustomEvent('impactos:notify', { 
                        detail: { type: 'success', message: `Secure Email sent to ${pmToEmail.name}.` } 
                     }));
                     setPmToEmail(null);
                  }}
                  className="flex-1 btn-prime !py-4 shadow-indigo-600/20"
               >
                  Dispatch Email
               </button>
            </div>
         </motion.div>
      </div>
  );

  const KnowledgeAssignmentModal = () => (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
         <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="ios-card w-full max-w-xl !p-12 space-y-10"
         >
            <div className="flex justify-between items-start border-b border-white/5 pb-6">
               <div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Attach Baseline</h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Force the PM to construct from this document.</p>
               </div>
               <button onClick={() => setShowKnowledgeAssignmentModal(false)} className="text-slate-600 hover:text-white"><X className="w-6 h-6"/></button>
            </div>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
               {conceptNotes.length === 0 ? (
                  <p className="text-center text-xs font-bold text-slate-500 uppercase py-10">No documents found in Knowledge Bank.</p>
               ) : (
                  conceptNotes.map(note => (
                     <div 
                        key={note.id}
                        onClick={() => handleAssignKnowledge(note)}
                        className="p-6 rounded-2xl border bg-white/[0.02] border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/10 cursor-pointer transition-all"
                     >
                        <p className="font-black text-white uppercase tracking-tighter text-lg leading-none">{note.title}</p>
                        <p className="text-[10px] font-black text-slate-400 mt-2 line-clamp-2">{note.description}</p>
                     </div>
                  ))
               )}
            </div>
         </motion.div>
      </div>
  );

  return (
    <DashboardLayout 
        role="super_admin" 
        activeTab="v2" 
        modals={
          <>
            {showSessionModal && <SessionModal />}
            {showParticipantModal && <ParticipantModal />}
            {showGroupModal && <GroupModal />}
            {showDeliverableModal && <DeliverableModal />}
            {showPmAssignmentModal && <PmAssignmentModal />}
            {showKnowledgeAssignmentModal && <KnowledgeAssignmentModal />}
            {pmToEmail && <EmailDispatchModal />}
          </>
        }
    >
      <div className="space-y-12">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-10 border-b border-white/5 pb-10">
          <div className="animation-reveal">
            <button 
              onClick={() => router.push('/v2/superadmin')}
              className="btn-ghost !py-2 !px-4 hover:bg-white/5 mb-6"
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> HQ Registry
            </button>
            <div className="flex items-center gap-4 mb-4">
               <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Operations Terminal</span>
               <div className="h-px w-10 bg-indigo-500/30" />
               <button 
                  onClick={handleDeployProject}
                  className="badge badge-glow-success uppercase text-[8px] font-black hover:scale-105 transition-transform cursor-pointer"
               >
                  DEPOY PROJECT INSTANCE
               </button>
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">
              {program.name}
            </h2>
            <p className="text-slate-500 font-bold mt-4 opacity-70 max-w-2xl">{program.description || 'No description provided.'}</p>
          </div>
          
          <div className="flex flex-wrap gap-4 pt-10">
             <div 
                onClick={() => setShowPmAssignmentModal(true)}
                className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 px-8 text-left cursor-pointer hover:bg-indigo-500/20 group transition-all"
             >
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 flex items-center justify-between">Assigned PM <span className="opacity-0 group-hover:opacity-100 transition-opacity">Assign +</span></p>
                <p className="text-xl font-black text-white uppercase tracking-tighter">{program.manager_name || 'Unassigned'}</p>
             </div>
             <div 
                onClick={() => setShowKnowledgeAssignmentModal(true)}
                className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-8 text-left cursor-pointer hover:bg-emerald-500/20 group transition-all"
             >
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center justify-between">Baseline Document <span className="opacity-0 group-hover:opacity-100 transition-opacity">Assign +</span></p>
                <p className="text-xl font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{program.document_title || 'Unassigned'}</p>
             </div>
          </div>
        </header>

        {/* COMPONENT NAVIGATION */}
        <nav className="flex items-center gap-8 border-b border-white/5 pb-0 overflow-x-auto">
           {['overview', 'sessions', 'participants', 'groups', 'staff', 'feedback'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-6 text-[11px] font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === tab ? 'text-indigo-400' : 'text-slate-500 hover:text-white'}`}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div 
                    layoutId="activeTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 rounded-t-full shadow-[0_0_15px_rgba(99,102,241,1)]" 
                  />
                )}
              </button>
           ))}
        </nav>

        <motion.div 
           key={activeTab}
           initial={{ opacity: 0, x: 10 }}
           animate={{ opacity: 1, x: 0 }}
           className="min-h-[400px]"
        >
           {/* TAB DEFINITIONS */}
           {activeTab === 'overview' && (
              <TimelineEngine program={program} sessions={sessions} />
           )}

           {activeTab === 'sessions' && (
              <div className="space-y-12">
                 <div className="flex justify-between items-center">
                    <div>
                       <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Curriculum Architecture</h3>
                       <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Masterclasses and Evaluation Nodes.</p>
                    </div>
                    <div className="flex gap-4">
                       <button 
                          onClick={() => setShowDeliverableModal(true)}
                          className="btn-ghost !font-black !text-[10px] !uppercase !tracking-widest"
                       >
                          + Add Deliverable
                       </button>
                       <button 
                          onClick={() => setShowSessionModal(true)}
                          className="btn-prime !py-4 px-8"
                       >
                          <Plus className="w-5 h-5 mr-2" /> Schedule Session
                       </button>
                    </div>
                 </div>

                 <div className="space-y-8">
                    {Array.from({ length: program.duration_weeks || 13 }, (_, i) => i + 1).map(week => {
                       const weekSessions = sessions.filter(s => s.week_number === week);
                       const weekDeliverables = deliverables.filter(d => d.week_number === week);
                       
                       return (
                          <div key={week} className="ios-card bg-white/[0.01] border-white/5 !p-8">
                             <div className="flex items-center gap-6 mb-8">
                                <span className="text-4xl font-black text-slate-800 italic">W{week}</span>
                                <div className="h-px flex-1 bg-white/5" />
                             </div>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Sessions</p>
                                   {weekSessions.length > 0 ? weekSessions.map(s => (
                                      <div key={s.id} className="flex items-center gap-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                         <Calendar className="w-4 h-4 text-indigo-400" />
                                         <span className="text-xs font-bold text-white uppercase">{s.title}</span>
                                         <span className="badge badge-glow-indigo text-[7px] font-black uppercase ml-auto">{s.type}</span>
                                      </div>
                                   )) : <p className="text-[10px] text-slate-700 font-bold italic pl-2">No sessions scheduled.</p>}
                                </div>
                                <div className="space-y-4">
                                   <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Evaluations</p>
                                   {weekDeliverables.length > 0 ? weekDeliverables.map(d => (
                                      <div key={d.id} className="flex items-center gap-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                         <Target className="w-4 h-4 text-emerald-400" />
                                         <span className="text-xs font-bold text-white uppercase">{d.title}</span>
                                         <span className="badge badge-glow-success text-[7px] font-black uppercase ml-auto">{d.type}</span>
                                      </div>
                                   )) : <p className="text-[10px] text-slate-700 font-bold italic pl-2">No deliverables defined.</p>}
                                </div>
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>
           )}

           {activeTab === 'participants' && (
              <div className="space-y-8">
                 <div className="flex justify-between items-center">
                    <div>
                       <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Participant Roster</h3>
                       <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Manage registration and screening status.</p>
                    </div>
                    <div className="flex gap-4">
                       <button 
                          onClick={() => setShowParticipantModal(true)}
                          className="btn-prime !py-4 px-8"
                       >
                          <Plus className="w-5 h-5 mr-2" /> Add Record
                       </button>
                    </div>
                 </div>

                 {participants.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-white/5 rounded-[3rem]">
                       <Users className="w-16 h-16 text-slate-800 mb-6" />
                       <p className="text-slate-600 font-bold max-w-xs text-center mx-auto">No participants onboarded yet. Use &apos;Add Record&apos; or start a bulk import.</p>
                    </div>
                 ) : (
                    <div className="ios-card !p-0 overflow-hidden">
                       <table className="executive-table">
                          <thead>
                             <tr>
                                {['Name', 'Email', 'Screening', 'Status', 'Actions'].map(h => (
                                   <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">{h}</th>
                                ))}
                             </tr>
                          </thead>
                          <tbody>
                             {participants.map(p => (
                                <tr key={p.id}>
                                   <td className="px-8 py-6 font-black text-white uppercase tracking-tighter">{p.name}</td>
                                   <td className="px-8 py-6 text-slate-400 font-bold">{p.email}</td>
                                   <td className="px-8 py-6 uppercase font-black text-[10px] text-indigo-400">{p.screening_status}</td>
                                   <td className="px-8 py-6 uppercase font-black text-[10px] text-emerald-400">{p.status}</td>
                                   <td className="px-8 py-6 text-right">
                                      <button className="text-slate-600 hover:text-white transition-colors"><Settings className="w-4 h-4" /></button>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 )}
              </div>
           )}

           {activeTab === 'groups' && (
              <div className="space-y-8">
                 <div className="flex justify-between items-center">
                    <div>
                       <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Venture Groups</h3>
                       <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Teams and project nodes within this program.</p>
                    </div>
                    <button 
                       onClick={() => setShowGroupModal(true)}
                       className="btn-prime !py-4 px-8"
                    >
                       <Plus className="w-5 h-5 mr-2" /> Form Team
                    </button>
                 </div>

                 {groups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-white/5 rounded-[3rem]">
                       <Layers className="w-16 h-16 text-slate-800 mb-6" />
                       <p className="text-slate-600 font-bold max-w-xs text-center mx-auto">No teams formed yet. Click &apos;Form Team&apos; to initialize a new venture node.</p>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {groups.map((group) => (
                          <div 
                             key={group.id} 
                             onClick={() => router.push(`/v2/superadmin/programs/${id}/groups/${group.id}`)}
                             className="ios-card bg-white/[0.02] border-white/5 p-8 group cursor-pointer hover:border-indigo-500/30 transition-all hover:bg-white/5"
                          >
                             <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">{group.name}</h4>
                             <p className="text-xs text-slate-500 font-bold line-clamp-2 mb-6">{group.project_description || 'No description provided.'}</p>
                             <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Workspace</span>
                                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:translate-x-1 transition-transform" />
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           )}

           {activeTab === 'staff' && (
              <div className="space-y-8">
                 <div className="flex justify-between items-center">
                    <div>
                       <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Internal Assets</h3>
                       <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Assigned Project Managers and Instructors.</p>
                    </div>
                    <button className="btn-prime !py-4 px-8"><Plus className="w-5 h-5 mr-2" /> Assign Personnel</button>
                 </div>

                 <div className="py-40 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                    <Shield className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                    <p className="text-slate-600 font-bold max-w-xs mx-auto">Project Managers assigned in the v1 dashboard will appear here as the bridge to Version 2 execution.</p>
                 </div>
              </div>
           )}

           {activeTab === 'feedback' && (
              <div className="space-y-8">
                 <div className="flex justify-between items-center">
                    <div>
                       <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Pulse Check HQ</h3>
                       <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Weekly feedback and sentiment analysis.</p>
                    </div>
                    <div className="flex items-center gap-6">
                       <span className={`text-[9px] font-black uppercase tracking-widest ${program.feedback_enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {program.feedback_enabled ? 'COLLECTING' : 'SUSPENDED'}
                       </span>
                       <button 
                          onClick={handleToggleFeedback}
                          className={`w-12 h-6 rounded-full relative transition-colors bg-white/5 border border-white/10 ${program.feedback_enabled ? 'bg-indigo-500/20' : ''}`}
                       >
                          <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${program.feedback_enabled ? 'right-1 bg-indigo-400' : 'left-1 bg-slate-700'}`} />
                       </button>
                    </div>
                 </div>

                 {feedback.length === 0 ? (
                    <div className="py-40 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                       <MessageSquare className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                       <p className="text-slate-600 font-bold max-w-xs mx-auto">Pulse check is currently {program.feedback_enabled ? 'awaiting entries' : 'suspended'}.</p>
                    </div>
                 ) : (
                    <div className="space-y-6">
                       {feedback.map((f, i) => (
                          <div key={i} className="ios-card bg-white/[0.02] border-white/5 !p-8">
                             <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-xs italic">FS</div>
                                   <div>
                                      <p className="text-xs font-black text-white uppercase tracking-tighter">{f.v2_groups?.name || f.v2_participants?.name}</p>
                                      <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Origin Point</p>
                                   </div>
                                </div>
                                <span className="text-[8px] font-black text-slate-700 bg-white/5 px-2 py-0.5 rounded uppercase tracking-widest">{new Date(f.created_at).toLocaleDateString()}</span>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-2">
                                   <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Learnings</p>
                                   <p className="text-[11px] font-bold text-slate-400 leading-relaxed">{f.learnings}</p>
                                </div>
                                <div className="space-y-2">
                                   <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Challenges</p>
                                   <p className="text-[11px] font-bold text-slate-400 leading-relaxed">{f.challenges}</p>
                                </div>
                                <div className="space-y-2">
                                   <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Suggestions</p>
                                   <p className="text-[11px] font-bold text-slate-400 leading-relaxed">{f.suggestions}</p>
                                </div>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
