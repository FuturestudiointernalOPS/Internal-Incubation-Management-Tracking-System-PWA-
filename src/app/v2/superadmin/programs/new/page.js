'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, Plus, Trash2, Save, Rocket, 
  Layers, FileText, Target, Calendar, Sparkles, 
  Settings, MessageSquare, Globe, Link as LinkIcon 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

/**
 * VERSION 2 — PROGRAM ARCHITECT COMMAND
 * Superadmin module to define structural lifecycle templates.
 */
export default function CreateProgramV2() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(1); // 1: Core Info, 2: Topics, 3: Deliverables, 4: Resources
  
  // Data State
  const [programData, setProgramData] = useState({
    name: '',
    description: '',
    duration_weeks: 13,
    duration_days: 0,
    outcomes: '',
    feedback_enabled: true
  });

  const [topics, setTopics] = useState([
     { id: Date.now(), title: 'Week 1: Foundations', subtopics: ['Onboarding', 'Concept Definition'] }
  ]);

  const [deliverables, setDeliverables] = useState([
     { id: Date.now(), title: 'Business Plan Draft', description: 'Initial draft of core concepts.' }
  ]);

  const [resources, setResources] = useState([]);

  // Lifecycle Checks
  useEffect(() => {
    const sa = localStorage.getItem('sa_session');
    if (sa !== 'prime-2026-active') {
      router.replace('/sa-hq-sp-2026-v1/login');
    }
  }, [router]);

  // Topic Handlers
  const addTopic = () => {
    setTopics([...topics, { id: Date.now(), title: `Week ${topics.length + 1}: ...`, subtopics: [] }]);
  };

  const removeTopic = (id) => {
    setTopics(topics.filter(t => t.id !== id));
  };

  const updateTopic = (id, field, value) => {
    setTopics(topics.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const addSubtopic = (topicId) => {
    setTopics(topics.map(t => t.id === topicId ? { ...t, subtopics: [...t.subtopics, ''] } : t));
  };

  const updateSubtopic = (topicId, index, value) => {
    setTopics(topics.map(t => {
      if (t.id === topicId) {
        const newSubtopics = [...t.subtopics];
        newSubtopics[index] = value;
        return { ...t, subtopics: newSubtopics };
      }
      return t;
    }));
  };

  // Deliverable Handlers
  const addDeliverable = () => {
    setDeliverables([...deliverables, { id: Date.now(), title: '', description: '' }]);
  };

  const removeDeliverable = (id) => {
    setDeliverables(deliverables.filter(d => d.id !== id));
  };

  const updateDeliverable = (id, field, value) => {
    setDeliverables(deliverables.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  // Resource Handlers
  const addResource = () => {
    setResources([...resources, { id: Date.now(), name: '', url: '', type: 'url' }]);
  };

  const removeResource = (id) => {
     setResources(resources.filter(r => r.id !== id));
  };

  const updateResource = (id, field, value) => {
     setResources(resources.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // Core Persistence
  const handleFinalSubmit = async () => {
    if (!programData.name) {
      alert("Program Name is mandatory.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v2/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...programData,
          topics,
          deliverables,
          resources,
        })
      });

      const resJson = await response.json();
      if (resJson.success) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: 'Program Blueprint successfully saved to Command HQ.' } 
        }));
        router.push('/v2/superadmin');
      } else {
        throw new Error(resJson.error);
      }
    } catch (error) {
       alert(`Deployment Error: ${error.message}`);
    } finally {
       setLoading(false);
    }
  };

  return (
    <DashboardLayout role="super_admin" activeTab="v2">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
           <button 
              onClick={() => router.back()}
              className="btn-ghost !py-2 !px-4 hover:bg-white/5"
           >
              <ChevronLeft className="w-4 h-4 mr-2" /> HQ Dashboard
           </button>
           <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
              <Layers className="text-indigo-400 w-5 h-5" /> Program Lifecycle Architect
           </h2>
           <button 
              onClick={handleFinalSubmit}
              disabled={loading}
              className="btn-prime !py-3 !px-8 shadow-indigo-600/10 disabled:opacity-50"
           >
              {loading ? 'Deploying...' : <><Save className="w-4 h-4 mr-2" /> Deploy Blueprint</>}
           </button>
        </header>

        {/* STEPPER PROGRESS */}
        <div className="flex items-center justify-between px-10">
           {[1, 2, 3, 4].map(step => (
              <div 
                key={step} 
                onClick={() => setActiveStep(step)}
                className={`cursor-pointer transition-all duration-500 relative flex flex-col items-center gap-4 ${activeStep === step ? 'scale-110 opacity-100' : 'opacity-40 grayscale'}`}
              >
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${activeStep === step ? 'bg-indigo-500 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)]' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                    {step === 1 && <FileText className="w-5 h-5" />}
                    {step === 2 && <Calendar className="w-5 h-5" />}
                    {step === 3 && <Target className="w-5 h-5" />}
                    {step === 4 && <Globe className="w-5 h-5" />}
                 </div>
                 <span className="text-[10px] font-black text-white uppercase tracking-widest">
                    {step === 1 && 'Info'}
                    {step === 2 && 'Topics'}
                    {step === 3 && 'Tasking'}
                    {step === 4 && 'Data'}
                 </span>
              </div>
           ))}
        </div>

        <motion.div 
           key={activeStep}
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="ios-card bg-[#0d0d18] border-white/5 !p-12 min-h-[500px]"
        >
           {/* STEP 1: CORE DEFINITION */}
           {activeStep === 1 && (
              <div className="space-y-10">
                 <div>
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Program Specifications</h3>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Define the operational bounderies and duration.</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Full Identity (Name)</label>
                       <input 
                         type="text" 
                         value={programData.name}
                         onChange={(e) => setProgramData({...programData, name: e.target.value})}
                         placeholder="e.g., Venture Studio 2026 Batch Alpha" 
                         className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 transition-colors font-bold"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Expected Outlays (Duration in Weeks)</label>
                       <input 
                         type="number" 
                         value={programData.duration_weeks}
                         onChange={(e) => setProgramData({...programData, duration_weeks: parseInt(e.target.value)})}
                         className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 transition-colors font-bold"
                       />
                    </div>
                    <div className="col-span-full space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">Vision Mapping (Philosophy/Description)</label>
                       <textarea 
                         rows={4}
                         value={programData.description}
                         onChange={(e) => setProgramData({...programData, description: e.target.value})}
                         placeholder="Briefly define the purpose of this lifecycle..." 
                         className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white outline-none focus:border-indigo-500/30 transition-colors font-bold resize-none"
                       />
                    </div>
                 </div>
              </div>
           )}

           {/* STEP 2: CURRICULUM MAPPING */}
           {activeStep === 2 && (
              <div className="space-y-10">
                 <div className="flex justify-between items-end">
                    <div>
                       <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Weekly Topic Mapping</h3>
                       <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Map the progression lifecycle week-by-week.</p>
                    </div>
                    <button onClick={addTopic} className="btn-ghost !text-indigo-400 !font-black !text-[10px] !uppercase !tracking-widest">
                       <Plus className="w-4 h-4 mr-2" /> Add Phase
                    </button>
                 </div>

                 <div className="space-y-6">
                    {topics.map((topic, idx) => (
                       <div key={topic.id} className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 group relative">
                          <button 
                             onClick={() => removeTopic(topic.id)}
                             className="absolute top-8 right-8 text-slate-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                             <Trash2 className="w-5 h-5" />
                          </button>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                             <div className="md:col-span-2 space-y-4">
                               <input 
                                 type="text" 
                                 value={topic.title}
                                 onChange={(e) => updateTopic(topic.id, 'title', e.target.value)}
                                 className="w-full bg-transparent text-xl font-black text-white uppercase tracking-tighter border-b border-indigo-500/20 focus:border-indigo-500 outline-none pb-2 transition-colors"
                                 placeholder="Phase Title..."
                               />
                               
                               <div className="space-y-3 pl-4 border-l-2 border-indigo-500/10">
                                  {topic.subtopics.map((sub, sIdx) => (
                                     <input 
                                       key={sIdx}
                                       value={sub}
                                       onChange={(e) => updateSubtopic(topic.id, sIdx, e.target.value)}
                                       className="w-full bg-transparent text-sm font-bold text-slate-400 outline-none border-b border-transparent focus:border-white/10"
                                       placeholder="Subtopic/Objective..."
                                     />
                                  ))}
                                  <button onClick={() => addSubtopic(topic.id)} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors">
                                     + Add Subtopic
                                  </button>
                               </div>
                             </div>
                             
                             <div className="flex flex-col items-end justify-center">
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">Phase Index</span>
                                <span className="text-4xl font-black text-slate-800">0{idx + 1}</span>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           )}

           {/* STEP 3: DELIVERABLE PROTOCOLS */}
           {activeStep === 3 && (
              <div className="space-y-10">
                 <div className="flex justify-between items-end">
                    <div>
                       <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Required Submissions</h3>
                       <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Define what participants MUST submit to progress.</p>
                    </div>
                    <button onClick={addDeliverable} className="btn-ghost !text-indigo-400 !font-black !text-[10px] !uppercase !tracking-widest">
                       <Plus className="w-4 h-4 mr-2" /> Add Protocol
                    </button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {deliverables.map((del) => (
                       <div key={del.id} className="ios-card bg-white/[0.02] border-white/5 space-y-4 group">
                          <div className="flex justify-between items-start">
                             <input 
                               value={del.title}
                               onChange={(e) => updateDeliverable(del.id, 'title', e.target.value)}
                               placeholder="Submission Title..."
                               className="bg-transparent text-lg font-black text-white tracking-tighter uppercase outline-none focus:text-indigo-400 transition-colors"
                             />
                             <button onClick={() => removeDeliverable(del.id)} className="text-slate-700 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <textarea 
                             rows={2}
                             value={del.description}
                             onChange={(e) => updateDeliverable(del.id, 'description', e.target.value)}
                             placeholder="Brief objective of this submission..."
                             className="w-full bg-transparent text-xs font-bold text-slate-500 outline-none resize-none border-none"
                          />
                       </div>
                    ))}
                 </div>
              </div>
           )}

           {/* STEP 4: RESOURCE STACK */}
           {activeStep === 4 && (
              <div className="space-y-10">
                 <div className="flex justify-between items-end">
                    <div>
                       <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Static Resource Stack</h3>
                       <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">External tools, PDFs, and data portals available to all.</p>
                    </div>
                    <button onClick={addResource} className="btn-ghost !text-indigo-400 !font-black !text-[10px] !uppercase !tracking-widest">
                       <Plus className="w-4 h-4 mr-2" /> Link Data
                    </button>
                 </div>

                 <div className="space-y-4">
                    {resources.map((res) => (
                       <div key={res.id} className="flex items-center gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5 group">
                          <LinkIcon className="text-indigo-400 w-6 h-6" />
                          <input 
                             placeholder="Resource Name..."
                             value={res.name}
                             onChange={(e) => updateResource(res.id, 'name', e.target.value)}
                             className="flex-1 bg-transparent font-black text-white uppercase tracking-tighter outline-none"
                          />
                          <input 
                             placeholder="URL (https://...)"
                             value={res.url}
                             onChange={(e) => updateResource(res.id, 'url', e.target.value)}
                             className="flex-1 bg-transparent text-xs font-bold text-slate-500 outline-none border-l border-white/10 pl-6"
                          />
                          <button onClick={() => removeResource(res.id)} className="text-slate-700 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    ))}
                    {resources.length === 0 && (
                       <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                          <Globe className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                          <p className="text-slate-600 font-bold max-w-xs mx-auto">Click &apos;Link Data&apos; to attach program-wide resource nodes.</p>
                       </div>
                    )}
                 </div>
              </div>
           )}
        </motion.div>
        
        <footer className="flex justify-between items-center py-10 border-t border-white/5">
           <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">ImpactOS Infrastructure Protocol v2.0</p>
           <div className="flex gap-4">
              <button 
                onClick={() => setActiveStep(Math.max(1, activeStep - 1))} 
                className={`btn-ghost !font-black !text-[10px] !uppercase !tracking-widest ${activeStep === 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
              >
                 Prev Node
              </button>
              <button 
                onClick={() => {
                   if (activeStep < 4) setActiveStep(activeStep + 1);
                   else handleFinalSubmit();
                }} 
                className="btn-prime !font-black !text-[10px] !uppercase !tracking-widest !px-10"
              >
                 {activeStep === 4 ? 'Complete Blueprint' : 'Next Node'}
              </button>
           </div>
        </footer>
      </div>
    </DashboardLayout>
  );
}
