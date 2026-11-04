"use client";

import { Plus, Send, Settings2, CheckCircle, Search, Rocket, X, Loader2, Trash2, ArrowRight, ChevronRight, ArrowLeft } from 'lucide-react';
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

export default function CampaignsList({
  filteredCampsList,
  loading,
  campaigns,
  families,
  contacts,
  activeTab,
  setActiveTab,
  hideCompleted,
  setHideCompleted,
  searchContacts,
  setSearchContacts,
  openDetails,
  t,
  lang,
  formatLocaleDate,
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-20"><Loader2 className="w-10 h-10 text-[#FF6600]/80 animate-spin" /></div>
    );
  }

  if (filteredCampsList.length === 0) {
    return (
      <div className="p-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
        <Rocket className="w-16 h-16 text-slate-500 mx-auto mb-6 opacity-30" />
        <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">{t('crm.campaigns.emptyState')}</h4>
        <p className="text-slate-400 text-sm font-bold">{t('crm.campaigns.emptyStateBody')}</p>
      </div>
    );
  }

  return (
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
  );
}