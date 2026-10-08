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

export default function CampaignsDetailsModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  isSubmitting,
  selectedCampaign,
  setSelectedCampaign,
  families,
  contacts,
  forms,
  searchContacts,
  setSearchContacts,
  editingSteps,
  setEditingSteps,
  updateStep,
  removeStep,
  selectFamily,
  openDetails,
  deleteCampaign,
  updateCampaign,
  t,
  lang,
  formatLocaleDate,
}) {
  if (!isOpen || !selectedCampaign) return null;

  const progressPercent = Math.round((selectedCampaign.sent_contacts / selectedCampaign.total_contacts) * 100) || 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/95 backdrop-blur-md cursor-pointer" />
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
               onClick={() => onDelete(selectedCampaign.id)}
               disabled={isSubmitting} 
               className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white p-3 rounded-xl border border-rose-500/20 transition-all font-bold text-[10px] flex items-center gap-2 uppercase tracking-widest shadow-lg shadow-rose-500/10 pr-5"
            >
               <Trash2 className="w-4 h-4" />
               {t('crm.campaigns.destroy')}
            </button>
            {selectedCampaign.sent_contacts < selectedCampaign.total_contacts && (
               <button onClick={onSave} disabled={isSubmitting} className="btn-prime bg-emerald-500 hover:bg-emerald-600 !px-8 shadow-emerald-600/20">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {t('crm.campaigns.saveModifications')}
               </button>
            )}
            <button onClick={onClose} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/10 transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
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
                                 {step.wait_type === 'instant' ? t('crm.campaigns.instantDispatch') : (step.wait_type === 'date' ? t('crm.campaigns.scheduled', { date: step.scheduled_date || '?' }) : t('crm.campaigns.waitDuration', { count: step.delay_days || step.delay_hours || step.delay_minutes || 0, unit: waitTypeLabels(t)[step.wait_type] }))}
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
                                 <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">{t('crm.campaigns.waitDurationLabel', { unit: waitTypeLabels(t)[step.wait_type] })}</label>
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
                              <ChevronRight className="w-6 h-6 rotate-90" />
                           </div>
                        </div>
                     )}
                  </div>
               ))}
               {selectedCampaign.sent_contacts < selectedCampaign.total_contacts && (
                  <button onClick={() => setEditingSteps([...editingSteps, { subject: 'Follow-up: {{campaign}}', body: 'Hello {{name}},\n\nJust a reminder to check your portal.\n\nLink: {{link}}', wait_type: 'days', delay_days: 3, delay_minutes: 0, delay_hours: 0, specific_time: '', scheduled_date: '' }])} className="w-full px-3 py-1 bg-[#FF6600]/80/10 text-indigo-400 text-[10px] font-bold uppercase rounded-lg border border-[#FF6600]/80/20 hover:bg-[#FF6600]/80 hover:text-white transition-all">{t('crm.campaigns.addFollowUp')}</button>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}