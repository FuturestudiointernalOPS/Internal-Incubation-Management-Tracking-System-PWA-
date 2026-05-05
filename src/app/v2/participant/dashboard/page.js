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
  const [curriculum, setCurriculum] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [report, setReport] = useState('');
  const [submissionValue, setSubmissionValue] = useState(''); // Stores link or file ref
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [isMessaging, setIsMessaging] = useState(false);
  const [signalData, setSignalData] = useState({ subject: '', body: '' });
  const [isSendingSignal, setIsSendingSignal] = useState(false);
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const handleLangChange = () => setLang(localStorage.getItem('impactos-lang') || 'en');
    window.addEventListener('impactos:languageChange', handleLangChange);
    handleLangChange(); // Initial load
    return () => window.removeEventListener('impactos:languageChange', handleLangChange);
  }, []);

  useEffect(() => {
    const sessionUser = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(sessionUser);
    fetchData(sessionUser);
  }, []);

  const fetchData = async (userData) => {
    try {
      const isTeam = userData.role === 'team';
      const teamId = userData.team_id || userData.id; // team_id is set in login for team role
      
      // Mocking program discovery for now
      const res = await fetch(`/api/v2/pm/full-state`); 
      const data = await res.json();
      if (data.success) {
        setCurriculum(data.sessions || []);
      }

      let subUrl = `/api/v2/participant/submissions?participant_id=${userData.id}`;
      if (isTeam) {
        subUrl = `/api/v2/participant/submissions?team_id=${teamId}`;
      }

      const subRes = await fetch(subUrl);
      const subData = await subRes.json();
      if (subData.success) setSubmissions(subData.submissions);

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
          participant_id: user.id,
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
        fetchData(user.id);
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
          sender_id: user.id,
          sender_role: 'participant',
          target_role: 'pm',
          subject: signalData.subject || 'Clarification Request',
          message: signalData.body,
          program_id: curriculum[0]?.program_id // Target the PM of the active program
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
    if (curriculum.length === 0) return 0;
    const totalWeight = curriculum.reduce((acc, s) => acc + (s.weight || 0), 0);
    const completedWeight = submissions.filter(s => s.status === 'reviewed').length * 5; // Simplified for demo
    return Math.min(100, Math.round((completedWeight / (totalWeight || 1)) * 100));
  };

  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="space-y-12">
        
        {/* PROGRESS HUD */}
        <header className="flex flex-col lg:flex-row justify-between items-center gap-10 bg-white/[0.02] border border-white/5 p-12 rounded-[3rem] shadow-2xl">
           <div className="space-y-4">
              <div className="flex items-center gap-4">
                 <Target className="w-5 h-5 text-[#FF6600]" />
                 <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.4em]">{user.role === 'team' ? 'Unit Mission Progress' : 'Individual Progress'}</span>
              </div>
              <h2 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">{user.role === 'team' ? user.name : t[lang].progress}</h2>
              <p className="text-slate-400 font-bold max-w-xl opacity-70">Complete requirements to increase your progress and unlock the next phase.</p>
           </div>
            <div className="flex flex-col gap-4">
               <button 
                  onClick={() => setIsMessaging(true)}
                  className="px-12 py-5 bg-[#FF6600] text-black font-black uppercase text-[11px] tracking-widest rounded-[2rem] hover:bg-white transition-all shadow-2xl shadow-[#FF6600]/20 flex items-center gap-4 italic"
               >
                  <Zap className="w-5 h-5" /> Signal PM
               </button>
               <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                     <circle cx="96" cy="96" r="80" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                     <circle cx="96" cy="96" r="80" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-[#FF6600]" strokeDasharray={502} strokeDashoffset={502 - (502 * calculateProgress() / 100)} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <span className="text-5xl font-black text-white italic">{calculateProgress()}%</span>
                     <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t[lang].target}</span>
                  </div>
               </div>
            </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
           
           {/* MISSION CURRICULUM */}
           <div className="xl:col-span-2 space-y-8">
              <h3 className="text-xl font-black text-white uppercase italic tracking-widest">{t[lang].curriculum}</h3>
              <div className="space-y-6">
                 {curriculum.map(session => {
                    const isCompleted = submissions.some(s => s.requirement_id.startsWith(session.id)); // Simplified check
                    return (
                       <div key={session.id} className="ios-card bg-white/[0.01] border-white/5 p-8 hover:bg-white/[0.02] transition-all group overflow-hidden relative">
                          <div className="flex justify-between items-center relative z-10">
                             <div className="flex items-center gap-8">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl italic border transition-all ${isCompleted ? 'bg-[#FF6600] text-black border-[#FF6600] shadow-[0_0_20px_rgba(255,102,0,0.4)]' : 'bg-white/5 text-slate-700 border-white/5'}`}>
                                   {isCompleted ? <CheckCircle2 className="w-8 h-8"/> : session.week_number}
                                </div>
                                <div>
                                   <div className="flex items-center gap-3 mb-2">
                                      <span className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest italic">{session.assignment_type || 'Workshop'}</span>
                                      <div className="w-1 h-1 rounded-full bg-white/20" />
                                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{session.weight} Units</span>
                                   </div>
                                   <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none">{session.title}</h4>
                                </div>
                             </div>
                             <div className="flex items-center gap-6">
                                {session.material_url && (
                                   <a href={session.material_url} target="_blank" className="p-4 rounded-2xl bg-white/5 text-slate-500 hover:text-white transition-all flex items-center gap-3">
                                      <BookOpen className="w-5 h-5" />
                                      <span className="text-[10px] font-black uppercase tracking-widest hidden md:block">Material</span>
                                   </a>
                                )}
                                <button 
                                   onClick={() => setActiveSession(session)}
                                   className="px-8 py-4 bg-white/5 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-[#FF6600] hover:text-black transition-all"
                                >
                                   Deploy Submission
                                </button>
                             </div>
                          </div>
                       </div>
                    );
                 })}
              </div>
           </div>

           {/* RECENT FEEDBACK / REPORTS */}
           <div className="space-y-8">
              <h3 className="text-xl font-black text-white uppercase italic tracking-widest">Tactical Logs</h3>
              <div className="space-y-6">
                 {submissions.slice(0, 5).map(sub => (
                    <div key={sub.id} className="ios-card bg-white/[0.01] border-white/5 p-6 space-y-4">
                       <div className="flex justify-between items-start">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${sub.status === 'reviewed' ? 'bg-[#FF6600]/20 text-[#FF6600]' : 'bg-white/5 text-slate-600'}`}>
                             {sub.status}
                          </span>
                          <span className="text-[9px] font-bold text-slate-700">{new Date(sub.submitted_at).toLocaleDateString()}</span>
                       </div>
                       <p className="text-sm font-bold text-white leading-relaxed">{sub.report_body || "Submission successful. No tactical report provided."}</p>
                       {sub.feedback && (
                          <div className="pt-4 border-t border-white/5 flex items-start gap-4">
                             <Shield className="w-4 h-4 text-[#FF6600] shrink-0" />
                             <p className="text-[11px] font-bold text-slate-500 italic">" {sub.feedback} "</p>
                          </div>
                       )}
                    </div>
                 ))}
              </div>
           </div>

        </div>

        {/* SUBMISSION MODAL */}
        <AnimatePresence>
           {activeSession && (
              <div className="fixed inset-0 z-[300] flex items-center justify-center p-12 bg-black/80 backdrop-blur-md">
                 <motion.div 
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                    className="w-full max-w-2xl bg-[#0d0d18] border border-white/10 rounded-[3rem] p-16 shadow-2xl space-y-12"
                 >
                    <div className="flex justify-between items-start">
                       <div className="space-y-4">
                          <div className="flex items-center gap-4">
                             <FileText className="w-5 h-5 text-[#FF6600]" />
                             <span className="text-[11px] font-black text-[#FF6600] uppercase tracking-[0.5em] italic">Tactical Deployment</span>
                          </div>
                          <h3 className="text-5xl font-black text-white uppercase italic tracking-tighter leading-none">{activeSession.title}</h3>
                       </div>
                       <button onClick={() => setActiveSession(null)} className="p-5 bg-white/5 rounded-3xl text-slate-600 hover:text-white transition-all transform hover:rotate-90">
                          <Plus className="w-8 h-8 rotate-45" />
                       </button>
                    </div>

                    <div className="space-y-8">
                        {validationError && (
                           <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-4">
                              <AlertCircle className="w-5 h-5 text-rose-500" />
                              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{validationError}</span>
                           </div>
                        )}

                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2 italic">Submission Content ({activeSession.allowed_format || 'General'})</label>
                           
                           {(activeSession.allowed_format?.toLowerCase() === 'link' || activeSession.allowed_format?.toLowerCase() === 'url') ? (
                              <div className="relative group">
                                 <input 
                                    type="text"
                                    placeholder="Paste secure link here (https://...)"
                                    className="w-full bg-[#0d0d18] border border-white/10 p-8 rounded-[2rem] text-[#FF6600] outline-none focus:border-[#FF6600] transition-all font-black text-lg italic shadow-inner"
                                    value={submissionValue}
                                    onChange={e => { setSubmissionValue(e.target.value); setValidationError(''); }}
                                 />
                                 <ExternalLink className="absolute right-8 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-700 group-focus-within:text-[#FF6600] transition-colors" />
                              </div>
                           ) : (
                              <div 
                                 onClick={() => setSubmissionValue('https://storage.impactos.com/mock-upload.pdf')}
                                 className={`p-12 border-2 border-dashed rounded-[3rem] flex flex-col items-center justify-center gap-6 group transition-all cursor-pointer ${submissionValue ? 'border-[#FF6600] bg-[#FF6600]/5' : 'border-white/5 hover:border-[#FF6600]/30'}`}
                              >
                                 <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${submissionValue ? 'bg-[#FF6600] text-black' : 'bg-white/5 text-slate-600 group-hover:text-[#FF6600] group-hover:scale-110'}`}>
                                    {submissionValue ? <CheckCircle2 className="w-8 h-8" /> : <Download className="w-8 h-8" />}
                                 </div>
                                 <p className={`text-[11px] font-black uppercase tracking-widest ${submissionValue ? 'text-[#FF6600]' : 'text-slate-700'}`}>
                                    {submissionValue ? 'Node Cached Successfully' : `Click to Upload ${activeSession.allowed_format || 'File'}`}
                                 </p>
                              </div>
                           )}
                        </div>

                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2 italic">Tactical Status Report (Optional)</label>
                           <textarea 
                              rows={4}
                              placeholder="Provide context or challenges encountered..." 
                              className="w-full bg-[#0d0d18] border border-white/10 p-8 rounded-[2rem] text-white outline-none focus:border-[#FF6600] transition-all font-bold leading-relaxed shadow-inner" 
                              value={report}
                              onChange={e => setReport(e.target.value)}
                           />
                        </div>

                        <button 
                           onClick={() => handleSubmit(activeSession.id, activeSession.program_id)}
                           disabled={isSubmitting}
                           className="w-full py-7 bg-[#FF6600] text-black font-black uppercase text-[12px] tracking-[0.4em] rounded-[2rem] hover:bg-white transition-all shadow-2xl shadow-[#FF6600]/30 italic flex items-center justify-center gap-4"
                        >
                           {isSubmitting ? <Activity className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5" />}
                           {t[lang].save}
                        </button>
                    </div>
                 </motion.div>
              </div>
           )}
        </AnimatePresence>
         <AnimatePresence>
            {isMessaging && (
               <div className="fixed inset-0 z-[500] flex items-center justify-center p-12 bg-black/90 backdrop-blur-md">
                  <motion.div 
                     initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                     className="w-full max-w-xl bg-[#0d0d18] border border-white/10 rounded-[3rem] p-16 shadow-2xl space-y-10 relative overflow-hidden text-left"
                  >
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FF6600] to-transparent" />
                     
                     <div className="flex justify-between items-start">
                        <div className="space-y-4">
                           <div className="flex items-center gap-4">
                              <Zap className="w-5 h-5 text-[#FF6600]" />
                              <span className="text-[11px] font-black text-[#FF6600] uppercase tracking-[0.5em] italic">Internal Command</span>
                           </div>
                           <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">Signal Project Manager</h3>
                        </div>
                        <button onClick={() => setIsMessaging(false)} className="p-4 bg-white/5 rounded-2xl text-slate-600 hover:text-white transition-all transform hover:rotate-90">
                           <X className="w-6 h-6" />
                        </button>
                     </div>

                     <div className="p-6 bg-[#FF6600]/5 border border-[#FF6600]/20 rounded-2xl flex items-start gap-4">
                        <Shield className="w-5 h-5 text-[#FF6600] shrink-0" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed text-left">Your inquiry will be routed directly to the designated Program Authority. Please provide clear tactical context.</p>
                     </div>

                     <div className="space-y-6">
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2 italic text-left">Subject / Objective</label>
                           <input 
                              placeholder="e.g. Clarification on Workshop 02..." 
                              className="w-full bg-white/5 border border-white/5 p-6 rounded-2xl text-white outline-none focus:border-[#FF6600] transition-all font-bold"
                              value={signalData.subject}
                              onChange={e => setSignalData({...signalData, subject: e.target.value})}
                           />
                        </div>
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2 italic text-left">Directive Body</label>
                           <textarea 
                              rows={5}
                              placeholder="Provide detailed inquiry or feedback..." 
                              className="w-full bg-white/5 border border-white/5 p-8 rounded-2xl text-white outline-none focus:border-[#FF6600] transition-all font-bold leading-relaxed shadow-inner" 
                              value={signalData.body}
                              onChange={e => setSignalData({...signalData, body: e.target.value})}
                           />
                        </div>
                     </div>

                     <button 
                        onClick={handleSendSignal}
                        disabled={!signalData.body || isSendingSignal}
                        className="w-full py-7 bg-[#FF6600] text-black font-black uppercase text-[12px] tracking-[0.4em] rounded-[2rem] hover:bg-white transition-all shadow-2xl shadow-[#FF6600]/30 italic flex items-center justify-center gap-4"
                     >
                        {isSendingSignal ? <Activity className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5" />}
                        Transmit Signal
                     </button>
                  </motion.div>
               </div>
            )}
         </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
