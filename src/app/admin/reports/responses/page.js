'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, Calendar, User, FileText, Search, 
  Filter, CheckCircle2, AlertCircle, Clock, 
  ArrowLeft, Download, Eye, ExternalLink, ChevronRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { TableSkeleton } from '@/components/ui/Skeleton';

/**
 * IMPACTOS REPORT RESPONSES HUB
 * Centralized intelligence feed for weekly program reports.
 */

export default function ReportResponses() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('All Programs');
  const [viewingReport, setViewingReport] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [repRes, progRes] = await Promise.all([
        fetch('/api/teacher/reports'),
        fetch('/api/v2/pm/programs')
      ]);
      const [repData, progData] = await Promise.all([repRes.json(), progRes.json()]);

      if (repData.success) setReports(repData.reports || []);
      if (progData.success) setPrograms(progData.programs || []);
    } catch (e) {
      console.error("Sync Error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredReports = reports.filter(r => {
    const matchesSearch = r.teacher_name?.toLowerCase().includes(search.toLowerCase()) || 
                          r.progress_notes?.toLowerCase().includes(search.toLowerCase());
    const programName = programs.find(p => p.id === r.program_id)?.name || 'Unknown Program';
    const matchesProgram = selectedProgram === 'All Programs' || programName === selectedProgram;
    return matchesSearch && matchesProgram;
  });

  return (
    <DashboardLayout role="super_admin" activeTab="reports">
      <div className="space-y-10 pb-20 animate-in text-left">
        
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
          <div className="space-y-4">
            <button 
              onClick={() => router.push('/admin')}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Dashboard
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.4em]">Intelligence Feed</span>
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-[var(--text-primary)] uppercase">Report Responses</h1>
            </div>
          </div>
          
          <div className="flex gap-3">
             <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl px-8 flex flex-col justify-center shadow-sm">
                <span className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">Total Signals</span>
                <span className="text-[var(--text-primary)] font-black text-2xl leading-none tracking-tighter">{filteredReports.length}</span>
             </div>
          </div>
        </header>

        {/* FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Search notes or authors..." 
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
              />
           </div>
           
           <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select 
                value={selectedProgram}
                onChange={e => setSelectedProgram(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
              >
                 <option>All Programs</option>
                 {programs.map(p => <option key={p.id}>{p.name}</option>)}
              </select>
           </div>
        </div>

        {/* REPORTS FEED */}
        <div className="space-y-4">
           {loading ? (
             <TableSkeleton rows={8} />
           ) : filteredReports.length === 0 ? (
             <div className="card py-32 flex flex-col items-center justify-center text-center opacity-40 border-dashed">
                <FileText className="w-16 h-16 mb-4" />
                <p className="text-[10px] font-bold uppercase tracking-widest">No Intelligence Signals Recorded</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-4">
                {filteredReports.map(report => {
                   const prog = programs.find(p => p.id === report.program_id);
                   return (
                      <div 
                        key={report.id} 
                        className="card group hover:border-[var(--brand-orange)] transition-all bg-[var(--bg-secondary)]/50 cursor-pointer"
                        onClick={() => setViewingReport(report)}
                      >
                         <div className="flex flex-col md:flex-row justify-between gap-6">
                            <div className="flex gap-5">
                               <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-secondary)] flex flex-col items-center justify-center group-hover:border-[var(--brand-orange)]/50 transition-colors">
                                  <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase">Wk</span>
                                  <span className="text-xl font-bold text-[var(--text-primary)] leading-none">{report.week_number}</span>
                               </div>
                               <div className="space-y-1">
                                  <h4 className="text-sm font-bold uppercase tracking-tight text-[var(--text-primary)]">{prog?.name || 'Program Asset'}</h4>
                                  <div className="flex items-center gap-3 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest opacity-60">
                                     <User className="w-3 h-3" /> {report.teacher_name}
                                     <span className="w-1 h-1 rounded-full bg-slate-700" />
                                     <Clock className="w-3 h-3" /> {new Date(report.created_at).toLocaleDateString()}
                                  </div>
                               </div>
                            </div>
                            
                            <div className="flex items-center gap-8">
                               <div className="text-center">
                                  <p className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-1">Reception</p>
                                  <div className="flex gap-1 justify-center">
                                     {[...Array(10)].map((_, i) => (
                                        <div key={i} className={`w-1 h-3 rounded-full ${i < report.reception_score ? 'bg-emerald-500' : 'bg-[var(--bg-tertiary)] opacity-30'}`} />
                                     ))}
                                  </div>
                               </div>
                               <div className="flex items-center gap-3">
                                  <button className="btn btn-secondary !p-3 rounded-xl border-[var(--border-primary)] group-hover:border-[var(--brand-orange)]">
                                     <Eye className="w-4 h-4" />
                                  </button>
                               </div>
                            </div>
                         </div>
                         
                         <div className="mt-6 pt-6 border-t border-[var(--border-secondary)]">
                            <p className="text-xs font-medium text-[var(--text-secondary)] line-clamp-2 italic leading-relaxed">
                               "{report.progress_notes}"
                            </p>
                         </div>
                      </div>
                   );
                })}
             </div>
           )}
        </div>
      </div>

      {/* DETAIL MODAL */}
      {viewingReport && (
         <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <div className="card w-full max-w-2xl space-y-8 border-[var(--brand-orange)]/30 animate-in text-left overflow-y-auto max-h-[90vh]">
               <div className="flex justify-between items-start">
                  <div>
                     <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-[0.4em]">Report Detail · Week {viewingReport.week_number}</span>
                     <h3 className="text-2xl font-bold text-white uppercase tracking-tight mt-1">{programs.find(p => p.id === viewingReport.program_id)?.name}</h3>
                  </div>
                  <button onClick={() => setViewingReport(null)} className="p-2 hover:bg-[var(--bg-primary)] rounded-lg"><X className="w-6 h-6" /></button>
               </div>

               <div className="grid grid-cols-2 gap-8 border-y border-[var(--border-primary)] py-8">
                  <div className="space-y-1">
                     <p className="text-[10px] font-bold text-slate-500 uppercase">Field Officer</p>
                     <p className="text-sm font-bold text-white uppercase tracking-wide">{viewingReport.teacher_name}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-bold text-slate-500 uppercase">Sync Timestamp</p>
                     <p className="text-sm font-bold text-white uppercase tracking-wide">{new Date(viewingReport.created_at).toLocaleString()}</p>
                  </div>
               </div>

               <div className="space-y-6">
                  <section className="space-y-3">
                     <h5 className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-widest flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Strategic Progress Notes
                     </h5>
                     <div className="p-5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-2xl">
                        <p className="text-xs font-medium text-slate-300 leading-relaxed italic">"{viewingReport.progress_notes}"</p>
                     </div>
                  </section>

                  <section className="space-y-3">
                     <h5 className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-3 h-3" /> Immediate Action Taken
                     </h5>
                     <div className="p-5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-2xl">
                        <p className="text-xs font-medium text-slate-300 leading-relaxed italic">"{viewingReport.action_taken || 'No immediate intervention required.'}"</p>
                     </div>
                  </section>

                  <section className="space-y-3">
                     <h5 className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp className="w-3 h-3" /> Student Reception Dynamics
                     </h5>
                     <div className="p-5 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-2xl">
                        <p className="text-xs font-medium text-slate-300 leading-relaxed italic">"{viewingReport.student_reception || 'Standard engagement levels observed.'}"</p>
                     </div>
                  </section>
               </div>

               <button 
                 onClick={() => setViewingReport(null)}
                 className="btn btn-primary w-full py-5 font-bold uppercase tracking-widest"
               >
                  Close Intel Feed
               </button>
            </div>
         </div>
      )}

    </DashboardLayout>
  );
}

// Minimal missing icons
function X({ className }) { return <XCircle className={className} />; }
function Activity({ className }) { return <ShieldCheck className={className} />; }
function Zap({ className }) { return <ArrowRight className={className} />; }
function TrendingUp({ className }) { return <TrendingUpIcon className={className} />; }
function TrendingUpIcon({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>; }
function XCircle({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>; }
function ShieldCheck({ className }) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>; }
