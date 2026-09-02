'use client';

import React, { useState, useEffect, use } from 'react';
import { 
  ChevronLeft, Plus, Trash2, Globe, 
  Link as LinkIcon, Save, Layers, Rocket,
  FileText, MessageSquare, Shield, Settings,
  Users
} from 'lucide-react';
import { motion } from 'framer-motion';
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGroup();
  }, [groupId]);

  const fetchGroup = async (bypassCache = false) => {
    const url = `/api/v2/groups?program_id=${programId}`;
    const apply = (data) => {
      const match = data.groups.find(g => String(g.id) === String(groupId));
      setGroup(match);
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
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) cacheSet(url, data);
      apply(data);
    } catch (e) {
      if (!painted) console.error(e);
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v2/groups', {
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
      const data = await res.json();
      if (data.success) {
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'success', message: t('adminMisc.programGroups.anchorMetricsSuccess') } }));
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: data.error || t('adminMisc.programGroups.updateFailed') } }));
      }
    } catch (e) {
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
                      <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400">
                        SYSTEM GROUP
                      </span>
                    ) : null}
                 </h1>
                 <p className="text-slate-500 font-bold text-sm tracking-tight leading-relaxed max-w-xl">
                    {t('adminMisc.programGroups.incubationSubtitle', { programId })}
                 </p>
              </div>

              <div className="ios-card bg-[#0d0d18] border-white/5 space-y-8">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-indigo-400" /> {t('adminMisc.programGroups.projectConcept')}
                 </h4>
                 <textarea 
                    id="project_description"
                    name="project_description"
                    aria-label={t('adminMisc.programGroups.projectConceptDescription')}
                    rows={6}
                    value={group.project_description || ''}
                    onChange={e => setGroup({...group, project_description: e.target.value})}
                    placeholder={t('adminMisc.programGroups.projectConceptPlaceholder')}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-white font-bold outline-none focus:border-[#FF6600]/80 transition-colors resize-none"
                 />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="ios-card bg-white/[0.02] border-white/5 space-y-6">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('adminMisc.programGroups.assetRegistry')}</h4>
                    <div className="space-y-4">
                       <div className="space-y-2">
                          <label htmlFor="pitch_deck_url" className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-2">{t('adminMisc.programGroups.pitchDeckLink')}</label>
                          <input 
                             id="pitch_deck_url"
                             name="pitch_deck_url"
                             type="text" 
                             value={group.pitch_deck_url || ''}
                             onChange={e => setGroup({...group, pitch_deck_url: e.target.value})}
                             placeholder="https://slides..."
                             className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                          />
                       </div>
                       <div className="space-y-2">
                          <label htmlFor="demo_link" className="text-[9px] font-black text-slate-600 uppercase tracking-widest pl-2">{t('adminMisc.programGroups.liveDemoPortal')}</label>
                          <input 
                             id="demo_link"
                             name="demo_link"
                             type="text" 
                             value={group.demo_link || ''}
                             onChange={e => setGroup({...group, demo_link: e.target.value})}
                             placeholder="https://app..."
                             className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs font-bold text-white outline-none"
                          />
                       </div>
                    </div>
                 </div>
                 <div className="ios-card bg-white/[0.02] border-white/5 space-y-6">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('adminMisc.programGroups.teamComposition')}</h4>
                    <div className="space-y-3">
                       <div className="flex items-center gap-4 p-4 rounded-xl bg-black/40 border border-white/5">
                          <div className="w-10 h-10 rounded-lg bg-[#FF6600]/80/10 border border-[#FF6600]/80/20 flex items-center justify-center text-indigo-400"><Users className="w-5 h-5" /></div>
                          <div>
                             <p className="text-[10px] font-black text-white uppercase tracking-widest">{t('adminMisc.programGroups.foundingNode')}</p>
                             <p className="text-[9px] text-slate-600 font-bold">{t('adminMisc.programGroups.linkedParticipant')}</p>
                          </div>
                       </div>
                       <button className="w-full py-3 border border-dashed border-white/10 rounded-xl text-[9px] font-black text-slate-600 uppercase tracking-widest hover:border-[#FF6600]/80/30 hover:text-indigo-400 transition-all">
                          {t('adminMisc.programGroups.assignPersonnel')}
                       </button>
                    </div>
                 </div>
              </div>
           </div>

           <div className="space-y-8">
              <div className="ios-card bg-mesh py-12 text-center space-y-4">
                 <Shield className="w-10 h-10 text-emerald-400 mx-auto" />
                 <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{t('adminMisc.programGroups.escrowProtection')}</h4>
                 <p className="text-[9px] text-slate-500 font-bold max-w-[120px] mx-auto">{t('adminMisc.programGroups.escrowDescription', { programId })}</p>
              </div>

              <div className="ios-card bg-[#0d0d18] border-white/5">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">{t('adminMisc.programGroups.executionLog')}</h4>
                 <div className="space-y-6 relative">
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/5" />
                    {[
                       { date: t('adminMisc.programGroups.logInitial'), event: t('adminMisc.programGroups.logTeamFormation') },
                       { date: t('adminMisc.programGroups.logCurrent'), event: t('adminMisc.programGroups.logWorkspaceSync') }
                    ].map((log, i) => (
                       <div key={i} className="flex gap-4 items-start relative">
                          <div className="w-4 h-4 rounded-full bg-[#FF6600]/80 border-4 border-[#0d0d18] z-10" />
                          <div>
                             <p className="text-[10px] font-black text-white uppercase tracking-tighter leading-none">{log.event}</p>
                             <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest mt-1">{log.date} {t('adminMisc.programGroups.timestampSuffix')}</p>
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
