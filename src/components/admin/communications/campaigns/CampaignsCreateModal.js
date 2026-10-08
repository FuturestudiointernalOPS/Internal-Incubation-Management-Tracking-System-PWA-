"use client";

import { Plus, Send, Settings2, ArrowRight, Save, ChevronRight, ArrowLeft, X, Loader2, Trash2, Search, CheckCircle, Rocket } from 'lucide-react';
import Link from 'next/link';
import { formatLocaleDate } from '@/lib/constants';
import { useI18n } from '@/lib/i18n';
import { useSafeBack } from '@/lib/useSafeBack';
import { useDialogs } from '@/components/ui/DialogProvider';

const GROUP_LABELS = { UNASSIGNED: 'crm.contacts.unassigned' };
const tabLabels = (t) => ({
  all: t('crm.campaigns.tabAll'),
  running: t('crm.campaigns.tabRunning'),
  upcoming: t('crm.campaigns.tabUpcoming'),
  completed: t('crm.campaigns.tabCompleted'),
});
const waitTypeLabels = (t) => ({
  instant: t('crm.campaigns.instant'),
  date: t('crm.campaigns.date'),
  days: t('crm.campaigns.days'),
  hours: t('crm.campaigns.hours'),
  minutes: t('crm.campaigns.minutes'),
});

export default function CampaignsCreateModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  form,
  setForm,
  forms,
  families,
  contacts,
  searchContacts,
  setSearchContacts,
  addStep,
  updateStep,
  removeStep,
  toggleContact,
  selectFamily,
  t,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
      <div className="relative w-full max-w-4xl ios-card !p-0 shadow-2xl bg-[#080810] border border-white/10 flex flex-col h-[90vh] text-left">
        <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-[#0d0d18] flex-shrink-0 rounded-t-[2.5rem]">
          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{t('crm.campaigns.newCampaign')}</h3>
            <p className="text-sm text-slate-400 font-bold">{t('crm.campaigns.newCampaignSubtitle')}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
        </header>
        
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
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
                               placeholder={t('crm.campaigns.delayPlaceholder', { unit: waitTypeLabels(t)[step.wait_type] })}
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

          <div className="w-full md:w-1/2 p-8 overflow-y-auto custom-scrollbar flex flex-col bg-[#0d0d18]/30">
            <div className="flex items-center justify-between mb-6">
               <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('crm.campaigns.selectAudience')}</h4>
               <span className="badge badge-glow-success bg-emerald-500/10 text-emerald-400">{t('crm.campaigns.activeTargets', { count: form.cids.length })}</span>
            </div>

            <div className="mb-6">
               <p className="text-[10px] font-bold text-slate-600 uppercase mb-2 tracking-widest">{t('crm.campaigns.pickFamilies')}</p>
               <div className="flex flex-wrap gap-2">
                  {families.map(family => (
                     <button key={family.id} type="button" onClick={() => selectFamily(family.name, false)} className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-[10px] font-bold text-slate-400 hover:border-[#FF6600]/80/50 hover:text-white transition-all uppercase">+ {family.name}</button>
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
           <button onClick={onClose} className="btn-ghost !px-8 text-xs">{t('crm.campaigns.cancel')}</button>
           <button onClick={onSubmit} disabled={isSubmitting} className="btn-prime !px-10 text-xs shadow-[#FF6600]/30 flex items-center gap-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isSubmitting ? t('crm.campaigns.initiating') : t('crm.campaigns.fireCampaign')}
           </button>
        </footer>
      </div>
    </div>
  );
}