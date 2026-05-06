'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Clock, FileText, Download, 
  Send, Layers, Layout, Target, 
  ChevronRight, BookOpen, MessageSquare, 
  Plus, AlertCircle, ExternalLink, Activity, Zap, X, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';

const t = {
  en: {
    progress: "Your Progress",
    curriculum: "Curriculum",
    statusReports: "Status Reports",
    submitWork: "Submit Work",
    material: "Material",
    report: "Submission Report",
    save: "Save",
    target: "Program Target"
  },
  fr: {
    progress: "Votre Progression",
    curriculum: "Curriculum",
    statusReports: "Rapports d'État",
    submitWork: "Soumettre le Travail",
    material: "Matériel",
    report: "Rapport de Soumission",
    save: "Sauvegarder",
    target: "Objectif du Programme"
  }
};


export default function ParticipantDashboard() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState({});
  const [participantState, setParticipantState] = useState({
    program: null,
    submissions: [],
    sessions: [],
    notifications: [],
    kpis: [],
    documents: [],
    followups: []
  });
  const [activeSession, setActiveSession] = useState(null);
  const [report, setReport] = useState('');
  const [submissionValue, setSubmissionValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [isMessaging, setIsMessaging] = useState(false);
  const [signalData, setSignalData] = useState({ subject: '', body: '' });
  const [isSendingSignal, setIsSendingSignal] = useState(false);
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('impactos-lang') || 'en');
    window.addEventListener('impactos:languageChange', handleLangChange);
    handleLangChange();
    return () => window.removeEventListener('impactos:languageChange', handleLangChange);
  }, []);

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(sessionUser);
    if (sessionUser.cid || sessionUser.id) {
       fetchData(sessionUser.cid || sessionUser.id);
    }
  }, []);

  const fetchData = async (cid) => {
    try {
      const res = await fetch(`/api/v2/participant/full-state?cid=${cid}`); 
      const data = await res.json();
      if (data.success) {
        setParticipantState({
          program: data.program,
          submissions: data.submissions || [],
          sessions: data.sessions || [],
          notifications: data.notifications || [],
          kpis: data.kpis || [],
          documents: data.documents || [],
          followups: data.followups || []
        });
      }
      setIsLoaded(true);
    } catch (e) { console.error(e); setIsLoaded(true); }
  };


   const validateSubmission = () => {
    const format = activeSession?.allowed_format?.toLowerCase() || 'plain text';
    if (format === 'link' || format === 'url') {
      const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
      if (!urlPattern.test(submissionValue)) {
        setValidationError('ERROR: VALID URL PROTOCOL REQUIRED (e.g. https://...)');
        return false;
      }
    }
    if (!submissionValue && format !== 'plain text') {
      setValidationError(`ERROR: ${format.toUpperCase()} CONTENT REQUIRED`);
      return false;
    }
    return true;
  };

  const handleSubmit = async (reqId, progId) => {
    if (!validateSubmission()) return;
    setIsSubmitting(true);
    setValidationError('');

    try {
      const res = await fetch('/api/v2/participant/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: user.cid || user.id,
          team_id: user.role === 'team' ? user.id : null,
          program_id: progId,
          requirement_id: reqId,
          report_body: report,
          file_url: submissionValue
        })
      });
      if ((await res.json()).success) {
        setReport('');
        setSubmissionValue('');
        setActiveSession(null);
        fetchData(user.cid || user.id);
      }
    } catch (e) {}
    setIsSubmitting(false);
  };

  const handleSendSignal = async () => {
    if (!signalData.body) return;
    setIsSendingSignal(true);
    try {
      const res = await fetch('/api/v2/internal-comms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: user.cid || user.id,
          sender_role: 'participant',
          target_role: 'pm',
          subject: signalData.subject || 'Clarification Request',
          message: signalData.body,
          program_id: participantState.program?.id
        })
      });
      if ((await res.json()).success) {
        setIsMessaging(false);
        setSignalData({ subject: '', body: '' });
      }
    } catch (e) { console.error(e); }
    setIsSendingSignal(false);
  };

  const calculateProgress = () => {
    const { sessions, submissions } = participantState;
    if (sessions.length === 0) return 0;
    
    // Each session has requirements. If there's a submission for a session, it's considered progress.
    const completedSessions = sessions.filter(ses => 
      submissions.some(sub => sub.requirement_id === ses.id && sub.status === 'reviewed')
    ).length;
    
    return Math.min(100, Math.round((completedSessions / sessions.length) * 100));
  };


  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="space-y-12 pb-20">
        
        {/* TACTICAL HUD */}
        <header className="relative overflow-hidden bg-[#0d0d18] border border-white/5 p-12 rounded-[3rem] shadow-2xl group">
           <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF6600]/5 blur-[120px] -z-1 group-hover:bg-[#FF6600]/10 transition-all duration-1000" />
           <div className="flex flex-col lg:flex-row justify-between items-center gap-12 relative z-10">
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#FF6600]/10 rounded-2xl">
                       <Target className="w-6 h-6 text-[#FF6600]" />
                    </div>
                    <div>
                       <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.4em]">{user.role === 'team' ? 'Unit Mission Control' : 'Strategic Progress'}</span>
                       <h1 className="text-5xl lg:text-7xl font-black text-white tracking-tighter uppercase italic leading-none mt-1">
                          {participantState.program?.name || 'Active Mission'}
                       </h1>
                    </div>
                 </div>
                 <p className="text-slate-500 font-bold max-w-xl text-lg leading-relaxed italic opacity-80">
                    Welcome back, <span className="text-white">{user.name}</span>. Your current objective is to complete the phase milestones to reach 100% operational readiness.
                 </p>
                 <div className="flex flex-wrap gap-4 pt-4">
                    {user.permission !== 'read' && (
                       <button onClick={() => setIsMessaging(true)} className="px-10 py-5 bg-[#FF6600] text-black font-black uppercase text-[11px] tracking-widest rounded-[2rem] hover:bg-white transition-all shadow-2xl shadow-[#FF6600]/20 flex items-center gap-4 italic group/btn">
                          <Zap className="w-5 h-5 group-hover/btn:animate-pulse" /> Signal Command
                       </button>
                    )}
                    <div className="flex items-center gap-4 px-8 py-5 bg-white/5 rounded-[2rem] border border-white/5">
                       <div className={`w-2 h-2 rounded-full ${user.permission === 'read' ? 'bg-amber-500' : 'bg-emerald-500 animate-ping'}`} />
                       <span className="text-[10px] font-black text-white uppercase tracking-widest italic">
                          {user.permission === 'read' ? 'Secure Observer Mode' : 'System Online'}: {user.is_entity ? user.name : (participantState.team_name || 'Individual Profile')}
                       </span>
                    </div>
                 </div>

              </div>

              <div className="relative w-64 h-64 flex items-center justify-center">
                 <svg className="w-full h-full transform -rotate-90">
                    <circle cx="128" cy="128" r="110" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-white/5" />
                    <circle 
                       cx="128" cy="128" r="110" 
                       fill="transparent" 
                       stroke="currentColor" 
                       strokeWidth="12" 
                       className="text-[#FF6600]" 
                       strokeDasharray={691} 
                       strokeDashoffset={691 - (691 * calculateProgress() / 100)} 
                       strokeLinecap="round"
                    />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-6xl font-black text-white italic tracking-tighter">{calculateProgress()}%</span>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Operational</span>
                 </div>
              </div>
           </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
           
           {/* LEFT: MISSION TIMELINE (8 COLS) */}
           <div className="xl:col-span-8 space-y-10">
              <div className="flex items-center justify-between">
                 <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter flex items-center gap-4">
                    <Layers className="w-6 h-6 text-[#FF6600]" /> Tactical Timeline
                 </h3>
                 <div className="flex gap-2">
                    <span className="badge badge-glow-blue uppercase text-[8px] font-black italic">{participantState.sessions.length} Nodes</span>
                    <span className="badge badge-glow-orange uppercase text-[8px] font-black italic">Active Phase</span>
                 </div>
              </div>

              <div className="space-y-12 relative before:absolute before:left-8 before:top-10 before:bottom-10 before:w-px before:bg-white/5">
                 {participantState.sessions.map((session, idx) => {
                    const submission = participantState.submissions.find(s => s.requirement_id === session.id);
                    const isCompleted = submission?.status === 'reviewed';
                    const isPending = submission && submission.status !== 'reviewed';
                    
                    return (
                       <motion.div 
                          key={session.id} 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="relative pl-24 group"
                       >
                          {/* Timeline Pin */}
                          <div className={`absolute left-4 top-0 w-8 h-8 rounded-full border-4 flex items-center justify-center transition-all z-10 ${isCompleted ? 'bg-[#FF6600] border-[#FF6600]/20 text-black shadow-[0_0_20px_rgba(255,102,0,0.4)]' : isPending ? 'bg-blue-500 border-blue-500/20 text-white' : 'bg-[#0d0d18] border-white/10 text-slate-700 group-hover:border-[#FF6600]/40'}`}>
                             {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[10px] font-black italic">{idx + 1}</span>}
                          </div>

                          <div className="ios-card bg-white/[0.01] border-white/5 p-8 group-hover:bg-white/[0.03] transition-all relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-[#FF6600]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                             
                             <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
                                <div className="space-y-3">
                                   <div className="flex items-center gap-3">
                                      <span className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest italic">{session.assignment_type || 'Operational Node'}</span>
                                      <div className="w-1 h-1 rounded-full bg-white/20" />
                                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">W{session.week_number} • {session.weight || 10} Units</span>
                                   </div>
                                   <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">{session.title}</h4>
                                   <p className="text-[11px] font-bold text-slate-500 max-w-lg italic">{session.description || 'Access tactical materials and submit your findings to proceed to the next node.'}</p>
                                </div>

                                <div className="flex items-center gap-4 w-full lg:w-auto">
                                   {session.material_url && (
                                      <a href={session.material_url} target="_blank" className="flex-1 lg:flex-none p-4 rounded-2xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-3 group/asset">
                                         <BookOpen className="w-4 h-4 group-hover/asset:scale-110" />
                                         <span className="text-[9px] font-black uppercase tracking-widest">Resources</span>
                                      </a>
                                   )}
                                   {user.permission !== 'read' ? (
                                      <button 
                                         onClick={() => setActiveSession(session)}
                                         className={`flex-1 lg:flex-none px-10 py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-xl ${isCompleted ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-white/5 text-white hover:bg-[#FF6600] hover:text-black hover:shadow-[#FF6600]/20'}`}
                                      >
                                         {isCompleted ? 'Node Certified' : isPending ? 'Under Review' : 'Deploy Submission'}
                                      </button>
                                   ) : (
                                      <div className={`flex-1 lg:flex-none px-10 py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-white/5 text-slate-600 text-center`}>
                                         {isCompleted ? 'Verified' : 'View Only'}
                                      </div>
                                   )}

                                </div>
                             </div>
                          </div>
                       </motion.div>
                    );
                 })}
              </div>
           </div>

           {/* RIGHT: COMMAND & ASSETS (4 COLS) */}
           <div className="xl:col-span-4 space-y-12">
              
              {/* COMMAND DIRECTIVES */}
              <div className="space-y-6">
                 <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-4">
                    <Shield className="w-5 h-5 text-[#FF6600]" /> Command Feed
                 </h3>
                 <div className="space-y-4">
                    {participantState.followups.length === 0 ? (
                       <div className="p-10 border border-dashed border-white/5 rounded-3xl text-center opacity-30">
                          <Activity className="w-8 h-8 text-slate-700 mx-auto mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-widest italic">No active directives</p>
                       </div>
                    ) : (
                       participantState.followups.map(feed => (
                          <div key={feed.id} className="ios-card bg-[#FF6600]/5 border border-[#FF6600]/10 p-6 space-y-4 relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-2 bg-[#FF6600]/10 text-[#FF6600] rounded-bl-xl border-b border-l border-[#FF6600]/10">
                                <Zap className="w-3 h-3" />
                             </div>
                             <div className="flex justify-between items-start">
                                <span className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest italic">Urgent Directive</span>
                                <span className="text-[8px] font-bold text-slate-600 uppercase">{new Date(feed.created_at).toLocaleDateString()}</span>
                             </div>
                             <p className="text-xs font-bold text-white leading-relaxed italic">" {feed.message} "</p>
                             <button className="w-full py-3 bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-[#FF6600]/20 transition-all rounded-xl">Acknowledge</button>
                          </div>
                       ))
                    )}

                    {/* FEEDBACK ENTRIES */}
                    {participantState.submissions.filter(s => s.feedback).slice(0, 3).map(sub => (
                       <div key={sub.id} className="ios-card bg-white/[0.01] border-white/5 p-6 space-y-4">
                          <div className="flex items-center gap-3">
                             <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Feedback: {sub.session_title || 'Mission Node'}</span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-400 leading-relaxed italic">"{sub.feedback}"</p>
                       </div>
                    ))}
                 </div>
              </div>

              {/* MISSION ASSETS */}
              <div className="space-y-6">
                 <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-4">
                    <Briefcase className="w-5 h-5 text-[#FF6600]" /> Asset Vault
                 </h3>
                 <div className="bg-white/[0.01] border border-white/5 rounded-[2rem] p-4 divide-y divide-white/5">
                    {participantState.sessions.filter(s => s.material_url).map(asset => (
                       <a key={asset.id} href={asset.material_url} target="_blank" className="flex items-center gap-4 p-5 hover:bg-white/5 transition-all group">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-[#FF6600] transition-colors">
                             <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                             <p className="text-[10px] font-black text-white uppercase tracking-tighter">{asset.title}</p>
                             <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">Tactical Guide • {asset.assignment_type || 'PDF'}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-white transition-all group-hover:translate-x-1" />
                       </a>
                    ))}
                    {participantState.sessions.filter(s => s.material_url).length === 0 && (
                       <p className="text-center py-10 text-[9px] font-black text-slate-700 uppercase tracking-widest italic">Vault empty</p>
                    )}
                 </div>
              </div>

           </div>
        </div>

        {/* SUBMISSION MODAL */}
        <AnimatePresence>
           {activeSession && (
              <div className="fixed inset-0 z-[300] flex items-center justify-center p-12 bg-black/90 backdrop-blur-md" onClick={() => setActiveSession(null)}>
                 <motion.div 
                    initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
                    className="w-full max-w-2xl bg-[#0d0d18] border border-white/10 rounded-[3.5rem] p-16 shadow-2xl space-y-12 relative overflow-hidden"
                    onClick={e => e.stopPropagation()}
                 >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6600]/5 blur-[100px] -z-1" />
                    
                    <div className="flex justify-between items-start">
                       <div className="space-y-4 text-left">
                          <div className="flex items-center gap-4">
                             <div className="p-3 bg-[#FF6600]/10 rounded-2xl">
                                <FileText className="w-6 h-6 text-[#FF6600]" />
                             </div>
                             <span className="text-[11px] font-black text-[#FF6600] uppercase tracking-[0.5em] italic">Tactical Deployment</span>
                          </div>
                          <h3 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-[0.9]">{activeSession.title}</h3>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest italic">Node Identifier: {activeSession.id}</p>
                       </div>
                       <button onClick={() => setActiveSession(null)} className="p-5 bg-white/5 rounded-3xl text-slate-600 hover:text-white transition-all hover:rotate-90">
                          <X className="w-8 h-8" />
                       </button>
                    </div>

                    <div className="space-y-10">
                        {validationError && (
                           <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-4">
                              <AlertCircle className="w-6 h-6 text-rose-500" />
                              <span className="text-[11px] font-black text-rose-500 uppercase tracking-widest">{validationError}</span>
                           </motion.div>
                        )}

                        <div className="space-y-4 text-left">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 italic">Submission Payload ({activeSession.allowed_format || 'Universal'})</label>
                           
                           {(activeSession.allowed_format?.toLowerCase() === 'link' || activeSession.allowed_format?.toLowerCase() === 'url') ? (
                              <div className="relative group">
                                 <input 
                                    type="text"
                                    placeholder="Paste tactical URL (https://...)"
                                    className="w-full bg-white/[0.02] border border-white/10 p-8 rounded-[2.5rem] text-[#FF6600] outline-none focus:border-[#FF6600] transition-all font-black text-xl italic shadow-inner"
                                    value={submissionValue}
                                    onChange={e => { setSubmissionValue(e.target.value); setValidationError(''); }}
                                 />
                                 <ExternalLink className="absolute right-10 top-1/2 -translate-y-1/2 w-8 h-8 text-slate-700 group-focus-within:text-[#FF6600] transition-colors" />
                              </div>
                           ) : (
                              <div 
                                 onClick={() => {
                                   setSubmissionValue('https://storage.impactos.com/node-' + Date.now() + '.pdf');
                                   setValidationError('');
                                 }}
                                 className={`p-16 border-2 border-dashed rounded-[3.5rem] flex flex-col items-center justify-center gap-8 group transition-all cursor-pointer ${submissionValue ? 'border-[#FF6600] bg-[#FF6600]/5' : 'border-white/5 hover:border-[#FF6600]/30 hover:bg-white/[0.01]'}`}
                              >
                                 <div className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all ${submissionValue ? 'bg-[#FF6600] text-black shadow-lg shadow-[#FF6600]/40' : 'bg-white/5 text-slate-600 group-hover:text-[#FF6600] group-hover:scale-110'}`}>
                                    {submissionValue ? <CheckCircle2 className="w-10 h-10" /> : <Download className="w-10 h-10" />}
                                 </div>
                                 <div className="text-center">
                                    <p className={`text-[12px] font-black uppercase tracking-[0.2em] ${submissionValue ? 'text-[#FF6600]' : 'text-slate-500 group-hover:text-white'}`}>
                                       {submissionValue ? 'Payload Cached Successfully' : `Transmit ${activeSession.allowed_format || 'Documentation'}`}
                                    </p>
                                    {!submissionValue && <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mt-2">Click to select file from system</p>}
                                 </div>
                              </div>
                           )}
                        </div>

                        <div className="space-y-4 text-left">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4 italic">Executive Summary</label>
                           <textarea 
                              rows={5}
                              placeholder="Describe your tactical approach or findings..." 
                              className="w-full bg-white/[0.02] border border-white/10 p-8 rounded-[2.5rem] text-white outline-none focus:border-[#FF6600] transition-all font-bold text-base leading-relaxed shadow-inner" 
                              value={report}
                              onChange={e => setReport(e.target.value)}
                           />
                        </div>

                        <button 
                           onClick={() => handleSubmit(activeSession.id, activeSession.program_id)}
                           disabled={isSubmitting}
                           className={`w-full py-8 rounded-[2.5rem] font-black uppercase text-[14px] tracking-[0.5em] transition-all italic flex items-center justify-center gap-6 shadow-2xl ${isSubmitting ? 'bg-slate-800 text-slate-500' : 'bg-[#FF6600] text-black hover:bg-white hover:scale-[1.02] hover:shadow-[#FF6600]/30'}`}
                        >
                           {isSubmitting ? <Activity className="w-6 h-6 animate-spin"/> : <Send className="w-6 h-6" />}
                           DEPLOY DATA
                        </button>
                    </div>
                 </motion.div>
              </div>
           )}
        </AnimatePresence>

        {/* SIGNAL MODAL */}
        <AnimatePresence>
           {isMessaging && (
              <div className="fixed inset-0 z-[500] flex items-center justify-center p-12 bg-black/95 backdrop-blur-xl" onClick={() => setIsMessaging(false)}>
                 <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full max-w-xl bg-[#0d0d18] border border-white/10 rounded-[3.5rem] p-16 shadow-2xl space-y-12 relative overflow-hidden text-left"
                    onClick={e => e.stopPropagation()}
                 >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FF6600] to-transparent shadow-[0_0_20px_#FF6600]" />
                    
                    <div className="flex justify-between items-start">
                       <div className="space-y-4">
                          <div className="flex items-center gap-4">
                             <Zap className="w-6 h-6 text-[#FF6600] animate-pulse" />
                             <span className="text-[12px] font-black text-[#FF6600] uppercase tracking-[0.6em] italic">Internal Command</span>
                          </div>
                          <h3 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none">Signal Project Authority</h3>
                       </div>
                       <button onClick={() => setIsMessaging(false)} className="p-5 bg-white/5 rounded-3xl text-slate-600 hover:text-white transition-all hover:rotate-90">
                          <X className="w-8 h-8" />
                       </button>
                    </div>

                    <div className="p-8 bg-[#FF6600]/5 border border-[#FF6600]/20 rounded-[2rem] flex items-start gap-6">
                       <Shield className="w-6 h-6 text-[#FF6600] shrink-0" />
                       <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                          Your inquiry will be routed directly to the designated Program Authority. Please provide clear tactical context for faster resolution.
                       </p>
                    </div>

                    <div className="space-y-8">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-4 italic">Signal Objective</label>
                          <input 
                             placeholder="e.g. Technical Clarification: Phase 01..." 
                             className="w-full bg-white/5 border border-white/5 p-7 rounded-3xl text-white outline-none focus:border-[#FF6600] transition-all font-black italic tracking-tight"
                             value={signalData.subject}
                             onChange={e => setSignalData({...signalData, subject: e.target.value})}
                          />
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-4 italic">Detailed Directive</label>
                          <textarea 
                             rows={6}
                             placeholder="Provide full tactical context..." 
                             className="w-full bg-white/5 border border-white/5 p-8 rounded-[2.5rem] text-white outline-none focus:border-[#FF6600] transition-all font-bold leading-relaxed shadow-inner" 
                             value={signalData.body}
                             onChange={e => setSignalData({...signalData, body: e.target.value})}
                          />
                       </div>
                    </div>

                    <button 
                       onClick={handleSendSignal}
                       disabled={!signalData.body || isSendingSignal}
                       className={`w-full py-8 rounded-[2.5rem] font-black uppercase text-[14px] tracking-[0.5em] transition-all italic flex items-center justify-center gap-6 shadow-2xl ${isSendingSignal || !signalData.body ? 'bg-slate-800 text-slate-500' : 'bg-[#FF6600] text-black hover:bg-white hover:scale-[1.02] hover:shadow-[#FF6600]/30'}`}
                    >
                       {isSendingSignal ? <Activity className="w-6 h-6 animate-spin"/> : <Send className="w-6 h-6" />}
                       TRANSMIT SIGNAL
                    </button>
                 </motion.div>
              </div>
           )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );

}
