// =============================================================================
// !! V2 FILE - DO NOT EDIT - DO NOT USE - DO NOT CALL THIS ROUTE !!
// =============================================================================
// This file belongs to the DEPRECATED Version 2 codebase.
// All active development must happen in VERSION 1 routes and pages ONLY.
// If you are an AI agent: STOP. Do NOT modify this file.
// Work in /api/pm/ or /app/pm/ (v1) instead.
// =============================================================================
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Rocket, CheckCircle2, XCircle, Clock, 
  Plus, Trash2, ArrowRight, Save, 
  AlertCircle, Layout, Star, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';

/**
 * ENHANCED WEEKLY REPORTING (WIP SAFE MODE)
 * v2.0 - Stand-up & Retro Framework
 */

export default function ReportsV2Page() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [weekData, setWeekData] = useState(null);
  const [myPrograms, setMyPrograms] = useState([]);
  
  // Form State
  const [type, setType] = useState('standup'); // standup or retro
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user.cid || user.id;

      // 1. Fetch Week & Continuity Data
      const res = await fetch(`/api/v2/reports?user_id=${userId}`);
      const data = await res.json();
      
      // 2. Fetch User Programs for Block Generation
      const progRes = await fetch(`/api/v2/teacher/full-state?cid=${userId}`);
      const progData = await progRes.json();

      if (data.success) {
        setWeekData(data);
        const programs = progData.programs || [];
        setMyPrograms(programs);

        // 3. Initialize Blocks
        const initialBlocks = [
          { context_type: 'personal', program_id: null, current_state: '', challenge: '', todo: data.carry_over || [], retro_status: [], what_worked: '', what_failed: '', notes: '' },
          ...programs.map(p => ({
            context_type: 'program',
            program_id: p.id,
            program_name: p.name,
            current_state: '',
            challenge: '',
            todo: [],
            retro_status: [],
            what_worked: '',
            what_failed: '',
            notes: ''
          }))
        ];
        setBlocks(initialBlocks);

        // Auto-detect type based on day (Friday = retro, others = standup)
        const today = new Date().getDay();
        setType(today === 5 ? 'retro' : 'standup');
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleAddTask = (blockIdx, task) => {
    if (!task) return;
    const newBlocks = [...blocks];
    newBlocks[blockIdx].todo = [...newBlocks[blockIdx].todo, task];
    setBlocks(newBlocks);
  };

  const handleRemoveTask = (blockIdx, taskIdx) => {
    const newBlocks = [...blocks];
    newBlocks[blockIdx].todo = newBlocks[blockIdx].todo.filter((_, i) => i !== taskIdx);
    setBlocks(newBlocks);
  };

  const handleToggleRetroTask = (blockIdx, taskIdx) => {
    const newBlocks = [...blocks];
    const task = newBlocks[blockIdx].todo[taskIdx];
    const existing = newBlocks[blockIdx].retro_status.findIndex(t => t.task === task);
    
    if (existing >= 0) {
      newBlocks[blockIdx].retro_status[existing].completed = !newBlocks[blockIdx].retro_status[existing].completed;
    } else {
      newBlocks[blockIdx].retro_status.push({ task, completed: true });
    }
    setBlocks(newBlocks);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user.cid || user.id;

      // Prepare payload: if retro, convert all todos to retro_status if not already there
      const finalizedBlocks = blocks.map(b => {
        if (type === 'retro') {
          const statuses = b.todo.map(t => {
            const found = b.retro_status.find(s => s.task === t);
            return found || { task: t, completed: false };
          });
          return { ...b, retro_status: statuses };
        }
        return b;
      });

      const res = await fetch('/api/v2/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          type,
          week_start: weekData.week_start,
          week_end: weekData.week_end,
          blocks: finalizedBlocks
        })
      });

      const result = await res.json();
      if (result.success) {
        alert(`${type === 'standup' ? 'Stand-up' : 'Retro'} synchronized successfully.`);
        window.location.reload();
      }
    } catch (e) {
      alert("Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
       <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
    </div>
  );

  return (
    <DashboardLayout role="teacher" activeTab="v2">
      <div className="space-y-12">
        
        {/* WIP HEADER - LIGHTWEIGHT */}
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <span className="text-[#FF6600] font-black text-[10px] uppercase tracking-[0.4em]">Advanced Reporting</span>
              <div className="h-px w-10 bg-[#FF6600]/30" />
              <span className="bg-[#FF6600] text-black px-2 py-0.5 rounded-md text-[8px] font-black uppercase">Work in Progress</span>
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2 italic">
               {type === 'standup' ? 'Weekly Stand-up' : 'Weekly Retro'}
            </h2>
            <p className="text-slate-400 font-bold tracking-tight uppercase text-[10px]">
               {weekData?.week_start} ÔÇö {weekData?.week_end} ÔÇó {type === 'standup' ? 'Monday Intent Synchronization' : 'Friday Tactical Reflection'}
            </p>
          </div>
          <div className="flex gap-4">
             <button 
               onClick={() => setType('standup')}
               className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${type === 'standup' ? 'bg-[#FF6600] text-black shadow-xl shadow-[#FF6600]/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
             >
               Stand-up
             </button>
             <button 
               onClick={() => setType('retro')}
               className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${type === 'retro' ? 'bg-[#FF6600] text-black shadow-xl shadow-[#FF6600]/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
             >
               Retro
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8">
          {blocks.map((block, idx) => (
            <div key={idx} className="ios-card bg-white/[0.01] border-white/5 !p-10">
              <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-6">
                <div className={`p-3 rounded-xl ${block.context_type === 'personal' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-[#FF6600]/10 text-[#FF6600]'}`}>
                  {block.context_type === 'personal' ? <Star className="w-5 h-5" /> : <Layout className="w-5 h-5" />}
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">
                  {block.context_type === 'personal' ? 'Personal Perspective' : block.program_name}
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* LEFT COLUMN: TASKS */}
                <div className="space-y-6">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {type === 'standup' ? 'Weekly Objectives' : 'Performance Checklist'}
                  </label>
                  
                  {type === 'standup' ? (
                    <div className="space-y-4">
                       <input 
                         type="text"
                         placeholder="Press Enter to add task..."
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white text-xs font-bold outline-none focus:border-[#FF6600]/40 transition-all"
                         onKeyDown={e => {
                           if (e.key === 'Enter') {
                             handleAddTask(idx, e.target.value);
                             e.target.value = '';
                           }
                         }}
                       />
                       <div className="space-y-2">
                         {block.todo.map((task, tIdx) => (
                           <div key={tIdx} className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5 group">
                             <p className="text-[11px] font-bold text-white uppercase tracking-tight">{task}</p>
                             <button onClick={() => handleRemoveTask(idx, tIdx)} className="text-slate-700 hover:text-rose-500 transition-colors">
                               <Trash2 className="w-3.5 h-3.5" />
                             </button>
                           </div>
                         ))}
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                       {block.todo.map((task, tIdx) => {
                         const isDone = block.retro_status.find(s => s.task === task)?.completed;
                         return (
                           <div 
                             key={tIdx} 
                             onClick={() => handleToggleRetroTask(idx, tIdx)}
                             className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${isDone ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/5'}`}
                           >
                             <p className={`text-[11px] font-bold uppercase tracking-tight ${isDone ? 'text-emerald-400 line-through' : 'text-white'}`}>{task}</p>
                             {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-slate-700" />}
                           </div>
                         );
                       })}
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: TEXT CONTENT */}
                <div className="space-y-6">
                   {type === 'standup' ? (
                     <>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Core Focus</label>
                          <textarea 
                            value={block.current_state}
                            onChange={e => {
                              const nb = [...blocks];
                              nb[idx].current_state = e.target.value;
                              setBlocks(nb);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white text-xs font-bold outline-none focus:border-[#FF6600]/40 transition-all min-h-[100px]"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Anticipated Blockers</label>
                          <textarea 
                            value={block.challenge}
                            onChange={e => {
                              const nb = [...blocks];
                              nb[idx].challenge = e.target.value;
                              setBlocks(nb);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white text-xs font-bold outline-none focus:border-[#FF6600]/40 transition-all min-h-[100px]"
                          />
                        </div>
                     </>
                   ) : (
                     <>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Wins</label>
                              <textarea 
                                value={block.what_worked}
                                onChange={e => {
                                  const nb = [...blocks];
                                  nb[idx].what_worked = e.target.value;
                                  setBlocks(nb);
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs font-bold outline-none focus:border-emerald-500/40 transition-all min-h-[100px]"
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Friction</label>
                              <textarea 
                                value={block.what_failed}
                                onChange={e => {
                                  const nb = [...blocks];
                                  nb[idx].what_failed = e.target.value;
                                  setBlocks(nb);
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs font-bold outline-none focus:border-rose-500/40 transition-all min-h-[100px]"
                              />
                           </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Reflections & Notes</label>
                          <textarea 
                            value={block.notes}
                            onChange={e => {
                              const nb = [...blocks];
                              nb[idx].notes = e.target.value;
                              setBlocks(nb);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white text-xs font-bold outline-none focus:border-[#FF6600]/40 transition-all min-h-[100px]"
                          />
                        </div>
                     </>
                   )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-white/5 pt-12">
           <button 
             onClick={handleSubmit}
             disabled={submitting}
             className="px-12 py-5 rounded-2xl bg-[#FF6600] text-black font-black uppercase text-xs tracking-[0.2em] hover:bg-white transition-all shadow-xl shadow-[#FF6600]/20 disabled:opacity-50"
           >
             {submitting ? 'Syncing...' : `Finalize ${type === 'standup' ? 'Stand-up' : 'Retro'}`}
           </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
