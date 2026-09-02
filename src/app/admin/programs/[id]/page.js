'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  Activity, Briefcase, ChevronRight, BookOpen, 
  Target, Users, Layers, MessageSquare, Clock, CheckCircle2, AlertCircle, Send,
  Link as LinkIcon, Trash2,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

export default function SuperAdminExecutiveView({ params }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  const router = useRouter();
  const { t } = useI18n();

  const [program, setProgram] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [reports, setReports] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  
  const [selectedSession, setSelectedSession] = useState(null);
  const [newFollowup, setNewFollowup] = useState({ week: null, session_id: null, comment: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingKpi, setIsEditingKpi] = useState(null);
  const [kpiForm, setKpiForm] = useState({ title: '', target_value: '' });
  // Assigned registration form (public link) - resolved from the Form assigned to the program group
  const [regForm, setRegForm] = useState(null);

  useEffect(() => {
    // Prefer the Form Run assigned directly to the Program (target_type = "program");
    // fall back to the first group-assigned run only when no program run exists.
    const pid = program?.id;
    if (pid) {
      fetch(`/api/platform/form-runs?program_id=${encodeURIComponent(String(pid))}`)
        .then((r) => r.json())
        .then((d) => {
          const run = (d.success ? d.runs || [] : []).find((x) => x.status === 'active' && x.public_slug);
          if (run) {
            setRegForm({ link: `${window.location.origin}/s/${run.public_slug}`, name: run.form_name || run.name || 'Form' });
            return;
          }
          setRegForm(null);
        })
        .catch(() => setRegForm(null));
      return;
    }
    const gid = program?.assigned_segments?.[0];
    if (!gid) { setRegForm(null); return; }
    fetch(`/api/platform/form-runs?group_id=${encodeURIComponent(String(gid))}`)
      .then((r) => r.json())
      .then((d) => {
        const run = (d.success ? d.runs || [] : []).find((x) => x.status === 'active' && x.public_slug);
        setRegForm(run ? { link: `${window.location.origin}/s/${run.public_slug}`, name: run.form_name || run.name || 'Form' } : null);
      })
      .catch(() => setRegForm(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program?.id, program?.assigned_segments]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async (bypassCache = false) => {
    const urls = [
      `/api/pm/full-state?id=${id}`,
      `/api/teacher/reports?program_id=${id}`,
      `/api/followups?program_id=${id}`,
      `/api/attendance?program_id=${id}`,
    ];
    const apply = (progData, reportData, followupData, attData) => {
      // 1. Program & Curriculum
      if (progData?.success) {
        setProgram(progData.program);
        setSessions(progData.sessions || []);
        setRequirements(progData.documents || []);
        setKpis(progData.kpis || []);
        setParticipants(progData.participants || []);
        setSubmissions(progData.submissions || []);
      }

      // 2. Weekly Reports
      if (reportData?.success) setReports(reportData.reports || []);

      // 3. Follow-ups
      if (followupData?.success) setFollowups(followupData.followups || []);

      // 4. Attendance (presence marks per session — drives the auto "Présence" task)
      if (attData?.success) setAttendance(attData.attendance || []);
    };
    let painted = false;
    try {
      // Cache-first paint: returning to this page renders instantly from fresh
      // snapshots; mutation flows pass bypassCache=true so the lists always
      // reflect the last action.
      if (!bypassCache) {
        const cached = urls.map((u) => cacheGet(u));
        if (cached.every((c) => c !== null && c.success)) {
          apply(cached[0], cached[1], cached[2], cached[3]);
          setIsLoaded(true);
          painted = true;
        }
      }
      const responses = await Promise.all(
        urls.map((u) =>
          fetch(u)
            .then((r) => r.json())
            .catch(() => ({ success: false })),
        ),
      );
      urls.forEach((u, i) => {
        if (responses[i]?.success) cacheSet(u, responses[i]);
      });
      apply(responses[0], responses[1], responses[2], responses[3]);
      setIsLoaded(true);
    } catch (e) {
      if (!painted) console.error(e);
      setIsLoaded(true);
    }
  };

  const handleAddFollowup = async (wn, sid = null) => {
    if (!newFollowup.comment.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: id,
          week_number: wn,
          session_id: sid,
          comment: newFollowup.comment
        })
      });
      if ((await res.json()).success) {
        setNewFollowup({ week: null, session_id: null, comment: '' });
        fetchData(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKpiAction = async (action, kpiId = null) => {
    setIsSubmitting(true);
    try {
      let res;
      if (action === 'create') {
        res = await fetch('/api/kpis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ program_id: id, ...kpiForm })
        });
      } else if (action === 'update') {
        res = await fetch('/api/kpis', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: kpiId, ...kpiForm })
        });
      } else if (action === 'delete') {
        res = await fetch('/api/kpis', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: kpiId })
        });
      }
      
      if (res && (await res.json()).success) {
        setKpiForm({ title: '', target_value: '' });
        setIsEditingKpi(null);
        fetchData(true);
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: action === 'create' ? t("adminMisc.programDetail.kpiCreated") : action === 'update' ? t("adminMisc.programDetail.kpiUpdated") : t("adminMisc.programDetail.kpiDeleted") } }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded || !program) return (
    <div className="min-h-screen bg-primary flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
    </div>
  );

  const totalWeeks = program.duration_weeks || 13;
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  // ── Completion rate: based on program duration (elapsed weeks ÷ total weeks) ──
  // Robust start date: explicit start_date → created_at → first session → first submission.
  const nowMs = Date.now();
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
                   <h2 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter leading-none">{program.name}</h2>
                   <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mt-2 italic">{t("adminMisc.programDetail.programOverviewLabel", { id: program.id })}</p>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-6">
             {program.assigned_segments?.length > 0 && program.assigned_segments[0] && (
                <div className="flex flex-col items-end gap-2 px-6 py-2 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                   <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest italic">{t("adminMisc.programDetail.registrationNode")}</p>
                   {regForm ? (
                      <div className="flex items-center gap-3">
                         <button 
                            onClick={() => {
                               navigator.clipboard.writeText(regForm.link);
                               window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: t("adminMisc.programDetail.urlCopied") } }));
                            }}
                            className="flex items-center gap-2 text-[10px] font-black text-white hover:text-blue-400 transition-colors uppercase italic"
                         >
                            <LinkIcon className="w-3 h-3" /> {t("adminMisc.programDetail.copyGroupUrl")}
                         </button>
                         <a
                            href={regForm.link}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[10px] font-black text-white hover:text-blue-400 transition-colors uppercase italic"
                         >
                            <ExternalLink className="w-3 h-3" /> {t("adminMisc.programDetail.openForm")}
                         </a>
                      </div>
                   ) : (
                      <div className="flex flex-col items-end gap-1">
                         <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest italic">{t("adminMisc.programDetail.noFormYet")}</p>
                         <a
                            href="/platform/forms"
                            className="text-[9px] font-black text-blue-400 hover:underline uppercase italic"
                         >
                            {t("adminMisc.programDetail.goToCrmForms")}
                         </a>
                      </div>
                   )}
                </div>
             )}
             <div className="text-right">
                <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1 italic">{t("adminMisc.programDetail.leadProgramManager")}</p>
                <p className="text-sm font-black text-[var(--text-primary)] uppercase italic">{program.pm_name || t("adminMisc.programDetail.unassigned")}</p>
             </div>
             <div className="w-px h-8 bg-white/10" />
             <div className="text-right">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 italic">{t("adminMisc.programDetail.status")}</p>
                <p className="text-sm font-black text-[#FF6600] uppercase italic">{program.status || t("adminMisc.programDetail.active")}</p>
             </div>
          </div>
        </header>

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <div className="ios-card bg-secondary border-[var(--border-primary)] !p-8 relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#FF6600]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                 <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-4 italic flex items-center gap-2">
                    {t("adminMisc.programDetail.completionRate")}
                    <AlertCircle className="w-3 h-3 text-[var(--text-secondary)] cursor-help" title={t("adminMisc.programDetail.completionRateTooltip")} />
                 </p>
                 <h4 className="text-3xl font-black text-[var(--text-primary)] italic">{durationCompletion.toFixed(1)}%</h4>
                 <p className="text-[7px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mt-3 italic leading-relaxed">
                    {t("adminMisc.programDetail.overallProgress")}
                 </p>
              </div>
           </div>
           <div className="ios-card bg-secondary border-[var(--border-primary)] !p-8">
              <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-4 italic">{t("adminMisc.programDetail.weeksElapsed")}</p>
              <h4 className="text-3xl font-black text-[var(--text-primary)] italic">{elapsedWeeksShown}/{totalWeeks}</h4>
           </div>
           <div className="ios-card bg-white/[0.02] border-white/5 !p-8">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 italic">{t("adminMisc.programDetail.weeklyReports")}</p>
              <h4 className="text-3xl font-black text-[#FF6600] italic">{t("adminMisc.programDetail.reportLogs", { count: reports.length })}</h4>
           </div>
           <div className="ios-card bg-[#FF6600]/5 border-[#FF6600]/20 !p-8">
              <p className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest mb-4 italic">{t("adminMisc.programDetail.adminComments")}</p>
              <h4 className="text-3xl font-black text-white italic">{followups.length}</h4>
           </div>
        </div>

        {/* PROGRAM INFRASTRUCTURE & KPI MANAGEMENT */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* KPI MANAGEMENT */}
           <div className="ios-card bg-secondary border-[var(--border-primary)] !p-10 space-y-8">
              <div className="flex justify-between items-start">
                 <div>
                    <div className="flex items-center gap-3">
                       <Target className="w-5 h-5 text-[#FF6600]" />
                       <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">{t("adminMisc.programDetail.strategicKpis")}</h3>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 max-w-md">
                       {t("adminMisc.programDetail.kpiDescription")}
                    </p>
                 </div>
                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic mt-2">{t("adminMisc.programDetail.definedBySuperAdmin")}</p>
              </div>

              <div className="space-y-4">
                 {kpis.map(kpi => (
                    <div key={kpi.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-[#FF6600]/30 transition-all">
                       <div className="flex flex-col text-left">
                          <p className="text-xs font-black text-white uppercase tracking-tighter">{kpi.title}</p>
                          <p className="text-[8px] font-black text-[#FF6600] uppercase tracking-widest mt-1">{t("adminMisc.programDetail.targetLabel", { value: kpi.target_value })}</p>
                       </div>
                       <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                             onClick={() => { setIsEditingKpi(kpi.id); setKpiForm({ title: kpi.title, target_value: kpi.target_value }); }}
                             className="p-2 hover:text-[#FF6600] transition-colors"
                          >
                             <Activity className="w-3.5 h-3.5" />
                          </button>
                          <button 
                             onClick={() => handleKpiAction('delete', kpi.id)}
                             className="p-2 hover:text-rose-500 transition-colors"
                          >
                             <Trash2 className="w-3.5 h-3.5" />
                          </button>
                       </div>
                    </div>
                 ))}

                 <div className="pt-6 border-t border-white/5 space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{isEditingKpi ? t("adminMisc.programDetail.editStrategicKpi") : t("adminMisc.programDetail.defineNewKpi")}</h4>
                    <div className="grid grid-cols-2 gap-4">
                       <input 
                          type="text"
                          placeholder={t("adminMisc.programDetail.kpiTitlePlaceholder")}
                          value={kpiForm.title}
                          onChange={e => setKpiForm({...kpiForm, title: e.target.value})}
                          className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#FF6600]/50 transition-all"
                       />
                       <input 
                          type="text"
                          placeholder={t("adminMisc.programDetail.targetPlaceholder")}
                          value={kpiForm.target_value}
                          onChange={e => setKpiForm({...kpiForm, target_value: e.target.value})}
                          className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#FF6600]/50 transition-all"
                       />
                    </div>
                    <div className="flex justify-end gap-3">
                       {isEditingKpi && (
                          <button onClick={() => { setIsEditingKpi(null); setKpiForm({ title: '', target_value: '' }); }} className="text-[9px] font-black text-slate-500 uppercase italic">{t("adminMisc.programDetail.cancel")}</button>
                       )}
                       <button 
                          onClick={() => handleKpiAction(isEditingKpi ? 'update' : 'create', isEditingKpi)}
                          disabled={isSubmitting || !kpiForm.title || !kpiForm.target_value}
                          className="px-6 py-2 bg-[#FF6600] text-black text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-white transition-all disabled:opacity-50"
                       >
                          {isSubmitting ? '...' : isEditingKpi ? t("adminMisc.programDetail.updateKpi") : t("adminMisc.programDetail.deployKpi")}
                       </button>
                    </div>
                 </div>
              </div>
           </div>

           {/* KNOWLEDGE BASE OVERVIEW */}
           <div className="ios-card bg-secondary border-[var(--border-primary)] !p-10 space-y-8">
              <div className="flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">{t("adminMisc.programDetail.knowledgeInfrastructure")}</h3>
                 </div>
              </div>

              <div className="space-y-6">
                 {program.note_title ? (
                    <div className="space-y-6">
                       <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-3xl text-left">
                          <h4 className="text-lg font-black text-white uppercase italic tracking-tighter mb-2">{program.note_title}</h4>
                          <p className="text-xs text-slate-400 font-bold leading-relaxed">{program.note_description || t("adminMisc.programDetail.knowledgeAssetFallback")}</p>
                       </div>
                       
                       <div className="space-y-4">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic text-left">{t("adminMisc.programDetail.attachedFiles")}</p>
                          <div className="grid grid-cols-1 gap-3">
                             {program.knowledge_assets?.map((asset, idx) => (
                                <a 
                                   key={idx} 
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
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.noKnowledgeBase")}</p>
                    </div>
                 )}
              </div>
           </div>
        </div>

        {/* STRATEGIC TIMELINE */}
        <div className="space-y-12">
           <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-slate-700" />
              <h3 className="text-xl font-black text-white uppercase tracking-widest italic">{t("adminMisc.programDetail.programSchedule")}</h3>
           </div>

           <div className="space-y-8 relative">
              <div className="absolute left-[27px] top-0 bottom-0 w-px bg-white/5" />
              
              {weeks.map(wn => {
                 const weekReports = reports.filter(r => r.week_number === wn);
                 const weekFollowups = followups.filter(f => f.week_number === wn);
                 const weekSessions = sessions.filter(s => s.week_number === wn);
                 const weekDocs = requirements.filter(r => r.session_id && weekSessions.map(s => s.id).includes(r.session_id));

                 // Week completion = % of unique participants who completed the
                 // week (valid submission OR presence) vs total participants.
                 const weekSessionIds = weekSessions.map((s) => String(s.id));
                 const weekDocIds = weekDocs.map((d) => String(d.id));
                 const weekSubmitters = new Set(
                   submissions
                     .filter(
                       (s) =>
                         (weekDocIds.includes(String(s.document_id)) ||
                          weekDocIds.includes(String(s.deliverable_id))) &&
                         s.status !== "rejected" &&
                         s.participant_id != null,
                     )
                     .map((s) => String(s.participant_id)),
                 );
                 const weekPresentCount = attendance.filter(
                   (a) =>
                     weekSessionIds.includes(String(a.session_id)) &&
                     a.status === "present",
                 ).length;
                 const weekPresentIds = new Set(
                   attendance
                     .filter(
                       (a) =>
                         weekSessionIds.includes(String(a.session_id)) &&
                         a.status === "present" &&
                         a.participant_id != null,
                     )
                     .map((a) => String(a.participant_id)),
                 );
                 const weekCompleters = new Set([
                   ...weekSubmitters,
                   ...weekPresentIds,
                 ]);
                 const weekProgress =
                   participants.length > 0
                     ? Math.min(100, (weekCompleters.size / participants.length) * 100)
                     : 0;

                 const isCompleted = weekSessions.length > 0 && weekSessions.every(s => s.status === 'completed');

                 return (
                    <div key={`week-${wn}`} className="relative pl-16">
                       {/* DOT */}
                       <div className={`absolute left-0 top-0 w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all ${
                          weekReports.length > 0 ? 'bg-[#FF6600] border-[#FF6600] text-black shadow-[0_0_20px_rgba(255,102,0,0.3)]' : 'bg-primary border-[var(--border-primary)] text-[var(--text-secondary)]'
                       }`}>
                          <span className="text-lg font-black">{wn}</span>
                       </div>

                       <div className="ios-card bg-secondary border-[var(--border-primary)] !p-10 hover:bg-tertiary transition-all text-left space-y-10">
                          <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                             <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-3">
                                   <h4 className="text-2xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">
                                      {weekSessions[0]?.title || t("adminMisc.programDetail.weekActivities", { week: wn })}
                                   </h4>
                                   {isCompleted && <CheckCircle2 className="w-5 h-5 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" />}
                                </div>
                                
                                {/* WEEKLY PROGRESS BAR */}
                                <div className="space-y-3 max-w-md">
                                   <div className="flex justify-between items-end">
                                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">{t("adminMisc.programDetail.weekCompletion")}</p>
                                      <p className="text-[10px] font-black text-[#FF6600] italic">{weekProgress.toFixed(0)}%</p>
                                   </div>
                                   <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                      <motion.div 
                                         initial={{ width: 0 }}
                                         animate={{ width: `${weekProgress}%` }}
                                         className={`h-full bg-gradient-to-r ${weekProgress === 100 ? 'from-emerald-500 to-emerald-400' : 'from-[#FF6600] to-[#FF9900]'}`}
                                      />
                                   </div>
                                   <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest italic">
                                      {t("adminMisc.programDetail.participantsCompleted", { count: weekCompleters.size, total: participants.length })}
                                   </p>
                                </div>
                             </div>

                             <div className="flex flex-col lg:flex-row gap-4">
                                <div className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border flex items-center gap-2 ${
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
                                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.activities")}</p>
                                </div>
                                <div className="space-y-3">
                                   {weekSessions.map((session, sIdx) => {
                                      const sessionFollowups = followups.filter(f => f.session_id === session.id);
                                      let materials = [];
                                      try {
                                        materials = session.resource_links ? JSON.parse(session.resource_links) : [];
                                      } catch (e) {
                                        console.error("Failed to parse resource links:", e);
                                        materials = [];
                                      }                                      
                                      return (
                                         <div key={`session-${session.id || sIdx}-${sIdx}`} className="space-y-2">
                                            <div 
                                               onClick={() => setSelectedSession(selectedSession === session.id ? null : session.id)}
                                               className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-[#FF6600]/30 cursor-pointer transition-all"
                                            >
                                               <div className="flex items-center gap-4 text-left">
                                                  <div className={`w-2 h-2 rounded-full ${session.status === 'completed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : session.status === 'in progress' ? 'bg-amber-500' : 'bg-slate-800'}`} />
                                                  <div className="flex flex-col">
                                                     <p className="text-xs font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{session.title}</p>
                                                     <p className="text-[7px] font-black text-[#FF6600] uppercase tracking-widest">{t("adminMisc.programDetail.assignmentStyle", { type: session.assignment_type || t("adminMisc.programDetail.workshop") })}</p>
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
                                                           <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.activityGoal")}</p>
                                                           <p className="text-xs text-slate-300 font-bold leading-relaxed">{session.description || t("adminMisc.programDetail.noActivityGoal")}</p>
                                                        </div>

                                                        {materials.length > 0 && (
                                                           <div className="space-y-3">
                                                              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.lessonMaterials")}</p>
                                                              <div className="flex flex-wrap gap-2">
                                                                 {materials.map((m, mIdx) => (
                                                                    <a key={`material-${mIdx}`} href={m.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-[9px] font-black text-[#FF6600] uppercase tracking-widest hover:bg-[#FF6600] hover:text-black transition-all">
                                                                       {m.title || t("adminMisc.programDetail.resourceLink")}
                                                                    </a>
                                                                 ))}
                                                              </div>
                                                           </div>
                                                        )}

                                                        {/* SESSION FEEDBACK */}
                                                        <div className="pt-4 border-t border-white/5 space-y-4">
                                                           <div className="flex justify-between items-center">
                                                              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.activityFeedback")}</p>
                                                              <button 
                                                                 onClick={() => setNewFollowup({ week: wn, session_id: session.id, comment: '' })}
                                                                 className="text-[8px] font-black text-[#FF6600] uppercase tracking-widest"
                                                              >
                                                                 + {t("adminMisc.programDetail.leaveComment")}
                                                              </button>
                                                           </div>

                                                           <div className="space-y-2">
                                                              {sessionFollowups.map((f, fIdx) => (
                                                                 <div key={`sf-${f.id || fIdx}-${fIdx}`} className="p-3 rounded-xl bg-[#FF6600]/5 border border-[#FF6600]/10 flex gap-3">
                                                                    <div className="w-6 h-6 rounded-lg bg-[#FF6600]/20 flex items-center justify-center text-[#FF6600] shrink-0">
                                                                       <Target className="w-3 h-3" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                       <p className="text-[10px] text-white font-bold">{f.comment}</p>
                                                                    </div>
                                                                 </div>
                                                              ))}
                                                           </div>

                                                           {newFollowup.session_id === session.id && (
                                                              <div className="space-y-3 mt-4">
                                                                 <textarea 
                                                                    value={newFollowup.comment}
                                                                    onChange={e => setNewFollowup({...newFollowup, comment: e.target.value})}
                                                                    placeholder={t("adminMisc.programDetail.feedbackPlaceholder")}
                                                                    className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[#FF6600]/50 transition-all resize-none"
                                                                    rows={2}
                                                                 />
                                                                 <div className="flex justify-end gap-2">
                                                                    <button onClick={() => setNewFollowup({ week: null, session_id: null, comment: '' })} className="px-4 py-1.5 text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("adminMisc.programDetail.cancel")}</button>
                                                                    <button 
                                                                       disabled={isSubmitting || !newFollowup.comment.trim()}
                                                                       onClick={() => handleAddFollowup(wn, session.id)}
                                                                       className="px-4 py-1.5 bg-[#FF6600] text-black text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-white transition-all"
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
                                   {weekSessions.length === 0 && <p className="text-[9px] font-bold text-slate-700 uppercase italic">{t("adminMisc.programDetail.noActivities")}</p>}
                                </div>
                             </div>

                             {/* ASSETS */}
                             <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                   <Layers className="w-3.5 h-3.5 text-slate-600" />
                                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.requiredTasks")}</p>
                                </div>
                                <div className="space-y-3">
                                   {weekDocs.map((doc, dIdx) => (
                                      <div key={`doc-${doc.id || dIdx}-${dIdx}`} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                         <div className="flex items-center gap-4">
                                            <CheckCircle2 className={`w-4 h-4 ${doc.is_completed ? 'text-emerald-500' : 'text-slate-800'}`} />
                                            <p className="text-xs font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{doc.title}</p>
                                         </div>
                                         <span className={`text-[8px] font-black uppercase tracking-widest ${doc.is_completed ? 'text-emerald-500' : 'text-slate-600'}`}>{doc.is_completed ? t("adminMisc.programDetail.done") : t("adminMisc.programDetail.pending")}</span>
                                      </div>
                                   ))}
                                   {/* Auto-added presence task for weeks with scheduled sessions */}
                                   {weekSessionIds.length > 0 && (
                                      <div key={`presence-${wn}`} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                         <div className="flex items-center gap-4">
                                            <CheckCircle2 className={`w-4 h-4 ${weekPresentCount > 0 ? 'text-emerald-500' : 'text-slate-800'}`} />
                                            <p className="text-xs font-black text-white uppercase tracking-tighter truncate max-w-[200px]">{t("pmMisc.workspace.attendance")}</p>
                                         </div>
                                         <span className={`text-[8px] font-black uppercase tracking-widest ${weekPresentCount > 0 ? 'text-emerald-500' : 'text-slate-600'}`}>{weekPresentCount > 0 ? t("adminMisc.programDetail.done") : t("adminMisc.programDetail.pending")}</span>
                                      </div>
                                   )}
                                   {weekDocs.length === 0 && weekSessionIds.length === 0 && <p className="text-[9px] font-bold text-slate-700 uppercase italic">{t("adminMisc.programDetail.noTasks")}</p>}
                                </div>
                             </div>
                          </div>

                          {/* REPORT CONTENT */}
                          {(weekReports.length > 0) && (
                             <div className="mt-10 space-y-6">
                                {weekReports.map((report, rIdx) => (
                                   <div key={`report-${report.id || rIdx}`} className="p-8 rounded-3xl bg-white/[0.03] border border-white/5 space-y-6">
                                      <div className="flex items-center justify-between">
                                         <div className="flex items-center gap-3">
                                            <MessageSquare className={`w-4 h-4 ${report.report_type === 'pm' ? 'text-[var(--brand-orange)]' : 'text-emerald-500'}`} />
                                            <p className="text-[10px] font-black text-white uppercase tracking-widest">
                                               {report.report_type === 'pm' ? t("adminMisc.programDetail.pmIntelligenceReport") : t("adminMisc.programDetail.instructorProgressReport")}
                                            </p>
                                         </div>
                                         <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest italic">
                                            {t("adminMisc.programDetail.submittedBy", { name: report.teacher_name || report.instructor_name })}
                                         </span>
                                      </div>
                                      
                                      {report.report_type === 'pm' ? (
                                         <div className="space-y-4">
                                            <div className="flex items-center gap-2">
                                               <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${report.status === 'on-track' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                  {report.status}
                                               </span>
                                            </div>
                                            <p className="text-sm text-slate-200 font-bold leading-relaxed">{report.summary}</p>
                                         </div>
                                      ) : (
                                         <div className="space-y-6">
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                               {report.week_status && (
                                                  <div className="space-y-1">
                                                     <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.weekStatus")}</p>
                                                     <span className="inline-block px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider bg-white/5 border border-white/10">{report.week_status.replace(/_/g, ' ')}</span>
                                                  </div>
                                               )}
                                               {report.week_rating && (
                                                  <div className="space-y-1">
                                                     <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.weekRating")}</p>
                                                     <span className="inline-block px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider bg-white/5 border border-white/10">{report.week_rating}</span>
                                                  </div>
                                               )}
                                               {report.main_topic && (
                                                  <div className="space-y-1">
                                                     <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.mainTopic")}</p>
                                                     <p className="text-xs font-bold text-white">{report.main_topic}</p>
                                                  </div>
                                               )}
                                               {report.reception_score != null && (
                                                  <div className="space-y-1">
                                                     <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.receptionScore")}</p>
                                                     <span className="inline-block px-2 py-1 rounded text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">{report.reception_score}/10</span>
                                                  </div>
                                               )}
                                            </div>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                               <div className="space-y-2">
                                                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.progressNotes")}</p>
                                                  <p className="text-sm text-slate-200 font-bold leading-relaxed">{report.progress_notes || '—'}</p>
                                               </div>
                                               <div className="space-y-2">
                                                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.actionPlan")}</p>
                                                  <p className="text-sm text-slate-200 font-bold leading-relaxed">{report.action_taken || '—'}</p>
                                               </div>
                                            </div>
                                            {(report.attendance_level || report.participation_level) && (
                                               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                                                  {report.attendance_level && (
                                                     <div className="space-y-1">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.attendance")}</p>
                                                        <span className="text-xs font-bold text-white">{report.attendance_level}</span>
                                                     </div>
                                                  )}
                                                  {report.participation_level && (
                                                     <div className="space-y-1">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.participation")}</p>
                                                        <span className="text-xs font-bold text-white">{report.participation_level}</span>
                                                     </div>
                                                  )}
                                                  {report.program_on_track != null && (
                                                     <div className="space-y-1">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.programOnTrack")}</p>
                                                        <span className={`text-xs font-bold ${report.program_on_track ? 'text-emerald-400' : 'text-rose-400'}`}>{report.program_on_track ? t("adminMisc.programDetail.yes") : t("adminMisc.programDetail.no")}</span>
                                                     </div>
                                                  )}
                                               </div>
                                            )}
                                         </div>
                                      )}
                                   </div>
                                ))}
                             </div>
                          )}

                          {/* FOLLOW-UPS (ADMIN COMMENTS) */}
                          <div className="mt-10 pt-10 border-t border-white/5 space-y-6">
                             <div className="flex items-center justify-between">
                                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.programDetail.adminComments")}</h5>
                                <button 
                                   onClick={() => setNewFollowup({ week: wn, comment: '' })}
                                   className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest hover:text-white transition-colors"
                                >
                                   + {t("adminMisc.programDetail.addComment")}
                                </button>
                             </div>

                             <div className="space-y-4">
                                {weekFollowups.map((f, wfIdx) => (
                                   <div key={`wf-${f.id || wfIdx}-${wfIdx}`} className="p-5 rounded-2xl bg-[#FF6600]/5 border border-[#FF6600]/10 flex gap-4">
                                      <div className="w-8 h-8 rounded-lg bg-[#FF6600]/20 flex items-center justify-center text-[#FF6600] shrink-0">
                                         <Users className="w-4 h-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                         <p className="text-xs text-white font-bold">{f.comment}</p>
                                         <p className="text-[8px] font-black text-[#FF6600]/50 uppercase mt-2">{new Date(f.created_at).toLocaleString()}</p>
                                      </div>
                                   </div>
                                ))}

                                {newFollowup.week === wn && (
                                   <motion.div 
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="space-y-4"
                                   >
                                      <textarea 
                                         value={newFollowup.comment}
                                         onChange={e => setNewFollowup({...newFollowup, comment: e.target.value})}
                                         placeholder={t("adminMisc.programDetail.commentPlaceholder")}
                                         className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm font-bold text-white outline-none focus:border-[#FF6600]/50 transition-all resize-none"
                                         rows={3}
                                      />
                                      <div className="flex justify-end gap-3">
                                         <button 
                                            onClick={() => setNewFollowup({ week: null, comment: '' })}
                                            className="px-6 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest"
                                         >
                                            {t("adminMisc.programDetail.cancel")}
                                         </button>
                                         <button 
                                            disabled={isSubmitting || !newFollowup.comment.trim()}
                                            onClick={() => handleAddFollowup(wn)}
                                            className="px-6 py-2 bg-[#FF6600] text-black text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-white transition-all disabled:opacity-50"
                                         >
                                            {isSubmitting ? t("adminMisc.programDetail.saving") : t("adminMisc.programDetail.postComment")}
                                         </button>
                                      </div>
                                   </motion.div>
                                )}

                                {weekFollowups.length === 0 && !newFollowup.week && (
                                   <div className="flex items-center gap-3 text-slate-700">
                                      <AlertCircle className="w-3 h-3" />
                                      <p className="text-[9px] font-black uppercase italic tracking-widest">{t("adminMisc.programDetail.noComments")}</p>
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
