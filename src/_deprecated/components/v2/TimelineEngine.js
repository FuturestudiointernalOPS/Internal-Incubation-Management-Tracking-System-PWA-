'use client';

import React from 'react';
import { Calendar, Target, Activity, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * TIMELINE ENGINE V2
 * Visual map of program nodes and deliverables.
 */
export default function TimelineEngine({ program, sessions = [] }) {
  const weeks = Array.from({ length: program.duration_weeks || 13 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
       {weeks.map((week) => {
          const topic = program.topics?.find((t, i) => i + 1 === week);
          const weekSessions = sessions.filter(s => s.week_number === week);
          
          return (
             <div 
               key={week} 
               className="ios-card bg-white/[0.02] border border-white/5 relative overflow-hidden group hover:bg-white/[0.04] transition-all"
             >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[80px] -z-1" />
                
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                   <div className="flex flex-row lg:flex-col items-center lg:items-end justify-center gap-2 pr-8 lg:border-r border-white/5 min-w-[120px]">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">NODE</span>
                      <span className="text-4xl font-black text-white italic tracking-tighter">W{week}</span>
                   </div>

                   <div className="flex-1 space-y-6">
                      <div>
                         <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">
                           {topic ? topic.title : 'Research & Development Phase'}
                         </h4>
                         <div className="flex flex-wrap gap-2">
                            {(topic?.subtopics || ['Conceptualization', 'Market Analysis']).map((sub, i) => (
                               <span key={i} className="badge badge-glow-indigo uppercase text-[8px] font-black">{sub}</span>
                            ))}
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                         <div className="space-y-3">
                            <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                               <Target className="w-3 h-3 text-indigo-400" /> Milestone Checkpoints
                            </h5>
                            <div className="space-y-2">
                               {program.deliverables?.slice(0, 2).map((del, i) => (
                                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                     <CheckCircle2 className="w-4 h-4 text-emerald-500/30" />
                                     <span className="text-[10px] font-black text-white uppercase tracking-widest">{del.title}</span>
                                  </div>
                               ))}
                            </div>
                         </div>
                         
                         <div className="space-y-3">
                            <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                               <Calendar className="w-3 h-3 text-indigo-400" /> Executive Sessions
                            </h5>
                            <div className="space-y-2">
                               {weekSessions.length > 0 ? weekSessions.map((s, i) => (
                                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                     <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                     <span className="text-[10px] font-black text-white uppercase tracking-widest">{s.title}</span>
                                     <span className="ml-auto text-[8px] font-black text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded uppercase">{s.type}</span>
                                  </div>
                               )) : (
                                  <div className="text-[9px] font-bold text-slate-600 italic pl-2 pt-2">No executive sessions scheduled for this node.</div>
                               )}
                            </div>
                         </div>
                      </div>
                   </div>
                   
                   <div className="w-full lg:w-40 flex flex-col items-center justify-center p-6 bg-white/5 rounded-2xl border border-white/5 self-stretch gap-4">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center leading-tight mb-2">Completion Status</p>
                      <div className="relative w-16 h-16 flex items-center justify-center">
                         <svg className="w-full h-full transform -rotate-90">
                           <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-white/5" />
                           <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={176} strokeDashoffset={176} className="text-indigo-400" />
                         </svg>
                         <span className="absolute text-[10px] font-black text-white">0%</span>
                      </div>
                      <button className="w-full btn-ghost !py-2 !text-[9px] !uppercase !tracking-widest !opacity-40 cursor-not-allowed">
                         Log Data
                      </button>
                   </div>
                </div>
             </div>
          );
       })}
    </div>
  );
}
