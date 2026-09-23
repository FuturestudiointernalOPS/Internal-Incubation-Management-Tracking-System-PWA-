'use client';
import React, { useState } from 'react';
import { Plus, Send, CheckCircle, Search, Rocket, X, Loader2, Trash2, Settings2, ArrowRight, Save, ChevronRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/lib/hooks/useApi';
import { useI18n } from '@/lib/i18n';
import { formatLocaleDate } from '@/lib/constants';
import { useSafeBack } from '@/lib/useSafeBack';
import { useDialogs } from '@/components/ui/DialogProvider';

const GROUP_LABELS = { UNASSIGNED: 'crm.contacts.unassigned' };

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop.
const pickCampaigns = (payload) => (payload?.success ? payload.campaigns || [] : []);
const pickContacts = (payload) => (payload?.success ? payload.contacts || [] : []);
const pickForms = (payload) => (payload?.success ? payload.forms || [] : []);
const pickFamilies = (payload) => (payload?.success ? payload.families || [] : []);

export default function CampaignsPage() {
  const { t, lang } = useI18n();
  const { prompt } = useDialogs();
  const goBack = useSafeBack('/admin/crm');

  // Four reads, each carrying its own loading flag so the screen leaves the
  // spinner only once all four have settled, exactly as the old combined loader
  // did. Their cache-first paint and stale-response handling belong to the hook,
  // so the screen keeps no data state of its own and never sets state from an
  // effect.
  const { data: campaigns, loading: campaignsLoading, refresh: refreshCampaigns } = useApi(
    '/api/campaigns',
    { defaultValue: [], transform: pickCampaigns },
  );
  const { data: contacts, loading: contactsLoading, refresh: refreshContacts } = useApi(
    '/api/contacts',
    { defaultValue: [], transform: pickContacts },
  );
  const { data: forms, loading: formsLoading, refresh: refreshForms } = useApi(
    '/api/forms',
    { defaultValue: [], transform: pickForms },
  );
  const { data: families, loading: familiesLoading, refresh: refreshFamilies } = useApi(
    '/api/families',
    { defaultValue: [], transform: pickFamilies },
  );
  const loading = campaignsLoading || contactsLoading || formsLoading || familiesLoading;
  // Mutation flows must not read back from the cache, so every read is refreshed
  // the way the old bypassCache argument did.
  const refreshAll = () => {
    refreshCampaigns();
    refreshContacts();
    refreshForms();
    refreshFamilies();
  };
  
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

  // Display-only labels for state values (comparisons keep raw English values)
  const tabLabels = {
    all: t('crm.campaigns.tabAll'),
    running: t('crm.campaigns.tabRunning'),
    upcoming: t('crm.campaigns.tabUpcoming'),
    completed: t('crm.campaigns.tabCompleted'),
  };
  const waitTypeLabels = {
    instant: t('crm.campaigns.instant'),
    date: t('crm.campaigns.date'),
    days: t('crm.campaigns.days'),
    hours: t('crm.campaigns.hours'),
    minutes: t('crm.campaigns.minutes'),
  };

  const openDetails = async (campaign) => {
    try {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'info', message: t('crm.campaigns.retrievingSetup', { name: campaign.name }), duration: 2000 } 
      }));
      const response = await fetch(`/api/campaigns/${campaign.id}`);
      const payload = await response.json();
      if (payload.success) {
        setSelectedCampaign({
          ...payload.campaign,
          cids: (payload.campaign.contacts || []).map(contact => contact.cid)
        });
        setEditingSteps(payload.campaign.steps || []);
        setShowDetailsModal(true);
      }
    } catch (err) { 
      console.error(err); 
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: t('crm.campaigns.initError') } 
      }));
    }
  };

  const updateCampaign = async () => {
    if (!selectedCampaign) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
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
      const payload = await response.json();
      if (payload.success) {
        refreshAll();
        setShowDetailsModal(false);
        // Force sync automation
        fetch('/api/send-pending').catch(() => {});
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: t('crm.campaigns.savedLive') } 
        }));
      }
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const deleteCampaign = async (id) => {
    const password = await prompt({ message: t('crm.campaigns.deletePrompt'), inputType: "password", tone: "danger" });
    if (password !== '147369') {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: t('crm.campaigns.deleteAborted') } 
      }));
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (payload.success) {
        setShowDetailsModal(false);
        refreshAll();
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: t('crm.campaigns.deleted') } 
        }));
      }
    } catch (err) { console.error(err); } finally { setIsSubmitting(false); }
  };

  const submitCampaign = async (event) => {
    event.preventDefault();
    if (form.cids.length === 0) {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: t('crm.campaigns.pickAtLeastOne') } 
      }));
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const payload = await response.json();
      if (payload.success) {
        setShowCreateModal(false);
        setForm({ name: '', form_id: '', cids: [], steps: form.steps });
        refreshAll();
        // Force sync automation
        fetch('/api/send-pending').catch(() => {});
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: t('crm.campaigns.launched') } 
        }));
      }
    } catch { 
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'error', message: t('crm.campaigns.launchFailed') } 
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
    else setForm(previous => ({ ...previous, steps: [...previous.steps, newStep] }));
  };

  const updateStep = (stepIndex, key, value, isEditing = false) => {
    if (isEditing) setEditingSteps(editingSteps.map((step, index) => index === stepIndex ? { ...step, [key]: value } : step));
    else setForm(previous => ({ ...previous, steps: previous.steps.map((step, index) => index === stepIndex ? { ...step, [key]: value } : step) }));
  };

  const removeStep = (stepIndex, isEditing = false) => {
    if (isEditing) setEditingSteps(editingSteps.filter((_, index) => index !== stepIndex));
    else setForm(previous => ({ ...previous, steps: previous.steps.filter((_, index) => index !== stepIndex) }));
  };

  const toggleContact = (cid) => {
    setForm(prev => ({ 
      ...prev, 
      cids: prev.cids.includes(cid) ? prev.cids.filter(contactId => contactId !== cid) : [...prev.cids, cid] 
    }));
  };

  const selectFamily = (familyName, isEditing = false) => {
    const familyCids = contacts
      .filter(
        (contact) =>
          String(contact.group_name || "").trim().toUpperCase() ===
          String(familyName || "").trim().toUpperCase(),
      )
      .map((contact) => contact.cid);
    if (isEditing) {
       const nextCids = [...new Set([...selectedCampaign.cids, ...familyCids])];
       setSelectedCampaign({...selectedCampaign, cids: nextCids});
    } else {
       setForm(prev => ({ ...prev, cids: [...new Set([...prev.cids, ...familyCids])] }));
    }
  };

  const getFilteredCampaigns = () => {
    return campaigns.filter(campaign => {
      const isCompleted = campaign.sent_contacts >= campaign.total_contacts && campaign.total_contacts > 0;
      const isUpcoming = campaign.sent_contacts === 0 && campaign.total_contacts > 0;
      const isRunning = !isCompleted && !isUpcoming;

      if (activeTab === 'completed') return isCompleted;
      if (activeTab === 'upcoming') return isUpcoming;
      if (activeTab === 'running') return isRunning;
      return true;
    }).filter(campaign => {
      if (hideCompleted && campaign.sent_contacts >= campaign.total_contacts) return false;
      return true;
    });
  };

  const filteredCampsList = getFilteredCampaigns();

  return (
    <>
      <div className="space-y-8 min-h-[60vh]">
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button onClick={goBack} className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('crm.backToPrevious')}
          </button>
          <Link href="/admin/crm" className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('crm.backToCrm')}
          </Link>
        </nav>
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">{t('crm.campaigns.title')}</h2>
            <p className="text-slate-400 font-bold tracking-tight">{t('crm.campaigns.subtitle')}</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-prime !py-4 shadow-[#FF6600]/10">
            <Plus className="w-5 h-5 mr-2" /> {t('crm.campaigns.startCampaign')}
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
                   {tabLabels[tab]}
                 </button>
              ))}
           </div>
           
           <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                 <input type="checkbox" checked={hideCompleted} onChange={event => setHideCompleted(event.target.checked)} className="hidden" />
                 <div className={`w-10 h-5 rounded-full border border-white/10 transition-all p-1 flex ${hideCompleted ? 'bg-[#FF6600]/80 justify-end' : 'bg-white/5 justify-start'}`}>
                    <div className="w-3 h-3 bg-white rounded-full shadow-sm shadow-black/20" />
                 </div>
                 <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-400 uppercase tracking-widest transition-colors">{t('crm.campaigns.hideFinished')}</span>
              </label>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('crm.campaigns.itemsCount', { count: filteredCampsList.length })}</p>
           </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20"><Loader2 className="w-10 h-10 text-[#FF6600]/80 animate-spin" /></div>
        ) : filteredCampsList.length === 0 ? (
          <div className="p-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
            <Rocket className="w-16 h-16 text-slate-500 mx-auto mb-6 opacity-30" />
            <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">{t('crm.campaigns.emptyState')}</h4>
            <p className="text-slate-400 text-sm font-bold">{t('crm.campaigns.emptyStateBody')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampsList.map(campaign => {
               const progressPercent = Math.round((campaign.sent_contacts / campaign.total_contacts) * 100) || 0;
               return (
                <div key={campaign.id} onClick={() => openDetails(campaign)} className="ios-card group hover:border-[#FF6600]/80/30 transition-all duration-300 cursor-pointer text-left flex flex-col h-full relative z-10 pointer-events-auto">
                   <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                         <div className="p-3 rounded-xl bg-[#FF6600]/80/10 border border-[#FF6600]/80/20 text-indigo-400 group-hover:scale-110 transition-transform">
                           <Rocket className="w-6 h-6" />
                         </div>
                         <button 
                            onClick={(event) => { event.stopPropagation(); openDetails(campaign); }}
                            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10 hover:text-white"
                         >
                            <Settings2 className="w-4 h-4" />
                         </button>
                      </div>
                      {progressPercent === 100 ? (
                         <span className="badge badge-glow-success bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{t('crm.campaigns.statusFinished')}</span>
                      ) : campaign.status === 'paused' ? (
                         <span className="badge badge-glow-error bg-rose-500/10 text-rose-400 border-rose-500/20 uppercase">{t('crm.campaigns.statusPaused')}</span>
                      ) : progressPercent > 0 ? (
                         <span className="badge badge-glow-warning bg-amber-500/10 text-amber-500 border-amber-500/20">{t('crm.campaigns.statusRunning')}</span>
                      ) : (
                         <span className="badge bg-[#FF6600]/80/10 text-indigo-400 border-[#FF6600]/80/20">{t('crm.campaigns.statusUpcoming')}</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                       <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400">
                          <Settings2 className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wide">
                             {campaign.sent_contacts > 0 ? t('crm.campaigns.phasesCount', { current: Math.min(campaign.current_step + 1, campaign.total_steps), total: campaign.total_steps }) : t('crm.campaigns.pendingActivation')}
                          </span>
                       </div>
                    </div>
                    <div className="mb-4">
                       <h3 className="text-xl font-black text-white uppercase tracking-tighter group-hover:text-indigo-400 transition-colors truncate">{campaign.name}</h3>
                       <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">{t('crm.campaigns.ref', { id: campaign.id })}</p>
                    </div>
                    
                   <div className="space-y-4 flex-1">
                      <div className="flex justify-between items-end mb-1">
                         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('crm.campaigns.progress')}</p>
                         <p className="text-xs font-black text-white">{progressPercent}%</p>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                         <div className="h-full bg-[#FF6600]/80 transition-all duration-700" style={{ width: `${progressPercent}%` }} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2">
                         <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t('crm.campaigns.audience')}</p>
                            <p className="text-lg font-black text-white">{campaign.total_contacts}</p>
                         </div>
                         <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{t('crm.campaigns.sent')}</p>
                            <p className="text-lg font-black text-emerald-400">{campaign.sent_contacts}</p>
                         </div>
                      </div>
                   </div>

                   <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                         {progressPercent === 100 ? t('crm.campaigns.reviewLog') : t('crm.campaigns.editPipeline')}
                      </span>
                      <button 
                         onClick={(event) => { event.stopPropagation(); openDetails(campaign); }}
                         className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs hover:text-white transition-colors"
                      >
                         {t('crm.campaigns.manage')} <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{t('crm.campaigns.newCampaign')}</h3>
                  <p className="text-sm text-slate-400 font-bold">{t('crm.campaigns.newCampaignSubtitle')}</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
              </header>
              
              <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                 {/* Left: Settings */}
                 <div className="w-full md:w-1/2 p-8 overflow-y-auto custom-scrollbar border-r border-white/5 space-y-8">
                    <div className="space-y-6">
                       <div>
                         <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{t('crm.campaigns.campaignName')}</label>
                         <input required type="text" value={form.name} onChange={event => setForm({...form, name: event.target.value})} placeholder={t('crm.campaigns.namePlaceholder')} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#FF6600]/80/50 font-bold" />
                       </div>
                       <div>
                         <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{t('crm.campaigns.formLogic')}</label>
                         <select value={form.form_id} onChange={event => setForm({...form, form_id: event.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none appearance-none font-bold">
                            <option value="" className="bg-[#080810]">{t('crm.campaigns.noFormRequired')}</option>
                            {forms.map(form => <option key={form.form_id} value={form.form_id} className="bg-[#080810]">{form.name}</option>)}
                         </select>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="flex items-center justify-between">
                         <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-2">{t('crm.campaigns.sequencePipeline')}</h4>
                         <button type="button" onClick={() => addStep(false)} className="px-3 py-1 bg-[#FF6600]/80/10 text-indigo-400 text-[10px] font-bold uppercase rounded-lg border border-[#FF6600]/80/20 hover:bg-[#FF6600]/80 hover:text-white transition-all">{t('crm.campaigns.addFollowUp')}</button>
                       </div>
                       <div className="space-y-4">
                          {form.steps.map((step, index) => (
                             <div key={index} className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                               <div className="flex items-center justify-between">
                                 <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{t('crm.campaigns.emailStep', { idx: index + 1 })}</span>
                                 {index > 0 && <button type="button" onClick={() => removeStep(index, false)} className="text-rose-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>}
                               </div>
                               <input placeholder={t('crm.campaigns.subjectPlaceholder')} value={step.subject} onChange={event => updateStep(index, 'subject', event.target.value, false)} className="w-full bg-transparent border-b border-white/10 py-1 text-sm font-bold text-white outline-none" />
                               <div className="grid grid-cols-2 gap-4">
                                  <select value={step.wait_type} onChange={event => updateStep(index, 'wait_type', event.target.value, false)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white outline-none font-black uppercase tracking-widest">
                                     {index === 0 ? <><option value="instant">{t('crm.campaigns.instant')}</option><option value="date">{t('crm.campaigns.date')}</option></> : <><option value="days">{t('crm.campaigns.days')}</option><option value="hours">{t('crm.campaigns.hours')}</option><option value="minutes">{t('crm.campaigns.minutes')}</option></>}
                                  </select>
                                  {['days', 'hours', 'minutes'].includes(step.wait_type) && (
                                     <input 
                                        type="number" 
                                        placeholder={t('crm.campaigns.delayPlaceholder', { unit: waitTypeLabels[step.wait_type] })}
                                        value={step.wait_type === 'days' ? step.delay_days : (step.wait_type === 'hours' ? step.delay_hours : step.delay_minutes)} 
                                        onChange={event => {
                                           const value = parseInt(event.target.value);
                                           if (step.wait_type === 'days') updateStep(index, 'delay_days', value, false);
                                           else if (step.wait_type === 'hours') updateStep(index, 'delay_hours', value, false);
                                           else updateStep(index, 'delay_minutes', value, false);
                                        }} 
                                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white" 
                                     />
                                  )}
                                  {step.wait_type === 'date' && <input type="datetime-local" value={step.scheduled_date} onChange={event => updateStep(index, 'scheduled_date', event.target.value, false)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white" />}
                               </div>
                               <textarea value={step.body} onChange={event => updateStep(index, 'body', event.target.value, false)} rows="3" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-slate-400 outline-none focus:text-white transition-colors resize-none" />
                             </div>
                          ))}
                       </div>
                    </div>
                 </div>

                 {/* Right: Target Picker */}
                 <div className="w-full md:w-1/2 p-8 overflow-y-auto custom-scrollbar flex flex-col bg-[#0d0d18]/30">
                    <div className="flex items-center justify-between mb-6">
                       <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('crm.campaigns.selectAudience')}</h4>
                       <span className="badge badge-glow-success bg-emerald-500/10 text-emerald-400">{t('crm.campaigns.activeTargets', { count: form.cids.length })}</span>
                    </div>

                    <div className="mb-6">
                       <p className="text-[10px] font-bold text-slate-600 uppercase mb-2 tracking-widest">{t('crm.campaigns.pickFamilies')}</p>
                       <div className="flex flex-wrap gap-2">
                          {families.map(family => (
                             <button key={family.id} type="button" onClick={() => selectFamily(family.name, false)} className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-[10px] font-bold text-slate-400 hover:border-[#FF6600]/80/50 hover:text-white transition-all uppercase">
                                + {family.name}
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="relative mb-4">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                       <input type="text" placeholder={t('crm.campaigns.searchIndividuals')} value={searchContacts} onChange={event => setSearchContacts(event.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-xs text-white outline-none" />
                    </div>
                    <div className="flex-1 space-y-2">
                       {contacts.filter(contact => contact.name.toLowerCase().includes(searchContacts.toLowerCase())).map(contact => (
                          <div key={contact.cid} onClick={() => toggleContact(contact.cid)} className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${form.cids.includes(contact.cid) ? 'bg-[#FF6600]/80/10 border-[#FF6600]/80' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                             <div>
                                <p className="text-xs font-black text-white">{contact.name}</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">{t(GROUP_LABELS[contact.group_name] || '') || contact.group_name || t('crm.campaigns.individual')}</p>
                             </div>
                             {form.cids.includes(contact.cid) && <CheckCircle className="w-4 h-4 text-indigo-400" />}
                          </div>
                       ))}
                    </div>
                 </div>
              </div>

              <footer className="px-8 py-6 border-t border-white/5 bg-[#0d0d18] flex justify-end gap-4 flex-shrink-0">
                 <button onClick={() => setShowCreateModal(false)} className="btn-ghost !px-8 text-xs">{t('crm.campaigns.cancel')}</button>
                 <button onClick={submitCampaign} disabled={isSubmitting} className="btn-prime !px-10 text-xs shadow-[#FF6600]/30 flex items-center gap-2">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isSubmitting ? t('crm.campaigns.initiating') : t('crm.campaigns.fireCampaign')}
                 </button>
              </footer>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedCampaign && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto p-4">
            <div onClick={() => setShowDetailsModal(false)} className="absolute inset-0 bg-black/95 backdrop-blur-md cursor-pointer" />
            <div className="relative w-full max-w-6xl ios-card !p-0 shadow-2xl bg-[#080810] border border-white/10 flex flex-col h-[90vh] text-left overflow-y-auto">
              <header className="px-4 md:px-10 py-4 md:py-8 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 bg-[#0d0d18] flex-shrink-0">
                <div className="flex items-center gap-6">
                   <div className="w-16 h-16 rounded-2xl bg-[#FF6600]/80/10 border border-[#FF6600]/80/20 flex items-center justify-center text-indigo-400">
                     <Rocket className="w-8 h-8" />
                   </div>
                   <div>
                     <input 
                        disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts}
                        className="text-3xl font-black text-white bg-transparent outline-none focus:border-b-2 border-[#FF6600]/80 uppercase tracking-tighter disabled:opacity-50 w-full max-w-lg" 
                        value={selectedCampaign.name} 
                        onChange={event => setSelectedCampaign({...selectedCampaign, name: event.target.value})} 
                     />
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {selectedCampaign.sent_contacts >= selectedCampaign.total_contacts ? t('crm.campaigns.historicalArchive') : t('crm.campaigns.activeDispatchPipeline')} 
                     </p>
                   </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-3 mr-4 pr-6 border-r border-white/5">
                        <div className="flex flex-col items-end">
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">{t('crm.campaigns.masterSwitch')}</span>
                           <span className={`text-[10px] font-bold uppercase tracking-widest ${selectedCampaign.status === 'paused' ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {selectedCampaign.status === 'paused' ? t('crm.campaigns.campaignOff') : t('crm.campaigns.campaignOn')}
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
                       className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white p-3 rounded-xl border border-rose-500/20 transition-all font-bold text-[10px] flex items-center gap-2 uppercase tracking-widest shadow-lg shadow-rose-500/10 pr-5"
                    >
                       <Trash2 className="w-4 h-4" />
                       {t('crm.campaigns.destroy')}
                    </button>
                    {selectedCampaign.sent_contacts < selectedCampaign.total_contacts && (
                       <button onClick={updateCampaign} disabled={isSubmitting} className="btn-prime bg-emerald-500 hover:bg-emerald-600 !px-8 shadow-emerald-600/20">
                         {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                         {t('crm.campaigns.saveModifications')}
                       </button>
                    )}
                    <button onClick={() => setShowDetailsModal(false)} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/10 transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
                </div>
              </header>

              <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                 {/* Sidebar */}
                 <div className="w-full md:w-1/3 p-4 md:p-10 overflow-y-auto border-r border-white/5 bg-white/[0.01]">
                    <div className="space-y-12">
                       <section className="space-y-6">
                          <div className="flex items-center justify-between border-b border-white/5 pb-4">
                             <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('crm.campaigns.targetSelection')}</h4>
                             <span className="badge badge-glow-success bg-[#FF6600]/80/10 text-indigo-400 border-[#FF6600]/80/20">{t('crm.campaigns.contactsCount', { count: selectedCampaign.cids?.length })}</span>
                          </div>
                          
                          {selectedCampaign.sent_contacts < selectedCampaign.total_contacts && (
                            <div className="space-y-4">
                               <p className="text-[10px] font-bold text-slate-600 uppercase mb-2 tracking-widest">{t('crm.campaigns.addFamilies')}</p>
                               <div className="flex flex-wrap gap-2">
                                  {families.map(family => (
                                     <button key={family.id} onClick={() => selectFamily(family.name, true)} className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-[10px] font-bold text-slate-400 hover:border-[#FF6600]/80/50 hover:text-white transition-all uppercase">+ {family.name}</button>
                                  ))}
                               </div>
                            </div>
                          )}

                          <div className="relative">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                             <input type="text" placeholder={t('crm.campaigns.searchAudience')} value={searchContacts} onChange={event => setSearchContacts(event.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-[10px] text-white outline-none" />
                          </div>
                          
                          <div className="max-h-[350px] overflow-y-auto custom-scrollbar space-y-2 border-t border-white/5 pt-4">
                             {contacts.filter(contact => contact.name.toLowerCase().includes(searchContacts.toLowerCase())).map(contact => {
                                const isPicked = selectedCampaign.cids?.includes(contact.cid);
                                return (
                                   <div key={contact.cid} onClick={() => {
                                      if (selectedCampaign.sent_contacts >= selectedCampaign.total_contacts) return;
                                      const nextCids = isPicked ? selectedCampaign.cids.filter(contactId => contactId !== contact.cid) : [...selectedCampaign.cids, contact.cid];
                                      setSelectedCampaign({...selectedCampaign, cids: nextCids});
                                   }} className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${isPicked ? 'bg-[#FF6600]/80/10 border-[#FF6600]/80/50' : 'bg-white/5 border-white/5 hover:bg-white/10'} ${selectedCampaign.sent_contacts >= selectedCampaign.total_contacts ? 'cursor-default' : ''}`}>
                                      <div>
                                         <p className="text-[10px] font-black text-white truncate">{contact.name}</p>
                                         <p className="text-[10px] text-slate-500 font-bold uppercase">{t(GROUP_LABELS[contact.group_name] || '') || contact.group_name || t('crm.campaigns.individual')}</p>
                                      </div>
                                      {isPicked && <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />}
                                   </div>
                                );
                             })}
                          </div>
                       </section>

                       <section className="space-y-6">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-4">{t('crm.campaigns.logicConfig')}</h4>
                          <div className="space-y-4">
                             <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500 uppercase tracking-widest">{t('crm.campaigns.activeForm')}</span>
                                <select disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts} value={selectedCampaign.form_id || ''} onChange={event => setSelectedCampaign({...selectedCampaign, form_id: event.target.value})} className="bg-transparent text-white text-right outline-none disabled:opacity-50">
                                   <option value="" className="bg-[#080810]">{t('crm.campaigns.none')}</option>
                                   {forms.map(form => <option key={form.form_id} value={form.form_id} className="bg-[#080810]">{form.name}</option>)}
                                </select>
                             </div>
                             <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500 uppercase tracking-widest">{t('crm.campaigns.createdOn')}</span>
                                <span className="text-white opacity-40 uppercase tracking-widest text-[10px]">{formatLocaleDate(selectedCampaign.created_at, {}, lang)}</span>
                             </div>
                          </div>
                       </section>
                    </div>
                 </div>

                 {/* Main Pipeline */}
                 <div className="flex-1 p-4 md:p-10 overflow-y-auto bg-transparent custom-scrollbar">
                    <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wide mb-8 flex items-center gap-3">
                       <Settings2 className="w-5 h-5" /> {t('crm.campaigns.pipelineSequenceModification')}
                    </h4>
                    
                    <div className="space-y-8">
                       {editingSteps.map((step, index) => (
                          <div key={index} className="ios-card border-white/10 group relative">
                             <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center font-black text-white text-lg">{index + 1}</div>
                                   <div className="flex-1 min-w-[200px]">
                                      <div className="flex items-center justify-between mb-1">
                                         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{index === 0 ? t('crm.campaigns.anchorStep') : t('crm.campaigns.followUpStep', { idx: index })}</p>
                                         {step.delivered_count > 0 && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                               <CheckCircle className="w-3 h-3" />
                                               <span className="text-[10px] font-bold uppercase tracking-wide">{t('crm.campaigns.receivedBy', { count: step.delivered_count })}</span>
                                            </div>
                                         )}
                                      </div>
                                      <h5 className="text-sm font-black text-white uppercase tracking-tighter">
                                         {step.wait_type === 'instant' ? t('crm.campaigns.instantDispatch') : (step.wait_type === 'date' ? t('crm.campaigns.scheduled', { date: step.scheduled_date || '?' }) : t('crm.campaigns.waitDuration', { count: step.delay_days || step.delay_hours || step.delay_minutes || 0, unit: waitTypeLabels[step.wait_type] }))}
                                      </h5>
                                   </div>
                                </div>
                                <div className="flex gap-2">
                                   <select disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts} value={step.wait_type} onChange={event => updateStep(index, 'wait_type', event.target.value, true)} className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-[10px] font-black text-white uppercase tracking-widest outline-none disabled:opacity-30">
                                      {index === 0 ? <><option value="instant">{t('crm.campaigns.instant')}</option><option value="date">{t('crm.campaigns.date')}</option></> : <><option value="days">{t('crm.campaigns.days')}</option><option value="hours">{t('crm.campaigns.hours')}</option><option value="minutes">{t('crm.campaigns.minutes')}</option></>}
                                   </select>
                                   {index > 0 && selectedCampaign.sent_contacts < selectedCampaign.total_contacts && (
                                      <button onClick={() => removeStep(index, true)} className="text-rose-500 hover:text-rose-400 p-2 transition-colors"><Trash2 className="w-5 h-5" /></button>
                                   )}
                                </div>
                             </div>

                             <div className="space-y-6">
                                <div className="space-y-2">
                                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('crm.campaigns.emailSubject')}</label>
                                   <input 
                                       disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts}
                                       value={step.subject} 
                                       onChange={event => updateStep(index, 'subject', event.target.value, true)} 
                                       className="w-full bg-transparent border-b border-white/10 pb-2 text-xl font-black text-white outline-none focus:border-[#FF6600]/80 transition-colors uppercase tracking-tighter disabled:opacity-30" 
                                   />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                   {['days', 'hours', 'minutes'].includes(step.wait_type) && (
                                      <div>
                                         <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">{t('crm.campaigns.waitDurationLabel', { unit: waitTypeLabels[step.wait_type] })}</label>
                                         <input 
                                            disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts}
                                            type="number" 
                                            value={step.delay_days || step.delay_hours || step.delay_minutes || 0} 
                                            onChange={event => {
                                               const value = parseInt(event.target.value);
                                               if (step.wait_type === 'days') updateStep(index, 'delay_days', value, true);
                                               else if (step.wait_type === 'hours') updateStep(index, 'delay_hours', value, true);
                                               else updateStep(index, 'delay_minutes', value, true);
                                            }} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white font-bold disabled:opacity-30" 
                                         />
                                      </div>
                                   )}
                                   {step.wait_type === 'date' && (
                                      <div>
                                         <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">{t('crm.campaigns.targetDateTime')}</label>
                                         <input 
                                            disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts}
                                            type="datetime-local" 
                                            value={step.scheduled_date} 
                                            onChange={event => updateStep(index, 'scheduled_date', event.target.value, true)} 
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white disabled:opacity-30" 
                                         />
                                      </div>
                                   )}
                                </div>
                                <div>
                                   <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">{t('crm.campaigns.messageContent')}</label>
                                   <textarea 
                                      disabled={selectedCampaign.sent_contacts >= selectedCampaign.total_contacts}
                                      value={step.body} 
                                      onChange={event => updateStep(index, 'body', event.target.value, true)} 
                                      rows="5" 
                                      className="w-full bg-white/5 border border-white/5 rounded-2xl p-6 text-sm text-slate-400 outline-none focus:text-white transition-colors leading-relaxed font-medium disabled:opacity-30" 
                                   />
                                </div>
                             </div>
                             
                             {index < editingSteps.length - 1 && (
                                <div className="flex justify-center -mb-20 mt-10 relative z-10">
                                   <div className="p-2 rounded-full bg-[#080810] border border-white/10 text-indigo-400">
                                      <ArrowRight className="w-6 h-6 rotate-90" />
                                   </div>
                                </div>
                             )}
                          </div>
                       ))}
                       {selectedCampaign.sent_contacts < selectedCampaign.total_contacts && (
                          <button onClick={() => addStep(true)} className="w-full py-6 border-2 border-dashed border-white/5 rounded-3xl text-slate-500 hover:text-indigo-400 hover:border-[#FF6600]/80/30 hover:bg-[#FF6600]/80/5 transition-all text-[10px] font-bold uppercase tracking-widest">{t('crm.campaigns.addSequentialMessage')}</button>
                       )}
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
