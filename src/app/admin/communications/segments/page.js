'use client';
import React, { useState } from 'react';
import { Filter, Rocket, Save, X, Loader2, Plus, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useSafeBack } from '@/lib/useSafeBack';
import { useApi } from '@/lib/hooks/useApi';

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop.
const pickSegments = (payload) => (payload?.success ? payload.segments || [] : []);
const pickCampaigns = (payload) => (payload?.success ? payload.campaigns || [] : []);
const pickForms = (payload) => (payload?.success ? payload.forms || [] : []);

const SEGMENT_KEY_LABELS = {
  campaign_id: 'crm.segments.filterKeyCampaign',
  status: 'crm.segments.filterKeyStatus',
};

const SEGMENT_VALUE_LABELS = {
  yes: 'crm.segments.statusYes',
  no: 'crm.segments.statusNo',
  NOT_RESPONDED: 'crm.segments.statusWaiting',
};

export default function SegmentsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const goBack = useSafeBack('/admin/crm');
  // Three reads, each carrying its own loading flag so the screen leaves the
  // spinner only once all three have settled, exactly as the old combined loader
  // did. Their cache-first paint and stale-response handling belong to the hook,
  // so the screen keeps no data state of its own and never sets state from an
  // effect.
  const { data: segments, loading: segmentsLoading, refresh: refreshSegments } = useApi(
    '/api/segments',
    { defaultValue: [], transform: pickSegments },
  );
  const { data: campaigns, loading: campaignsLoading, refresh: refreshCampaigns } = useApi(
    '/api/campaigns',
    { defaultValue: [], transform: pickCampaigns },
  );
  const { data: forms, loading: formsLoading, refresh: refreshForms } = useApi(
    '/api/forms',
    { defaultValue: [], transform: pickForms },
  );
  const loading = segmentsLoading || campaignsLoading || formsLoading;
  // Saving a segment must not read back from the cache, so all three reads are
  // refreshed the way the old bypassCache argument did.
  const refreshAll = () => {
    refreshSegments();
    refreshCampaigns();
    refreshForms();
  };
  
  // State for segment builder
  const [showBuilder, setShowBuilder] = useState(false);
  const [filters, setFilters] = useState({ campaign_id: '', status: '' });
  const [segmentName, setSegmentName] = useState('');
  const [previewContacts, setPreviewContacts] = useState([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // State for Campaign Launcher
  const [showLauncher, setShowLauncher] = useState(false);
  const [activeSegment, setActiveSegment] = useState(null);
  const [campaignConfig, setCampaignConfig] = useState({ name: '', form_id: '' });
  const [isLaunching, setIsLaunching] = useState(false);

  const runPreview = async (currentFilters) => {
    setIsPreviewing(true);
    try {
      const response = await fetch('/api/segments/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: currentFilters })
      });
      const payload = await response.json();
      if (payload.success) {
        setPreviewContacts(payload.contacts);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleFilterChange = (key, value) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    runPreview(nextFilters);
  };

  const saveSegment = async () => {
    if (!segmentName) {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: t("crm.segments.nameSegmentFirst") } 
      }));
      return;
    }
    if (previewContacts.length === 0) {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: t("crm.segments.noPeopleInFilter") } 
      }));
      return;
    }
    
    try {
      const response = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: segmentName, filters })
      });
      const payload = await response.json();
      if (payload.success) {
        refreshAll();
        setShowBuilder(false);
        setFilters({ campaign_id: '', status: '' });
        setSegmentName('');
        setPreviewContacts([]);
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: t("crm.segments.savedList", { name: segmentName }) } 
        }));
      }
    } catch (err) { console.error(err); }
  };

  const openLauncher = async (segment) => {
    setActiveSegment(segment);
    const response = await fetch('/api/segments/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters: segment.filters })
    });
    const payload = await response.json();
    if (payload.success) {
      setPreviewContacts(payload.contacts);
      setShowLauncher(true);
    }
  };

  const launchCampaign = async (event) => {
    event.preventDefault();
    if (!campaignConfig.name || previewContacts.length === 0) {
      window.dispatchEvent(new CustomEvent('impactos:notify', { 
         detail: { type: 'error', message: t("crm.segments.nameCampaignFirst") } 
      }));
      return;
    }
    setIsLaunching(true);
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: campaignConfig.name, 
          form_id: campaignConfig.form_id, 
          cids: previewContacts.map(contact => contact.cid),
          segment_id: activeSegment.id
        })
      });
      const payload = await response.json();
      if (payload.success) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'success', message: t("crm.segments.campaignStarted") } 
        }));
        router.push('/admin/communications/campaigns');
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { 
           detail: { type: 'error', message: t(payload.error || "") || payload.error } 
        }));
      }
    } catch (err) { console.error(err); } finally {
      setIsLaunching(false);
    }
  };

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
            <h2 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase mb-2">{t("crm.segments.title")}</h2>
            <p className="text-[var(--text-secondary)] font-bold tracking-tight">{t("crm.segments.subtitle")}</p>
          </div>
          <button 
            onClick={() => { setShowBuilder(true); runPreview(filters); }} 
            className="btn-prime !py-4 shadow-[#FF6600]/10"
          >
            <Plus className="w-5 h-5 mr-2" /> {t("crm.segments.createNew")}
          </button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="w-10 h-10 text-[#FF6600]/80 animate-spin" />
          </div>
        ) : segments.length === 0 ? (
          <div className="p-20 text-center bg-[var(--surface-2)] border border-dashed border-[var(--border-primary)] rounded-[3rem]">
            <Filter className="w-16 h-16 text-[var(--text-secondary)] mx-auto mb-6 opacity-50" />
            <h4 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter mb-2">{t("crm.segments.noSegments")}</h4>
            <p className="text-[var(--text-secondary)] text-sm font-bold">{t("crm.segments.noSegmentsYet")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {segments.map(segment => (
              <div key={segment.id} className="ios-card group hover:border-[#FF6600]/30 transition-all duration-300 flex flex-col justify-between text-left">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 rounded-xl bg-[#FF6600]/10 border border-[#FF6600]/20 text-indigo-400">
                      <Filter className="w-6 h-6" />
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter mb-2 group-hover:text-indigo-400 transition-colors">{segment.name}</h3>
                  <div className="text-xs text-[var(--text-secondary)] font-bold flex flex-wrap gap-2 mb-6">
                    {Object.entries(segment.filters).map(([filterKey, filterValue]) => filterValue && (
                      <span key={filterKey} className="px-2 py-1 bg-[var(--surface-2)] rounded-md border border-[var(--border-primary)] uppercase tracking-widest">{t(SEGMENT_KEY_LABELS[filterKey] || '') || filterKey}: {t(SEGMENT_VALUE_LABELS[filterValue] || '') || filterValue}</span>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t border-[var(--border-primary)] mt-auto">
                  <button 
                    onClick={() => openLauncher(segment)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[#FF6600]/10 hover:bg-[#FF6600]/80 text-indigo-400 hover:text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all border border-[#FF6600]/20 group-hover:border-[#FF6600]/50"
                  >
                    <Rocket className="w-4 h-4" /> {t("crm.segments.startCampaign")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showBuilder && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto">
            <div onClick={() => setShowBuilder(false)} className="absolute inset-0 bg-black/80" />
            <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col ios-card !p-0 shadow-2xl bg-[var(--surface-1)] border border-[var(--border-primary)] m-4 overflow-hidden text-left">
              <header className="px-8 py-6 border-b border-[var(--border-primary)] flex items-center justify-between bg-[var(--surface-2)] flex-shrink-0">
                <div>
                  <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{t("crm.segments.newSegment")}</h3>
                  <p className="text-sm text-[var(--text-secondary)] font-bold">{t("crm.segments.newSegmentSubtitle")}</p>
                </div>
                <button onClick={() => setShowBuilder(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"><X className="w-6 h-6" /></button>
              </header>
              <div className="flex-1 overflow-auto flex flex-col md:flex-row h-full">
                 <div className="w-full md:w-1/2 p-8 border-b md:border-b-0 md:border-r border-[var(--border-primary)] space-y-6">
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2">{t("crm.segments.segmentName")}</label>
                      <input type="text" value={segmentName} onChange={event => setSegmentName(event.target.value)} placeholder={t("crm.segments.segmentNamePlaceholder")} className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[#FF6600]/50 font-bold" />
                    </div>
                    <div className="space-y-4">
                      <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest pt-4 border-t border-[var(--border-primary)]">{t("crm.segments.filters")}</label>
                      <div>
                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">{t("crm.segments.fromCampaign")}</label>
                        <select value={filters.campaign_id} onChange={event => handleFilterChange('campaign_id', event.target.value)} className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[#FF6600]/50 appearance-none font-bold">
                           <option value="" className="bg-[var(--surface-1)]">{t("crm.segments.anyCampaign")}</option>
                           {campaigns.map(campaign => <option key={campaign.id} value={campaign.id} className="bg-[var(--surface-1)]">{campaign.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">{t("crm.segments.status")}</label>
                        <select value={filters.status} onChange={event => handleFilterChange('status', event.target.value)} className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[#FF6600]/50 appearance-none font-bold">
                           <option value="" className="bg-[var(--surface-1)]">{t("crm.segments.statusEveryone")}</option>
                           <option value="yes" className="bg-[var(--surface-1)]">{t("crm.segments.statusYes")}</option>
                           <option value="no" className="bg-[var(--surface-1)]">{t("crm.segments.statusNo")}</option>
                           <option value="NOT_RESPONDED" className="bg-[var(--surface-1)]">{t("crm.segments.statusWaiting")}</option>
                        </select>
                      </div>
                    </div>
                    <div className="pt-6 mt-auto">
                      <button onClick={saveSegment} className="w-full btn-prime !py-4 shadow-[#FF6600]/20 text-sm flex items-center justify-center gap-2">
                        <Save className="w-4 h-4" /> {t("crm.segments.saveSegment")}
                      </button>
                    </div>
                 </div>
                 <div className="w-full md:w-1/2 p-8 bg-[var(--surface-2)]">
                    <div className="flex items-center justify-between mb-6">
                       <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("crm.segments.preview")}</h4>
                       <span className="badge badge-glow-success bg-[#FF6600]/20 text-indigo-400">{t("crm.segments.peopleCount", { count: previewContacts.length })}</span>
                    </div>
                    {isPreviewing ? (
                      <div className="flex items-center justify-center p-10"><Loader2 className="w-8 h-8 text-[#FF6600]/80 animate-spin" /></div>
                    ) : (
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                         {previewContacts.length === 0 ? (
                           <p className="text-xs text-[var(--text-secondary)] font-bold text-center py-10">{t("crm.segments.noMatches")}</p>
                         ) : previewContacts.map(contact => (
                           <div key={contact.cid} className="p-3 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl flex items-center justify-between">
                              <span className="font-bold text-sm text-[var(--text-primary)]">{contact.name}</span>
                              <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest">{contact.email}</span>
                           </div>
                         ))}
                      </div>
                    )}
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* Campaign Launcher Modal */}
        {showLauncher && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center pointer-events-auto">
            <div onClick={() => setShowLauncher(false)} className="absolute inset-0 bg-black/80" />
            <div className="relative w-full max-w-md ios-card !p-8 shadow-2xl bg-[var(--surface-1)] border border-[var(--border-primary)] m-4 text-left">
              <button onClick={() => setShowLauncher(false)} className="absolute top-6 right-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"><X className="w-5 h-5" /></button>
              <div className="mb-8">
                <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter mb-2">{t("crm.segments.newCampaign")}</h3>
                <p className="text-sm text-[var(--text-secondary)] font-bold">{t("crm.segments.launchForPeople")} <span className="text-[var(--text-primary)] font-black">{previewContacts.length}</span> {t("crm.segments.launchPeople")}</p>
              </div>
              <form onSubmit={launchCampaign} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2">{t("crm.segments.campaignName")}</label>
                  <input required autoFocus type="text" value={campaignConfig.name} onChange={event => setCampaignConfig({...campaignConfig, name: event.target.value})} placeholder={t("crm.segments.campaignNamePlaceholder")} className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-3 pb-2 text-[var(--text-primary)] outline-none focus:border-[#FF6600]/50 focus:bg-[var(--surface-3)] transition-colors font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2">{t("crm.segments.formOptional")}</label>
                  <select value={campaignConfig.form_id} onChange={event => setCampaignConfig({...campaignConfig, form_id: event.target.value})} className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-3 pb-2 text-[var(--text-primary)] outline-none focus:border-[#FF6600]/50 focus:bg-[var(--surface-3)] transition-colors font-bold appearance-none">
                     <option value="" className="bg-[var(--surface-1)]">{t("crm.segments.noForm")}</option>
                     {forms.map(form => <option key={form.form_id} value={form.form_id} className="bg-[var(--surface-1)]">{form.name}</option>)}
                  </select>
                </div>
                <div className="pt-4">
                  <button type="submit" disabled={isLaunching} className="w-full btn-prime !py-4 shadow-[#FF6600]/20 text-sm disabled:opacity-50 flex justify-center items-center">
                    {isLaunching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Rocket className="w-4 h-4 mr-2" />}
                    {isLaunching ? t("crm.segments.starting") : t("crm.segments.startNow")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
