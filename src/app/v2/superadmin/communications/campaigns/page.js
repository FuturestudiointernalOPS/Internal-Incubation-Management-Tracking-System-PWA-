'use client';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Plus, Send, CheckCircle, Search, Rocket, X, Users, Loader2, List, Trash2, Calendar, MailOpen, Clock, Settings2, ArrowRight, Save, ChevronRight, Power } from 'lucide-react';
import { IMPACT_CACHE } from '@/utils/impactCache';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [families, setFamilies] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals & UI State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); 
  const [hideCompleted, setHideCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [editingSteps, setEditingSteps] = useState([]);

  // Form State
  const [form, setForm] = useState({ 
    name: '', 
    form_id: '', 
    cids: [],
    steps: [{ 
      subject: 'Action Required: {{campaign}}', 
      body: 'Hello {{name}},\n\nPlease proceed to your portal to complete the required steps for {{campaign}}.\n\nLink: {{link}}', 
      wait_type: 'instant', 
      delay_days: 0, 
      delay_minutes: 0,
      delay_hours: 0,
      specific_time: '',
      scheduled_date: '' 
    }]
  });
  const [searchContacts, setSearchContacts] = useState('');

  useEffect(() => { 
    const cachedCamps = IMPACT_CACHE.get('campaigns');
    const cachedConts = IMPACT_CACHE.get('contacts');
    const cachedForms = IMPACT_CACHE.get('forms');
    if (cachedCamps) { setCampaigns(cachedCamps); setLoading(false); }
    if (cachedConts) setContacts(cachedConts);
    if (cachedForms) setForms(cachedForms);
    fetchData(); 
  }, []);

  const fetchData = async () => {
    try {
      // 1. Prioritize core campaign list for instant dashboard display
      const campRes = await fetch('/api/campaigns');
      const camps = await campRes.json();
      if (camps.success) {
        setCampaigns(camps.campaigns || []);
        IMPACT_CACHE.set('campaigns', camps.campaigns);
        setLoading(false); // Move dashboard to interactive state immediately
      }

      // 2. Hydrate background data units individually (so forms/families load instantly)
      fetch('/api/contacts').then(r => r.json()).then(data => {
        if (data.success) {
           setContacts(data.contacts || []);
           IMPACT_CACHE.set('contacts', data.contacts);
        }
      }).catch(e => console.error(e));

      fetch('/api/forms').then(r => r.json()).then(data => {
        if (data.success) {
           setForms(data.forms || []);
           IMPACT_CACHE.set('forms', data.forms); // Sync the cache for the next reload
        }
      }).catch(e => console.error(e));

      fetch('/api/families').then(r => r.json()).then(data => {
        if (data.success) setFamilies(data.families || []);
      }).catch(e => console.error(e));

    } catch (err) { 
      console.error(err); 
      setLoading(false); 
    }
  };

  const openDetails = async (campaign) => {
    try {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'info', message: `Retrieving setup for ${campaign.name}...`, duration: 2000 } 
      }));
      const res = await fetch(`/api/campaigns/${campaign.id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedCampaign({
          ...data.campaign,
          cids: (data.campaign.contacts || []).map(c => c.cid)
        });
        setEditingSteps(data.campaign.steps || []);
        setShowDetailsModal(true);
      }
    } catch (err) { 
      console.error(err); 
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: 'Campaign manager could not be initialized.' } 
      }));
    }
  };

  const updateCampaign = async () => {
    if (!selectedCampaign) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: selectedCampaign.name, 
          form_id: selectedCampaign.form_id,
          status: selectedCampaign.status, // Preserve status (active/paused)
          steps: editingSteps,
          cids: selectedCampaign.cids 
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
        setShowDetailsModal(false);
        // Force sync automation
        fetch('/api/send-pending').catch(() => {});
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: 'Campaign modifications saved and live.' } 
        }));
      }
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const deleteCampaign = async (id) => {
    const pwd = prompt("PROTECTIVE GATE: Enter Admin Access Code to permanently destroy this campaign:");
    if (pwd !== '147369') {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: 'Unauthorized Command: Destruction sequence aborted.' } 
      }));
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setShowDetailsModal(false);
        fetchData();
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: 'Campaign permanently erased from records.' } 
        }));
      }
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const submitCampaign = async (e) => {
    e.preventDefault();
    if (form.cids.length === 0) {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: 'Pick at least one person.' } 
      }));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setForm({ name: '', form_id: '', cids: [], steps: form.steps });
        fetchData();
        // Force sync automation
        fetch('/api/send-pending').catch(() => {});
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: '🚀 Campaign launched! Initial emails are firing.' } 
        }));
      }
    } catch (err) { 
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'error', message: 'Failed to initiate campaign.' } 
        }));
    } finally { setIsSubmitting(false); }
  };

  const addStep = (isEditing = false) => {
    const newStep = { 
      subject: 'Follow-up: {{campaign}}', 
      body: 'Hello {{name}},\n\nJust a reminder to check your portal.\n\nLink: {{link}}', 
      wait_type: 'days', delay_days: 3, delay_minutes: 0, delay_hours: 0, specific_time: '', scheduled_date: ''
    };
    if (isEditing) setEditingSteps([...editingSteps, newStep]);
    else setForm(p => ({ ...p, steps: [...p.steps, newStep] }));
  };

  const updateStep = (idx, key, val, isEditing = false) => {
    if (isEditing) setEditingSteps(editingSteps.map((s, i) => i === idx ? { ...s, [key]: val } : s));
    else setForm(p => ({ ...p, steps: p.steps.map((s, i) => i === idx ? { ...s, [key]: val } : s) }));
  };

  const removeStep = (idx, isEditing = false) => {
    if (isEditing) setEditingSteps(editingSteps.filter((_, i) => i !== idx));
    else setForm(p => ({ ...p, steps: p.steps.filter((_, i) => i !== idx) }));
  };

  const toggleContact = (cid) => {
    setForm(prev => ({ 
      ...prev, 
      cids: prev.cids.includes(cid) ? prev.cids.filter(id => id !== cid) : [...prev.cids, cid] 
    }));
  };

  const selectFamily = (familyName, isEditing = false) => {
    const familyCids = contacts.filter(c => c.group_name === familyName).map(c => c.cid);
    if (isEditing) {
       const nextCids = [...new Set([...selectedCampaign.cids, ...familyCids])];
       setSelectedCampaign({...selectedCampaign, cids: nextCids});
    } else {
       setForm(prev => ({ ...prev, cids: [...new Set([...prev.cids, ...familyCids])] }));
    }
  };

  const getFilteredCampaigns = () => {
    return campaigns.filter(c => {
      const isCompleted = c.sent_contacts >= c.total_contacts && c.total_contacts > 0;
      const isUpcoming = c.sent_contacts === 0 && c.total_contacts > 0;
      const isRunning = !isCompleted && !isUpcoming;

      if (activeTab === 'completed') return isCompleted;
      if (activeTab === 'upcoming') return isUpcoming;
      if (activeTab === 'running') return isRunning;
      return true;
    }).filter(c => {
      if (hideCompleted && c.sent_contacts >= c.total_contacts) return false;
      return true;
    });
  };

  const filteredCampsList = getFilteredCampaigns();

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 min-h-[60vh]">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Campaigns</h2>
            <p className="text-slate-400 font-bold tracking-tight">Broadcast messages and track engagement metrics.</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-prime !py-4 shadow-[#FF6600]/10">
            <Plus className="w-5 h-5 mr-2" /> Start Campaign
          </button>
        </header>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-4">
           <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
              {['all', 'running', 'upcoming', 'completed'].map(tab => (
                 <button 
                   key={tab} 
                   onClick={() => setActiveTab(tab)}
                   className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-[#FF6600]/80 text-white shadow-lg shadow-[#FF6600]/80/20' : 'text-slate-500 hover:text-white'}`}
                 >
                   {tab}
                 </button>
              ))}
           </div>
           
           <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                 <input type="checkbox" checked={hideCompleted} onChange={e => setHideCompleted(e.target.checked)} className="hidden" />
                 <div className={`w-10 h-5 rounded-full border border-white/10 transition-all p-1 flex ${hideCompleted ? 'bg-[#FF6600]/80 justify-end' : 'bg-white/5 justify-start'}`}>
                    <div className="w-3 h-3 bg-white rounded-full shadow-sm shadow-black/20" />
                 </div>
                 <span className="text-[10px] font-black text-slate-500 group-hover:text-slate-400 uppercase tracking-widest transition-colors">Hide Finished</span>
              </label>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{filteredCampsList.length} Items</p>
           </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20"><Loader2 className="w-10 h-10 text-[#FF6600]/80 animate-spin" /></div>
        ) : filteredCampsList.length === 0 ? (
          <div className="p-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
            <Rocket className="w-16 h-16 text-slate-500 mx-auto mb-6 opacity-30" />
            <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Empty Shelf</h4>
            <p className="text-slate-400 text-sm font-bold">No campaigns match this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampsList.map(c => {
               const p = Math.round((c.sent_contacts / c.total_contacts) * 100) || 0;
               return (
                <div key={c.id} onClick={() => openDetails(c)} className="ios-card group hover:border-[#FF6600]/80/30 transition-all duration-300 cursor-pointer text-left flex flex-col h-full relative z-10 pointer-events-auto">
                   <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                         <div className="p-3 rounded-xl bg-[#FF6600]/80/10 border border-[#FF6600]/80/20 text-indigo-400 group-hover:scale-110 transition-transform">
                           <Rocket className="w-6 h-6" />
                         </div>
                         <button 
                            onClick={(e) => { e.stopPropagation(); openDetails(c); }}
                            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10 hover:text-white"
                         >
                            <Settings2 className="w-4 h-4" />
                         </button>
                      </div>
                      {p === 100 ? (
                         <span className="badge badge-glow-success bg-emerald-500/10 text-emerald-400 border-emerald-500/20">FINISHED</span>
                      ) : c.status === 'paused' ? (
                         <span className="badge badge-glow-error bg-rose-500/10 text-rose-400 border-rose-500/20 uppercase">PAUSED</span>
                      ) : p > 0 ? (
                         <span className="badge badge-glow-warning bg-amber-500/10 text-amber-500 border-amber-500/20">RUNNING</span>
                      ) : (
                         <span className="badge bg-[#FF6600]/80/10 text-indigo-400 border-[#FF6600]/80/20">UPCOMING</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                       <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400">
                          <Settings2 className="w-3 h-3" />
                          <span className="text-[9px] font-black uppercase tracking-tighter">
                             {c.sent_contacts > 0 ? `${Math.min(c.current_step + 1, c.total_steps)} OF ${c.total_steps} PHASES` : 'PENDING ACTIVATION'}
                          </span>
                       </div>
                    </div>
                    <div className="mb-4">
                       <h3 className="text-xl font-black text-white uppercase tracking-tighter group-hover:text-indigo-400 transition-colors truncate">{c.name}</h3>
                       <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">Ref: {c.id}</p>
                    </div>
                    
                   <div className="space-y-4 flex-1">
                      <div className="flex justify-between items-end mb-1">
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Progress</p>
                         <p className="text-xs font-black text-white">{p}%</p>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full bg-[#FF6600]/80 transition-all duration-700" style={{ width: `${p}%` }} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                         <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Audience</p>
                            <p className="text-lg font-black text-white">{c.total_contacts}</p>
                         </div>
                         <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Sent</p>
                            <p className="text-lg font-black text-white text-emerald-400">{c.sent_contacts}</p>
                         </div>
                      </div>
                   </div>

                   <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                         {p === 100 ? 'Review Log' : 'Edit Pipeline'}
                      </span>
                      <button 
                         onClick={(e) => { e.stopPropagation(); openDetails(c); }}
                         className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs hover:text-white transition-colors"
                      >
                         Manage <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                   </div>
                </div>
               );
            })}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto p-4">
            <div onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
            <div className="relative w-full max-w-4xl ios-card !p-0 shadow-2xl bg-[#080810] border border-white/10 flex flex-col h-[90vh] text-left">
              <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-[#0d0d18] flex-shrink-0 rounded-t-[2.5rem]">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">New Campaign</h3>
                  <p className="text-sm text-slate-400 font-bold">Configure sequence and target list.</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
              </header>
              
              <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                 {/* Left: Settings */}
                 <div className="w-full md:w-1/2 p-8 overflow-y-auto custom-scrollbar border-r border-white/5 space-y-8">
                    <div className="space-y-6">
                       <div>
                         <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Campaign Name</label>
                         <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Phase 1 Outreach" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#FF6600]/80/50 font-bold" />
                       </div>
                       <div>
                         <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Form Logic (Optional)</label>
                         <select value={form.form_id} onChange={e => setForm({...form, form_id: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none appearance-none font-bold">
                            <option value="" className="bg-[#080810]">No Form Required</option>
                            {forms.map(f => <option key={f.form_id} value={f.form_id} className="bg-[#080810]">{f.name}</option>)}
                         </select>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="flex items-center justify-between">
                         <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">Sequence Pipeline</h4>
                         <button type="button" onClick={() => addStep(false)} className="px-3 py-1 bg-[#FF6600]/80/10 text-indigo-400 text-[10px] font-black uppercase rounded-lg border border-[#FF6600]/80/20 hover:bg-[#FF6600]/80 hover:text-white transition-all">+ Add Follow-up</button>
                       </div>
                       <div className="space-y-4">
                          {form.steps.map((step, idx) => (
                             <div key={idx} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                               <div className="flex items-center justify-between">
                                 <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Email {idx + 1}</span>
                                 {idx > 0 && <button type="button" onClick={() => removeStep(idx, false)} className="text-rose-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>}
                               </div>
                               <input placeholder="Subject..." value={step.subject} onChange={e => updateStep(idx, 'subject', e.target.value, false)} className="w-full bg-transparent border-b border-white/10 py-1 text-sm font-bold text-white outline-none" />
                               <div className="grid grid-cols-2 gap-4">
                                  <select value={step.wait_type} onChange={e => updateStep(idx, 'wait_type', e.target.value, false)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none font-black uppercase tracking-widest">
                                     {idx === 0 ? <><option value="instant">Instant</option><option value="date">Date</option></> : <><option value="days">Days</option><option value="hours">Hours</option><option value="minutes">Minutes</option></>}
                                  </select>
                                  {['days', 'hours', 'minutes'].includes(step.wait_type) && (
                                     <input 
                                        type="number" 
                                        placeholder={`Delay ${step.wait_type}...`}
                                        value={step.wait_type === 'days' ? step.delay_days : (step.wait_type === 'hours' ? step.delay_hours : step.delay_minutes)} 
                                        onChange={e => {
                                           const val = parseInt(e.target.value);
                                           if (step.wait_type === 'days') updateStep(idx, 'delay_days', val, false);
                                           else if (step.wait_type === 'hours') updateStep(idx, 'delay_hours', val, false);
                                           else updateStep(idx, 'delay_minutes', val, false);
                                        }} 
                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" 
                                     />
                                  )}
                                  {step.wait_type === 'date' && <input type="datetime-local" value={step.scheduled_date} onChange={e => updateStep(idx, 'scheduled_date', e.target.value, false)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white" />}
                               </div>
                               <textarea value={step.body} onChange={e => updateStep(idx, 'body', e.target.value, false)} rows="3" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-slate-400 outline-none focus:text-white transition-colors resize-none" />
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>

                 {/* Right: Target Picker */}
                 <div className="w-full md:w-1/2 p-8 overflow-y-auto custom-scrollbar flex flex-col bg-[#0d0d18]/30">
                    <div className="flex items-center justify-between mb-6">
                       <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Audience</h4>
                       <span className="badge badge-glow-success bg-emerald-500/10 text-emerald-400">{form.cids.length} Active Targets</span>
                    </div>

                    <div className="mb-6">
                       <p className="text-[8px] font-black text-slate-600 uppercase mb-2 tracking-[0.2em]">Pick Families</p>
                       <div className="flex flex-wrap gap-2">
                          {families.map(f => (
                             <button key={f.id} type="button" onClick={() => selectFamily(f.name, false)} className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-[10px] font-heavy text-slate-400 hover:border-[#FF6600]/80/50 hover:text-white transition-all uppercase">
                                + {f.name}
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="relative mb-4">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                       <input type="text" placeholder="Search individuals..." value={searchContacts} onChange={e => setSearchContacts(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-xs text-white outline-none" />
                    </div>
                    <div className="flex-1 space-y-2">
                       {contacts.filter(c => c.name.toLowerCase().includes(searchContacts.toLowerCase())).map(c => (
                          <div key={c.cid} onClick={() => toggleContact(c.cid)} className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${form.cids.includes(c.cid) ? 'bg-[#FF6600]/80/10 border-[#FF6600]/80' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                             <div>
                                <p className="text-xs font-black text-white">{c.name}</p>
                                <p className="text-[9px] text-slate-500 font-bold uppercase">{c.group_name || 'Individual'}</p>
                             </div>
                             {form.cids.includes(c.cid) && <CheckCircle className="w-4 h-4 text-indigo-400" />}
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              <footer className="px-8 py-6 border-t border-white/5 bg-[#0d0d18] flex justify-end gap-4 flex-shrink-0">
                 <button onClick={() => setShowCreateModal(false)} className="btn-ghost !px-8 text-xs">CANCEL</button>
                 <button onClick={submitCampaign} disabled={isSubmitting} className="btn-prime !px-10 text-xs shadow-[#FF6600]/30 flex items-center gap-2">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isSubmitting ? 'INITIATING...' : 'FIRE CAMPAIGN'}
                 </button>
              </footer>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedCampaign && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto p-4">
            <div onClick={() => setShowDetailsModal(false)} className="absolute inset-0 bg-black/95 backdrop-blur-md cursor-pointer" />
            <div className="relative w-full max-w-6xl ios-card !p-0 shadow-2xl bg-[#080810] border border-white/10 flex flex-col h-[90vh] text-left overflow-hidden">
              <header className="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-[#0d0d18] flex-shrink-0">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 rounded-2xl bg-[#FF6600]/80/10 border border-[#FF6600]/80/20 flex items-center justify-center text-indigo-400">
                     <Rocket className="w-8 h-8" />
                   </div>
                   <div>
                     <input 
                        disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts}
                        className="text-3xl font-black text-white bg-transparent outline-none focus:border-b-2 border-[#FF6600]/80 uppercase tracking-tighter disabled:opacity-50 w-full max-w-lg" 
                        value={selectedCampaign.name} 
                        onChange={e => setSelectedCampaign({...selectedCampaign, name: e.target.value})} 
                     />
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        {selectedCampaign.sent_contacts >= selectedCampaign.total_contacts ? 'Historical Archive (Read Only)' : 'Active Dispatch Pipeline'} 
                     </p>
                   </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 mr-4 pr-6 border-r border-white/5">
                        <div className="flex flex-col items-end">
                           <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none mb-1">Master Switch</span>
                           <span className={`text-[10px] font-black uppercase tracking-widest ${selectedCampaign.status === 'paused' ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {selectedCampaign.status === 'paused' ? 'CAMPAIGN OFF' : 'CAMPAIGN ON'}
                           </span>
                        </div>
                        <div 
                           onClick={() => {
                              if (selectedCampaign.sent_contacts >= selectedCampaign.total_contacts) return;
                              const newStatus = selectedCampaign.status === 'paused' ? 'pending' : 'paused';
                              setSelectedCampaign({...selectedCampaign, status: newStatus});
                           }}
                           className={`w-12 h-6 rounded-full relative cursor-pointer transition-all duration-300 border ${selectedCampaign.status === 'paused' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}
                        >
                           <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full transition-all duration-300 shadow-lg ${selectedCampaign.status === 'paused' ? 'right-0.5 bg-rose-500' : 'left-0.5 bg-emerald-500'}`} />
                        </div>
                    </div>

                    <button 
                       onClick={() => deleteCampaign(selectedCampaign.id)}
                       disabled={isSubmitting} 
                       className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white p-3 rounded-xl border border-rose-500/20 transition-all font-black text-[10px] flex items-center gap-2 uppercase tracking-widest shadow-lg shadow-rose-500/10 pr-5"
                    >
                       <Trash2 className="w-4 h-4" />
                       Destroy
                    </button>
                    {selectedCampaign.sent_contacts < selectedCampaign.total_contacts && (
                       <button onClick={updateCampaign} disabled={isSubmitting} className="btn-prime bg-emerald-500 hover:bg-emerald-600 !px-8 shadow-emerald-600/20">
                         {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                         SAVE MODIFICATIONS
                       </button>
                    )}
                    <button onClick={() => setShowDetailsModal(false)} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/10 transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
                </div>
              </header>

              <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                 {/* Sidebar */}
                 <div className="w-full md:w-1/3 p-10 overflow-y-auto border-r border-white/5 bg-white/[0.01]">
                    <div className="space-y-12">
                       <section className="space-y-6">
                          <div className="flex items-center justify-between border-b border-white/5 pb-4">
                             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Target Selection</h4>
                             <span className="badge badge-glow-success bg-[#FF6600]/80/10 text-indigo-400 border-[#FF6600]/80/20">{selectedCampaign.cids?.length} Contacts</span>
                          </div>
                          
                          {selectedCampaign.sent_contacts < selectedCampaign.total_contacts && (
                            <div className="space-y-4">
                               <p className="text-[8px] font-black text-slate-600 uppercase mb-2 tracking-[0.2em]">Add Families</p>
                               <div className="flex flex-wrap gap-2">
                                  {families.map(f => (
                                     <button key={f.id} onClick={() => selectFamily(f.name, true)} className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-[10px] font-heavy text-slate-400 hover:border-[#FF6600]/80/50 hover:text-white transition-all uppercase">+ {f.name}</button>
                                  ))}
                               </div>
                            </div>
                          )}

                          <div className="relative">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                             <input type="text" placeholder="Search audience..." value={searchContacts} onChange={e => setSearchContacts(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-[10px] text-white outline-none" />
                          </div>
                          
                          <div className="max-h-[350px] overflow-y-auto custom-scrollbar space-y-2 border-t border-white/5 pt-4">
                             {contacts.filter(c => c.name.toLowerCase().includes(searchContacts.toLowerCase())).map(c => {
                                const isPicked = selectedCampaign.cids?.includes(c.cid);
                                return (
                                   <div key={c.cid} onClick={() => {
                                      if (selectedCampaign.sent_contacts >= selectedCampaign.total_contacts) return;
                                      const nextCids = isPicked ? selectedCampaign.cids.filter(id => id !== c.cid) : [...selectedCampaign.cids, c.cid];
                                      setSelectedCampaign({...selectedCampaign, cids: nextCids});
                                   }} className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${isPicked ? 'bg-[#FF6600]/80/10 border-[#FF6600]/80/50' : 'bg-white/5 border-white/5 hover:bg-white/10'} ${selectedCampaign.sent_contacts >= selectedCampaign.total_contacts ? 'cursor-default' : ''}`}>
                                      <div>
                                         <p className="text-[10px] font-black text-white truncate">{c.name}</p>
                                         <p className="text-[8px] text-slate-500 font-bold uppercase">{c.group_name || 'Individual'}</p>
                                      </div>
                                      {isPicked && <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />}
                                   </div>
                                );
                             })}
                          </div>
                       </section>

                       <section className="space-y-6">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-4">Logic Config</h4>
                          <div className="space-y-4">
                             <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500 uppercase tracking-widest">Active Form</span>
                                <select disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts} value={selectedCampaign.form_id || ''} onChange={e => setSelectedCampaign({...selectedCampaign, form_id: e.target.value})} className="bg-transparent text-white text-right outline-none disabled:opacity-50 italic">
                                   <option value="" className="bg-[#080810]">None</option>
                                   {forms.map(f => <option key={f.form_id} value={f.form_id} className="bg-[#080810]">{f.name}</option>)}
                                </select>
                             </div>
                             <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500 uppercase tracking-widest">Created On</span>
                                <span className="text-white opacity-40 uppercase tracking-widest text-[10px]">{new Date(selectedCampaign.created_at).toLocaleDateString()}</span>
                             </div>
                          </div>
                       </section>
                    </div>
                 </div>

                 {/* Main Pipeline */}
                 <div className="flex-1 p-10 overflow-y-auto bg-transparent custom-scrollbar">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-8 flex items-center gap-3">
                       <Settings2 className="w-5 h-5" /> Pipeline Sequence Modification
                    </h4>
                    
                    <div className="space-y-8">
                       {editingSteps.map((step, idx) => (
                          <div key={idx} className="ios-card border-white/10 group relative">
                             <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center font-black text-white text-lg">{idx + 1}</div>
                                   <div className="flex-1 min-w-[200px]">
                                      <div className="flex items-center justify-between mb-1">
                                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{idx === 0 ? 'Anchor Step' : `Follow-up ${idx}`}</p>
                                         {step.delivered_count > 0 && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                               <CheckCircle className="w-3 h-3" />
                                               <span className="text-[8px] font-black uppercase tracking-tighter">Received by {step.delivered_count}</span>
                                            </div>
                                         )}
                                      </div>
                                      <h5 className="text-sm font-black text-white uppercase tracking-tighter">
                                         {step.wait_type === 'instant' ? 'Instant Dispatch' : (step.wait_type === 'date' ? `Scheduled: ${step.scheduled_date || '?'}` : `Wait ${step.delay_days || step.delay_hours || step.delay_minutes || 0} ${step.wait_type}`)}
                                      </h5>
                                   </div>
                                </div>
                                <div className="flex gap-2">
                                   <select disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts} value={step.wait_type} onChange={e => updateStep(idx, 'wait_type', e.target.value, true)} className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-[10px] font-black text-white uppercase tracking-widest outline-none disabled:opacity-30">
                                      {idx === 0 ? <><option value="instant">Instant</option><option value="date">Date</option></> : <><option value="days">Days</option><option value="hours">Hours</option><option value="minutes">Minutes</option></>}
                                   </select>
                                   {idx > 0 && selectedCampaign.sent_contacts < selectedCampaign.total_contacts && (
                                      <button onClick={() => removeStep(idx, true)} className="text-rose-500 hover:text-rose-400 p-2 transition-colors"><Trash2 className="w-5 h-5" /></button>
                                   )}
                                </div>
                             </div>

                             <div className="space-y-6">
                                <div className="space-y-2">
                                   <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Email Subject line</label>
                                   <input 
                                       disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts}
                                       value={step.subject} 
                                       onChange={e => updateStep(idx, 'subject', e.target.value, true)} 
                                       className="w-full bg-transparent border-b border-white/10 pb-2 text-xl font-black text-white outline-none focus:border-[#FF6600]/80 transition-colors uppercase tracking-tighter disabled:opacity-30" 
                                   />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                   {['days', 'hours', 'minutes'].includes(step.wait_type) && (
                                      <div>
                                         <label className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2">Wait duration ({step.wait_type})</label>
                                         <input 
                                            disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts}
                                            type="number" 
                                            value={step.delay_days || step.delay_hours || step.delay_minutes || 0} 
                                            onChange={e => {
                                               const val = parseInt(e.target.value);
                                               if (step.wait_type === 'days') updateStep(idx, 'delay_days', val, true);
                                               else if (step.wait_type === 'hours') updateStep(idx, 'delay_hours', val, true);
                                               else updateStep(idx, 'delay_minutes', val, true);
                                            }} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white font-bold disabled:opacity-30" 
                                         />
                                      </div>
                                   )}
                                   {step.wait_type === 'date' && (
                                      <div>
                                         <label className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2">Target Date/Time</label>
                                         <input 
                                            disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts}
                                            type="datetime-local" 
                                            value={step.scheduled_date} 
                                            onChange={e => updateStep(idx, 'scheduled_date', e.target.value, true)} 
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white disabled:opacity-30" 
                                         />
                                      </div>
                                   )}
                                </div>
                                <div>
                                   <label className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2">Message Content</label>
                                   <textarea 
                                      disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts}
                                      value={step.body} 
                                      onChange={e => updateStep(idx, 'body', e.target.value, true)} 
                                      rows="5" 
                                      className="w-full bg-white/5 border border-white/5 rounded-2xl p-6 text-sm text-slate-400 outline-none focus:text-white transition-colors leading-relaxed font-medium disabled:opacity-30" 
                                   />
                                </div>
                             </div>
                             
                             {idx < editingSteps.length - 1 && (
                                <div className="flex justify-center -mb-20 mt-10 relative z-10">
                                   <div className="p-2 rounded-full bg-[#080810] border border-white/10 text-indigo-400">
                                      <ArrowRight className="w-6 h-6 rotate-90" />
                                   </div>
                                </div>
                             )}
                          </div>
                       ))}
                       {selectedCampaign.sent_contacts < selectedCampaign.total_contacts && (
                          <button onClick={() => addStep(true)} className="w-full py-6 border-2 border-dashed border-white/5 rounded-3xl text-slate-500 hover:text-indigo-400 hover:border-[#FF6600]/80/30 hover:bg-[#FF6600]/80/5 transition-all text-[10px] font-black uppercase tracking-[0.3em]">+ Add Sequential Message</button>
                       )}
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
