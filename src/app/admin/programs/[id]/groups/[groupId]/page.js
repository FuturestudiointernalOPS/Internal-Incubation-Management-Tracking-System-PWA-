'use client';

import React, { useState, useEffect, use, useCallback } from 'react';
import { 
  ChevronLeft, Save, Layers, Rocket,
  Shield,
  Users
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cacheGet, cacheSet } from '@/lib/hooks/useApi';
import { useSafeBack } from "@/lib/useSafeBack";

export default function GroupWorkspaceV2({ params }) {
  const unwrappedParams = use(params);
  const { id: programId, groupId } = unwrappedParams;
  const goBack = useSafeBack(`/admin/programs/${programId}`);
  const { t } = useI18n();
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [group, setGroup] = useState(null);
  const [, setLoading] = useState(false);

  const fetchGroup = useCallback(async (bypassCache = false) => {
    const url = `/api/v2/groups?program_id=${programId}`;
    const apply = (payload) => {
      const matchedGroup = payload.groups.find(candidate => String(candidate.id) === String(groupId));
      setGroup(matchedGroup);
      setIsLoaded(true);
    };
    let painted = false;
    try {
      // Cache-first paint: returning to this group workspace renders instantly
      // from a fresh snapshot of the program's groups.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          painted = true;
        }
      }
      const response = await fetch(url);
      const payload = await response.json();
      if (payload.success) cacheSet(url, payload);
      apply(payload);
    } catch (error) {
      if (!painted) console.error(error);
    }
  }, [programId, groupId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v2/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: groupId,
          name: group.name,
          project_description: group.project_description,
          demo_link: group.demo_link,
          resources_link: group.resources_link,
          pitch_deck_url: group.pitch_deck_url,
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: t('adminMisc.programGroups.anchorMetricsSuccess') } }));
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: payload.error || t('adminMisc.programGroups.updateFailed') } }));
      }
    } catch {
      window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t('adminMisc.programGroups.updateFailed') } }));
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || !group) return null;

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
           <button 
              onClick={goBack}
              className="btn-ghost !py-2 !px-4 hover:bg-white/5"
           >
              <ChevronLeft className="w-4 h-4 mr-2" /> {t('adminMisc.programGroups.programHq')}
           </button>
           <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
              <Layers className="text-indigo-400 w-5 h-5" /> {t('adminMisc.programGroups.workspaceTitle')}
           </h2>
           <button 
              onClick={handleUpdate}
              className="btn-prime !py-3 !px-8 shadow-[#FF6600]/10"
           >
              <Save className="w-4 h-4 mr-2" /> {t('adminMisc.programGroups.anchorMetrics')}
           </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
           <div className="lg:col-span-2 space-y-10">
              <div className="animation-reveal">
                 <h1 className="text-5xl font-black text-white tracking-tighter uppercase mb-4 flex items-center gap-3">
                    {group.name}
                    {group.type === 'facilitators' || Number(group.is_system) === 1 ? (
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400">
                        SYSTEM GROUP
                      </span>
                    ) : null}
                 </h1>
                 <p className="text-slate-500 font-bold text-sm tracking-tight leading-relaxed max-w-xl">
                    {t('adminMisc.programGroups.incubationSubtitle', { programId })}
                 </p>
              </div>

              <div className="ios-card bg-[#0d0d18] border-white/5 space-y-8">
                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-indigo-400" /> {t('adminMisc.programGroups.projectConcept')}
                 </h4>
                 <textarea 
                    id="project_description"
                    name="project_description"
                    aria-label={t('adminMisc.programGroups.projectConceptDescription')}
                    rows={6}
                    value={group.project_description || ''}
                    onChange={event => setGroup({...group, project_description: event.target.value})}
                    placeholder={t('adminMisc.programGroups.projectConceptPlaceholder')}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white font-bold outline-none focus:border-[#FF6600]/80 transition-colors resize-none"
                 />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="ios-card bg-white/[0.02] border-white/5 space-y-6">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('adminMisc.programGroups.assetRegistry')}</h4>
                    <div className="space-y-4">
                       <div className="space-y-2">
                          <label htmlFor="pitch_deck_url" className="text-[10px] font-bold uppercase tracking-widest text-slate-600 pl-2">{t('adminMisc.programGroups.pitchDeckLink')}</label>
                          <input 
                             id="pitch_deck_url"
                             name="pitch_deck_url"
                             type="text" 
                             value={group.pitch_deck_url || ''}
                             onChange={event => setGroup({...group, pitch_deck_url: event.target.value})}
                             placeholder="https://slides..."
                             className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                          />
                       </div>
                       <div className="space-y-2">
                          <label htmlFor="demo_link" className="text-[10px] font-bold uppercase tracking-widest text-slate-600 pl-2">{t('adminMisc.programGroups.liveDemoPortal')}</label>
                          <input 
                             id="demo_link"
                             name="demo_link"
                             type="text" 
                             value={group.demo_link || ''}
                             onChange={event => setGroup({...group, demo_link: event.target.value})}
                             placeholder="https://app..."
                             className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                          />
                       </div>
                    </div>
                 </div>
                 <div className="ios-card bg-white/[0.02] border-white/5 space-y-6">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('adminMisc.programGroups.teamComposition')}</h4>
                    <div className="space-y-3">
                       <div className="flex items-center gap-4 p-4 rounded-xl bg-black/40 border border-white/5">
                          <div className="w-10 h-10 rounded-lg bg-[#FF6600]/80/10 border border-[#FF6600]/80/20 flex items-center justify-center text-indigo-400"><Users className="w-5 h-5" /></div>
                          <div>
                             <p className="text-[10px] font-bold text-white uppercase tracking-widest">{t('adminMisc.programGroups.foundingNode')}</p>
                             <p className="text-[10px] font-medium text-slate-600">{t('adminMisc.programGroups.linkedParticipant')}</p>
                          </div>
                       </div>
                       <button className="w-full py-3 border border-dashed border-white/10 rounded-xl text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:border-[#FF6600]/80/30 hover:text-indigo-400 transition-all">
                          {t('adminMisc.programGroups.assignPersonnel')}
                       </button>
                    </div>
                 </div>
              </div>
           </div>

           <div className="space-y-8">
              <div className="ios-card bg-mesh py-12 text-center space-y-4">
                 <Shield className="w-10 h-10 text-emerald-400 mx-auto" />
                 <h4 className="text-[10px] font-bold text-white uppercase tracking-widest">{t('adminMisc.programGroups.escrowProtection')}</h4>
                 <p className="text-[10px] font-medium text-slate-500 max-w-[120px] mx-auto">{t('adminMisc.programGroups.escrowDescription', { programId })}</p>
              </div>

              <div className="ios-card bg-[#0d0d18] border-white/5">
                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">{t('adminMisc.programGroups.executionLog')}</h4>
                 <div className="space-y-6 relative">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/5" />
                    {[
                       { date: t('adminMisc.programGroups.logInitial'), event: t('adminMisc.programGroups.logTeamFormation') },
                       { date: t('adminMisc.programGroups.logCurrent'), event: t('adminMisc.programGroups.logWorkspaceSync') }
                    ].map((log, index) => (
                       <div key={index} className="flex gap-4 items-start relative">
                          <div className="w-4 h-4 rounded-full bg-[#FF6600]/80 border-4 border-[#0d0d18] z-10" />
                          <div>
                             <p className="text-[10px] font-bold text-white uppercase tracking-tighter leading-none">{log.event}</p>
                             <p className="text-[10px] font-medium text-slate-600 uppercase tracking-widest mt-1">{log.date} {t('adminMisc.programGroups.timestampSuffix')}</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>
    </>
  );
}
