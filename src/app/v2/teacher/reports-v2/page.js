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
      <div className="max-w-5xl mx-auto space-y-12 pb-40">
        
        {/* WIP SAFE LAYER LABEL */}
        <div className="flex items-center justify-between bg-[#FF6600]/10 border border-[#FF6600]/20 p-6 rounded-[2rem]">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-[#FF6600] text-black animate-pulse">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-[#FF6600] uppercase tracking-widest leading-none">Safe Mode Active</p>
              <h4 className="text-xl font-black text-white uppercase tracking-tighter">Work in Progress (WIP)</h4>
            </div>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Operational Week</p>
             <p className="text-sm font-black text-white uppercase italic">{weekData?.week_start} — {weekData?.week_end}</p>
          </div>
        </div>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <h2 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
              Weekly {type === 'standup' ? 'Stand-up' : 'Retro'}
            </h2>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] italic">
              {type === 'standup' ? 'Monday Intelligence Synchronization' : 'Friday Tactical Reflection'}
            </p>
          </div>
          <div className="flex bg-white/5 p-2 rounded-2xl border border-white/5">
             <button 
               onClick={() => setType('standup')}
               className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === 'standup' ? 'bg-[#FF6600] text-black' : 'text-slate-500 hover:text-white'}`}
             >
               Stand-up
             </button>
             <button 
               onClick={() => setType('retro')}
               className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === 'retro' ? 'bg-[#FF6600] text-black' : 'text-slate-500 hover:text-white'}`}
             >
               Retro
             </button>
          </div>
        </header>

        <div className="space-y-10">
          {blocks.map((block, idx) => (
            <section key={idx} className="ios-card bg-white/[0.01] border-white/5 !p-12 group hover:border-[#FF6600]/20 transition-all">
              <div className="flex items-center gap-6 mb-12">
                <div className={`p-4 rounded-2xl ${block.context_type === 'personal' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-[#FF6600]/10 text-[#FF6600]'}`}>
                  {block.context_type === 'personal' ? <Star className="w-6 h-6" /> : <Layout className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">
                    {block.context_type === 'personal' ? 'Identity Perspective' : 'Program Vector'}
                  </p>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">
                    {block.context_type === 'personal' ? 'Personal Stand-up' : block.program_name}
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Target className="w-3 h-3 text-[#FF6600]" /> Objectives & Intent
                    </label>
                    {type === 'standup' ? (
                      <div className="space-y-4">
                         <div className="flex gap-2">
                           <input 
                             type="text"
                             placeholder="Add tactical task..."
                             className="flex-1 bg-white/5 border border-white/10 rounded-xl px-6 py-4 text-white text-sm font-bold outline-none focus:border-[#FF6600]/40 transition-all"
                             onKeyDown={e => {
                               if (e.key === 'Enter') {
                                 handleAddTask(idx, e.target.value);
                                 e.target.value = '';
                               }
                             }}
                           />
                         </div>
                         <div className="space-y-2">
                           {block.todo.map((task, tIdx) => (
                             <div key={tIdx} className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5 group/task">
                               <p className="text-xs font-bold text-white uppercase tracking-tight italic">{task}</p>
                               <button onClick={() => handleRemoveTask(idx, tIdx)} className="text-slate-700 hover:text-rose-500 transition-colors opacity-0 group-hover/task:opacity-100">
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                             </div>
                           ))}
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                         {block.todo.map((task, tIdx) => {
                           const isDone = block.retro_status.find(s => s.task === task)?.completed;
                           return (
                             <div 
                               key={tIdx} 
                               onClick={() => handleToggleRetroTask(idx, tIdx)}
                               className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${isDone ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}
                             >
                               <p className={`text-xs font-bold uppercase tracking-tight italic ${isDone ? 'text-emerald-400 line-through' : 'text-white'}`}>{task}</p>
                               {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-slate-700" />}
                             </div>
                           );
                         })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-10">
                   {type === 'standup' ? (
                     <>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current State / Focus</label>
                          <textarea 
                            value={block.current_state}
                            onChange={e => {
                              const nb = [...blocks];
                              nb[idx].current_state = e.target.value;
                              setBlocks(nb);
                            }}
                            placeholder="What is your primary focus this week?"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white text-sm font-bold outline-none focus:border-[#FF6600]/40 transition-all min-h-[120px]"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anticipated Challenges</label>
                          <textarea 
                            value={block.challenge}
                            onChange={e => {
                              const nb = [...blocks];
                              nb[idx].challenge = e.target.value;
                              setBlocks(nb);
                            }}
                            placeholder="Any blockers or risks?"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white text-sm font-bold outline-none focus:border-[#FF6600]/40 transition-all min-h-[120px]"
                          />
                        </div>
                     </>
                   ) : (
                     <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-3">
                              <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">What Worked</label>
                              <textarea 
                                value={block.what_worked}
                                onChange={e => {
                                  const nb = [...blocks];
                                  nb[idx].what_worked = e.target.value;
                                  setBlocks(nb);
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white text-sm font-bold outline-none focus:border-emerald-500/40 transition-all min-h-[100px]"
                              />
                           </div>
                           <div className="space-y-3">
                              <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest">What Didn't</label>
                              <textarea 
                                value={block.what_failed}
                                onChange={e => {
                                  const nb = [...blocks];
                                  nb[idx].what_failed = e.target.value;
                                  setBlocks(nb);
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white text-sm font-bold outline-none focus:border-rose-500/40 transition-all min-h-[100px]"
                              />
                           </div>
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Strategic Notes</label>
                          <textarea 
                            value={block.notes}
                            onChange={e => {
                              const nb = [...blocks];
                              nb[idx].notes = e.target.value;
                              setBlocks(nb);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white text-sm font-bold outline-none focus:border-[#FF6600]/40 transition-all min-h-[120px]"
                          />
                        </div>
                     </>
                   )}
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="flex justify-end gap-6 pt-10 border-t border-white/5">
           <button 
             onClick={handleSubmit}
             disabled={submitting}
             className="px-12 py-5 rounded-3xl bg-[#FF6600] text-black font-black uppercase text-xs tracking-[0.2em] hover:bg-white transition-all shadow-2xl shadow-[#FF6600]/30 disabled:opacity-50 flex items-center gap-4"
           >
             {submitting ? 'Synchronizing Node...' : `Finalize ${type === 'standup' ? 'Stand-up' : 'Retro'}`}
             <ArrowRight className="w-4 h-4" />
           </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
