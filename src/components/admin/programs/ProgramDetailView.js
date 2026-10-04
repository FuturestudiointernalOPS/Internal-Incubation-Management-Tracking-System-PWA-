'use client';

import {
  AlertCircle,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Layers,
  Link as LinkIcon,
  MessageSquare,
  Target,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import KpiManagement from "@/components/admin/programs/KpiManagement";
import WeekReports from "@/components/admin/programs/program-detail-view/WeekReports";

export default function ProgramDetailView({ ctx }) {
  const {
    isLoadingData,
    attendance,
    followups,
    handleAddFollowup,
    handleKpiAction,
    isEditingKpi,
    isSubmitting,
    kpiForm,
    kpis,
    newFollowup,
    nowMs,
    participants,
    program,
    regForm,
    reports,
    requirements,
    selectedSession,
    sessions,
    setIsEditingKpi,
    setKpiForm,
    setNewFollowup,
    setSelectedSession,
    submissions,
    t,
  } = ctx;

  if (isLoadingData || !program) return (
    <div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
    </div>
  );

  const totalWeeks = program.duration_weeks || 13;
  const weeks = Array.from({ length: totalWeeks }, (_, index) => index + 1);

  // ── Completion rate: based on program duration (elapsed weeks ÷ total weeks) ──
  // Robust start date: explicit start_date → created_at → first session → first submission.
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const startMs = program.start_date
    ? new Date(`${program.start_date}T00:00:00`).getTime()
    : program.created_at
      ? new Date(program.created_at).getTime()
      : sessions[0]?.start_at
        ? new Date(sessions[0].start_at).getTime()
        : submissions[0]?.created_at
          ? new Date(submissions[0].created_at).getTime()
          : null;
  const endMs = program.end_date
    ? new Date(`${program.end_date}T00:00:00`).getTime()
    : null;
  let durationCompletion = 0;
  let elapsedWeeks = 0;
  if (startMs && Number.isFinite(startMs)) {
    elapsedWeeks = Math.max(0, (nowMs - startMs) / WEEK_MS);
    if (endMs && Number.isFinite(endMs) && endMs > startMs) {
      durationCompletion = Math.min(
        100,
        Math.max(0, ((nowMs - startMs) / (endMs - startMs)) * 100),
      );
    } else if (totalWeeks > 0) {
      durationCompletion = Math.min(100, (elapsedWeeks / totalWeeks) * 100);
    }
  }
  // Weeks elapsed since the program started (an in-progress week counts as one).
  const elapsedWeeksShown = Math.min(totalWeeks, Math.max(0, Math.ceil(elapsedWeeks)));

  return (
    <>
      <div className="space-y-12 pb-20">
        
        {/* EXECUTIVE HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-end gap-8">
          <div className="space-y-4 text-left">
             <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-secondary border border-[var(--border-primary)] flex items-center justify-center text-[#FF6600] shadow-xl">
                   <Briefcase className="w-6 h-6" />
                </div>
                <div>
                   <h2 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none">{program.name}</h2>
                   <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mt-2">{t("adminMisc.programDetail.programOverviewLabel", { id: program.id })}</p>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-6">
             {program.assigned_segments?.length > 0 && program.assigned_segments[0] && (
                <div className="flex flex-col items-end gap-2 px-6 py-2 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                   <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{t("adminMisc.programDetail.registrationNode")}</p>
                   {regForm ? (
                      <div className="flex items-center gap-3">
                         <button 
                            onClick={() => {
                               navigator.clipboard.writeText(regForm.link);
                               window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: t("adminMisc.programDetail.urlCopied") } }));
                            }}
                            className="flex items-center gap-2 text-[10px] font-bold text-white hover:text-blue-400 transition-colors uppercase"
                         >
                            <LinkIcon className="w-3 h-3" /> {t("adminMisc.programDetail.copyGroupUrl")}
                         </button>
                         <a
                            href={regForm.link}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[10px] font-bold text-white hover:text-blue-400 transition-colors uppercase"
                         >
                            <ExternalLink className="w-3 h-3" /> {t("adminMisc.programs.openForm")}
                         </a>
                      </div>
                   ) : (
                      <div className="flex flex-col items-end gap-1">
                         <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">{t("adminMisc.programs.noFormYet")}</p>
                         <a
                            href="/platform/forms"
                            className="text-[10px] font-bold text-blue-400 hover:underline uppercase"
                         >
                            {t("adminMisc.programs.goToCrmForms")}
                         </a>
                      </div>
                   )}
                </div>
             )}
             <div className="text-right">
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">{t("adminMisc.programDetail.leadProgramManager")}</p>
                <p className="text-sm font-black text-[var(--text-primary)] uppercase">{program.pm_name || t("adminMisc.programDetail.unassigned")}</p>
             </div>
             <div className="w-px h-8 bg-white/10" />
             <div className="text-right">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">{t("adminMisc.programDetail.status")}</p>
                <p className="text-sm font-black text-[#FF6600] uppercase">{program.status || t("adminMisc.programDetail.active")}</p>
             </div>
          </div>
        </header>

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <div className="ios-card bg-secondary border-[var(--border-primary)] !p-8 relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#FF6600]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                 <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    {t("adminMisc.programDetail.completionRate")}
                    <AlertCircle className="w-3 h-3 text-[var(--text-secondary)] cursor-help" title={t("adminMisc.programDetail.completionRateTooltip")} />
                 </p>
                 <h4 className="text-3xl font-black text-[var(--text-primary)]">{durationCompletion.toFixed(1)}%</h4>
                 <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-3 leading-relaxed">
                    {t("adminMisc.programDetail.overallProgress")}
                 </p>
              </div>
           </div>
           <div className="ios-card bg-secondary border-[var(--border-primary)] !p-8">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-4">{t("adminMisc.programDetail.weeksElapsed")}</p>
              <h4 className="text-3xl font-black text-[var(--text-primary)]">{elapsedWeeksShown}/{totalWeeks}</h4>
           </div>
           <div className="ios-card bg-white/[0.02] border-white/5 !p-8">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{t("adminMisc.programDetail.weeklyReports")}</p>
              <h4 className="text-3xl font-black text-[#FF6600]">{t("adminMisc.programDetail.reportLogs", { count: reports.length })}</h4>
           </div>
           <div className="ios-card bg-[#FF6600]/5 border-[#FF6600]/20 !p-8">
              <p className="text-[10px] font-bold text-[#FF6600] uppercase tracking-widest mb-4">{t("adminMisc.programDetail.adminComments")}</p>
              <h4 className="text-3xl font-black text-white">{followups.length}</h4>
           </div>
        </div>

        {/* PROGRAM INFRASTRUCTURE & KPI MANAGEMENT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* KPI MANAGEMENT */}
           <KpiManagement 
             kpis={kpis} 
             isEditingKpi={isEditingKpi} 
             setIsEditingKpi={setIsEditingKpi} 
             kpiForm={kpiForm} 
             setKpiForm={setKpiForm} 
             handleKpiAction={handleKpiAction} 
             isSubmitting={isSubmitting} 
           />

           {/* KNOWLEDGE BASE OVERVIEW */}
           <div className="ios-card bg-secondary border-[var(--border-primary)] !p-10 space-y-8">
              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">{t("adminMisc.programDetail.knowledgeInfrastructure")}</h3>
                 </div>
              </div>

              <div className="space-y-6">
                 {program.note_title ? (
                    <div className="space-y-6">
                       <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl text-left">
                          <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-2">{program.note_title}</h4>
                          <p className="text-sm text-slate-400 leading-relaxed">{program.note_description || t("adminMisc.programDetail.knowledgeAssetFallback")}</p>
                       </div>
                       
                       <div className="space-y-4">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left">{t("adminMisc.programDetail.attachedFiles")}</p>
                          <div className="grid grid-cols-1 gap-3">
                             {program.knowledge_assets?.map((asset, index) => (
                                <a 
                                   key={index} 
                                   href={asset.url} 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-blue-400/30 transition-all group"
                                >
                                   <div className="flex items-center gap-3">
                                      <LinkIcon className="w-4 h-4 text-blue-400" />
                                      <p className="text-xs font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{asset.name}</p>
                                   </div>
                                   <ChevronRight className="w-4 h-4 text-slate-700 group-hover:translate-x-1 transition-all" />
                                </a>
                             ))}
                          </div>
                       </div>
                    </div>
                 ) : (
                    <div className="p-12 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center gap-4 opacity-40 text-left">
                       <AlertCircle className="w-10 h-10 text-slate-700" />
                       <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.noKnowledgeBase")}</p>
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* STRATEGIC TIMELINE */}
        <div className="space-y-12">
           <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-slate-700" />
              <h3 className="text-xl font-black text-white uppercase tracking-widest">{t("adminMisc.programDetail.programSchedule")}</h3>
           </div>

           <div className="space-y-8 relative">
              <div className="absolute left-[27px] top-0 bottom-0 w-px bg-white/5" />
              
              {weeks.map(weekNumber => {
                 const weekReports = reports.filter(report => report.week_number === weekNumber);
                 const weekFollowups = followups.filter(followup => followup.week_number === weekNumber);
                 const weekSessions = sessions.filter(session => session.week_number === weekNumber);
                 const weekDocs = requirements.filter(requirement => requirement.session_id && weekSessions.map(session => session.id).includes(requirement.session_id));

                 // Week completion = % of unique participants who completed the
                 // week (valid submission OR presence) vs total participants.
                 const weekSessionIds = weekSessions.map((session) => String(session.id));
                 const weekDocIds = weekDocs.map((doc) => String(doc.id));
                 const weekSubmitters = new Set(
                   submissions
                     .filter(
                       (submission) =>
                         (weekDocIds.includes(String(submission.document_id)) ||
                          weekDocIds.includes(String(submission.deliverable_id))) &&
                         submission.status !== "rejected" &&
                         submission.participant_id != null,
                     )
                     .map((submission) => String(submission.participant_id)),
                 );
                 const weekPresentCount = attendance.filter(
                   (attendanceRecord) =>
                     weekSessionIds.includes(String(attendanceRecord.session_id)) &&
                     attendanceRecord.status === "present",
                 ).length;
                 const weekPresentIds = new Set(
                   attendance
                     .filter(
                       (attendanceRecord) =>
                         weekSessionIds.includes(String(attendanceRecord.session_id)) &&
                         attendanceRecord.status === "present" &&
                         attendanceRecord.participant_id != null,
                     )
                     .map((attendanceRecord) => String(attendanceRecord.participant_id)),
                 );
                 const weekCompleters = new Set([
                   ...weekSubmitters,
                   ...weekPresentIds,
                 ]);
                 const weekProgress =
                   participants.length > 0
                     ? Math.min(100, (weekCompleters.size / participants.length) * 100)
                     : 0;

                 const isCompleted = weekSessions.length > 0 && weekSessions.every(session => session.status === 'completed');

                 return (
                    <div key={`week-${weekNumber}`} className="relative pl-16">
                       {/* DOT */}
                       <div className={`absolute left-0 top-0 w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all ${
                          weekReports.length > 0 ? 'bg-[#FF6600] border-[#FF6600] text-black shadow-[0_0_20px_rgba(255,102,0,0.3)]' : 'bg-primary border-[var(--border-primary)] text-[var(--text-secondary)]'
                       }`}>
                          <span className="text-lg font-black">{weekNumber}</span>
                       </div>

                       <div className="ios-card bg-secondary border-[var(--border-primary)] !p-10 hover:bg-tertiary transition-all text-left space-y-10">
                          <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                             <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-3">
                                   <h4 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
                                      {weekSessions[0]?.title || t("adminMisc.programDetail.weekActivities", { week: weekNumber })}
                                   </h4>
                                   {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" />}
                                </div>
                                
                                {/* WEEKLY PROGRESS BAR */}
                                <div className="space-y-3 max-w-md">
                                   <div className="flex justify-between items-end">
                                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{t("adminMisc.programDetail.weekCompletion")}</p>
                                      <p className="text-[10px] font-bold text-[#FF6600]">{weekProgress.toFixed(0)}%</p>
                                   </div>
                                   <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                      <motion.div 
                                         initial={{ width: 0 }}
                                         animate={{ width: `${weekProgress}%` }}
                                         className={`h-full bg-gradient-to-r ${weekProgress === 100 ? 'from-emerald-500 to-emerald-400' : 'from-[#FF6600] to-[#FF9900]'}`}
                                      />
                                   </div>
                                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                      {t("adminMisc.programDetail.participantsCompleted", { count: weekCompleters.size, total: participants.length })}
                                   </p>
                                </div>
                             </div>

                             <div className="flex flex-col lg:flex-row gap-4">
                                <div className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border flex items-center gap-2 ${
                                   weekReports.length > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                }`}>
                                   <BookOpen className="w-3 h-3" />
                                   {weekReports.length > 0 ? t("adminMisc.programDetail.reportSubmitted") : t("adminMisc.programDetail.reportPending")}
                                </div>
                             </div>
                          </div>

                          {/* ACTIVITIES & TASKS GRID */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                             {/* ACTIVITIES */}
                             <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                   <Target className="w-3.5 h-3.5 text-slate-600" />
                                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.activities")}</p>
                                </div>
                                <div className="space-y-3">
                                   {weekSessions.map((session, sessionIndex) => {
                                      const sessionFollowups = followups.filter(followup => followup.session_id === session.id);
                                      let materials = [];
                                      try {
                                        materials = session.resource_links ? JSON.parse(session.resource_links) : [];
                                      } catch (error) {
                                        console.error("Failed to parse resource links:", error);
                                        materials = [];
                                      }                                      
                                      return (
                                         <div key={`session-${session.id || sessionIndex}-${sessionIndex}`} className="space-y-2">
                                            <div 
                                               onClick={() => setSelectedSession(selectedSession === session.id ? null : session.id)}
                                               className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-[#FF6600]/30 cursor-pointer transition-all"
                                            >
                                               <div className="flex items-center gap-4 text-left">
                                                  <div className={`w-2 h-2 rounded-full ${session.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : session.status === 'in progress' ? 'bg-amber-500' : 'bg-slate-800'}`} />
                                                  <div className="flex flex-col">
                                                     <p className="text-xs font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{session.title}</p>
                                                     <p className="text-[10px] font-bold text-[#FF6600] uppercase tracking-widest">{t("adminMisc.programDetail.assignmentStyle", { type: session.assignment_type || t("adminMisc.programDetail.workshop") })}</p>
                                                  </div>
                                               </div>
                                               <div className="flex items-center gap-4">
                                                  {sessionFollowups.length > 0 && <MessageSquare className="w-3 h-3 text-[#FF6600] animate-pulse" />}
                                                  <ChevronRight className={`w-4 h-4 text-slate-700 transition-transform ${selectedSession === session.id ? 'rotate-90 text-[#FF6600]' : ''}`} />
                                               </div>
                                            </div>

                                            <AnimatePresence>
                                               {selectedSession === session.id && (
                                                  <motion.div 
                                                     initial={{ height: 0, opacity: 0 }}
                                                     animate={{ height: 'auto', opacity: 1 }}
                                                     exit={{ height: 0, opacity: 0 }}
                                                     className="overflow-hidden"
                                                  >
                                                     <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 ml-4 mt-2 space-y-6 text-left">
                                                        <div className="space-y-2">
                                                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.activityGoal")}</p>
                                                           <p className="text-sm text-slate-300 leading-relaxed">{session.description || t("adminMisc.programDetail.noActivityGoal")}</p>
                                                        </div>

                                                        {materials.length > 0 && (
                                                           <div className="space-y-3">
                                                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.lessonMaterials")}</p>
                                                              <div className="flex flex-wrap gap-2">
                                                                 {materials.map((material, materialIndex) => (
                                                                    <a key={`material-${materialIndex}`} href={material.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-[10px] font-bold text-[#FF6600] uppercase tracking-widest hover:bg-[#FF6600] hover:text-black transition-all">
                                                                       {material.title || t("adminMisc.programDetail.resourceLink")}
                                                                    </a>
                                                                 ))}
                                                              </div>
                                                           </div>
                                                        )}

                                                        {/* SESSION FEEDBACK */}
                                                        <div className="pt-4 border-t border-white/5 space-y-4">
                                                           <div className="flex justify-between items-center">
                                                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.activityFeedback")}</p>
                                                              <button 
                                                                 onClick={() => setNewFollowup({ week: weekNumber, session_id: session.id, comment: '' })}
                                                                 className="text-[10px] font-bold text-[#FF6600] uppercase tracking-wide"
                                                              >
                                                                 + {t("adminMisc.programDetail.leaveComment")}
                                                              </button>
                                                           </div>

                                                           <div className="space-y-2">
                                                              {sessionFollowups.map((followup, followupIndex) => (
                                                                 <div key={`sf-${followup.id || followupIndex}-${followupIndex}`} className="p-3 rounded-xl bg-[#FF6600]/5 border border-[#FF6600]/10 flex gap-3">
                                                                    <div className="w-6 h-6 rounded-lg bg-[#FF6600]/20 flex items-center justify-center text-[#FF6600] shrink-0">
                                                                       <Target className="w-3 h-3" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                       <p className="text-[10px] text-white font-bold">{followup.comment}</p>
                                                                    </div>
                                                                 </div>
                                                              ))}
                                                           </div>

                                                           {newFollowup.session_id === session.id && (
                                                              <div className="space-y-3 mt-4">
                                                                 <textarea 
                                                                    value={newFollowup.comment}
                                                                    onChange={event => setNewFollowup({...newFollowup, comment: event.target.value})}
                                                                    placeholder={t("adminMisc.programDetail.feedbackPlaceholder")}
                                                                    className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[#FF6600]/50 transition-all resize-none"
                                                                    rows={2}
                                                                 />
                                                                 <div className="flex justify-end gap-2">
                                                                    <button onClick={() => setNewFollowup({ week: null, session_id: null, comment: '' })} className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">{t("adminMisc.programDetail.cancel")}</button>
                                                                    <button 
                                                                       disabled={isSubmitting || !newFollowup.comment.trim()}
                                                                       onClick={() => handleAddFollowup(weekNumber, session.id)}
                                                                       className="px-4 py-1.5 bg-[#FF6600] text-black text-sm font-bold uppercase tracking-wide rounded-lg hover:bg-white transition-all"
                                                                    >
                                                                       {isSubmitting ? '...' : t("adminMisc.programDetail.post")}
                                                                    </button>
                                                                 </div>
                                                              </div>
                                                           )}
                                                        </div>
                                                     </div>
                                                  </motion.div>
                                               )}
                                            </AnimatePresence>
                                         </div>
                                      );
                                   })}
                                   {weekSessions.length === 0 && <p className="text-[10px] font-medium text-slate-700 uppercase">{t("adminMisc.programDetail.noActivities")}</p>}
                                </div>
                             </div>

                             {/* ASSETS */}
                             <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                   <Layers className="w-3.5 h-3.5 text-slate-600" />
                                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.requiredTasks")}</p>
                                </div>
                                <div className="space-y-3">
                                   {weekDocs.map((doc, docIndex) => (
                                      <div key={`doc-${doc.id || docIndex}-${docIndex}`} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                         <div className="flex items-center gap-4">
                                            <CheckCircle2 className={`w-4 h-4 ${doc.is_completed ? 'text-emerald-500' : 'text-slate-800'}`} />
                                            <p className="text-xs font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{doc.title}</p>
                                         </div>
                                         <span className={`text-[10px] font-bold uppercase tracking-widest ${doc.is_completed ? 'text-emerald-500' : 'text-slate-600'}`}>{doc.is_completed ? t("adminMisc.programDetail.done") : t("adminMisc.programDetail.pending")}</span>
                                      </div>
                                   ))}
                                   {/* Auto-added presence task for weeks with scheduled sessions */}
                                   {weekSessionIds.length > 0 && (
                                      <div key={`presence-${weekNumber}`} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                         <div className="flex items-center gap-4">
                                            <CheckCircle2 className={`w-4 h-4 ${weekPresentCount > 0 ? 'text-emerald-500' : 'text-slate-800'}`} />
                                            <p className="text-xs font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{t("pmMisc.workspace.attendance")}</p>
                                         </div>
                                         <span className={`text-[10px] font-bold uppercase tracking-widest ${weekPresentCount > 0 ? 'text-emerald-500' : 'text-slate-600'}`}>{weekPresentCount > 0 ? t("adminMisc.programDetail.done") : t("adminMisc.programDetail.pending")}</span>
                                      </div>
                                   )}
                                   {weekDocs.length === 0 && weekSessionIds.length === 0 && <p className="text-[10px] font-medium text-slate-700 uppercase">{t("adminMisc.programDetail.noTasks")}</p>}
                                </div>
                             </div>
                          </div>

                          {/* REPORT CONTENT */}
                          <WeekReports reports={weekReports} t={t} />

                          {/* FOLLOW-UPS (ADMIN COMMENTS) */}
                          <div className="mt-10 pt-10 border-t border-white/5 space-y-6">
                             <div className="flex items-center justify-between">
                                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.adminComments")}</h5>
                                <button 
                                   onClick={() => setNewFollowup({ week: weekNumber, comment: '' })}
                                   className="text-[10px] font-bold text-[#FF6600] uppercase tracking-wide hover:text-white transition-colors"
                                >
                                   + {t("adminMisc.programDetail.addComment")}
                                </button>
                             </div>

                             <div className="space-y-4">
                                {weekFollowups.map((followup, followupIndex) => (
                                   <div key={`wf-${followup.id || followupIndex}-${followupIndex}`} className="p-5 rounded-2xl bg-[#FF6600]/5 border border-[#FF6600]/10 flex gap-4">
                                      <div className="w-8 h-8 rounded-lg bg-[#FF6600]/20 flex items-center justify-center text-[#FF6600] shrink-0">
                                         <Users className="w-4 h-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                         <p className="text-xs text-white font-bold">{followup.comment}</p>
                                         <p className="text-[10px] font-bold text-[#FF6600]/50 uppercase mt-2">{new Date(followup.created_at).toLocaleString()}</p>
                                      </div>
                                   </div>
                                ))}

                                {newFollowup.week === weekNumber && (
                                   <motion.div 
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="space-y-4"
                                   >
                                      <textarea 
                                         value={newFollowup.comment}
                                         onChange={event => setNewFollowup({...newFollowup, comment: event.target.value})}
                                         placeholder={t("adminMisc.programDetail.commentPlaceholder")}
                                         className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm font-bold text-white outline-none focus:border-[#FF6600]/50 transition-all resize-none"
                                         rows={3}
                                      />
                                      <div className="flex justify-end gap-3">
                                         <button 
                                            onClick={() => setNewFollowup({ week: null, comment: '' })}
                                            className="px-6 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide"
                                         >
                                            {t("adminMisc.programDetail.cancel")}
                                         </button>
                                         <button 
                                            disabled={isSubmitting || !newFollowup.comment.trim()}
                                            onClick={() => handleAddFollowup(weekNumber)}
                                            className="px-6 py-2 bg-[#FF6600] text-black text-sm font-bold uppercase tracking-wide rounded-lg hover:bg-white transition-all disabled:opacity-50"
                                         >
                                            {isSubmitting ? t("adminMisc.programDetail.saving") : t("adminMisc.programDetail.postComment")}
                                         </button>
                                      </div>
                                   </motion.div>
                                )}

                                {weekFollowups.length === 0 && !newFollowup.week && (
                                   <div className="flex items-center gap-3 text-slate-700">
                                      <AlertCircle className="w-3 h-3" />
                                      <p className="text-[10px] font-bold uppercase tracking-widest">{t("adminMisc.programDetail.noComments")}</p>
                                   </div>
                                )}
                             </div>
                          </div>
                       </div>
                    </div>
                 );
              })}
           </div>
        </div>
      </div>
    </>
  );
}
