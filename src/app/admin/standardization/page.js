'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Settings, Shield, 
  FileText, CheckCircle2, X,
  Globe, Film, FileType, Diamond, ArrowLeft, Target, Lock
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useI18n } from "@/lib/i18n";

export default function SuperAdminStandardization() {
  const router = useRouter();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('task'); // task | deliverable | media
  const [isLoaded, setIsLoaded] = useState(false);
  const [types, setTypes] = useState([]);
  const [newType, setNewType] = useState({ category: 'task', label: '' });
  const [editingItem, setEditingItem] = useState(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    const res = await fetch('/api/superadmin/standard-types');
    const data = await res.json();
    if (data.success) setTypes(data.types);
    setIsLoaded(true);
  };

   const handleSaveType = async (payload) => {
    if (!payload.label) return;
    setIsProcessing(true);
    setError('');
    try {
      const res = await fetch('/api/superadmin/standard-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setNewType({ category: activeTab, label: '' });
        setEditingItem(null);
        fetchTypes();
      } else {
        setError(t(data.error || "") || data.error);
      }
    } catch (e) { setError('Network Error'); }
    setIsProcessing(false);
  };

  const handleDeleteType = async (item) => {
    if (activeTab === 'media') return; // Absolute protection
    setIsProcessing(true);
    try {
      const res = await fetch('/api/superadmin/standard-types', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      });
      const data = await res.json();
      if (data.success) {
        fetchTypes();
      } else {
        window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t(data.error || "") || data.error } }));
      }
    } catch (e) { window.dispatchEvent(new CustomEvent('impactos:notify', { detail: { type: 'error', message: t("adminMisc.standardization.actionFailedNetworkError") } })); }
    setIsProcessing(false);
  };

  return (
    <DashboardLayout 
      role="super_admin"
      modals={
        <AnimatePresence>
           {editingItem && (
              <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
                 <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="ios-card w-full max-w-md !p-10 space-y-8 border-[#FF6600]/20">
                    <div className="flex justify-between items-start">
                       <div className="space-y-2">
                          <h3 className="text-2xl font-black text-white uppercase italic">{t("adminMisc.standardization.updateStandard")}</h3>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("adminMisc.standardization.renameOperationalNode")}</p>
                       </div>
                       <button onClick={() => { setEditingItem(null); setError(''); }} className="text-slate-600 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                    </div>

                    <div className="space-y-4">
                       <input 
                          type="text" 
                          className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white outline-none focus:border-[#FF6600] transition-all font-black text-lg uppercase"
                          value={editingItem.label}
                          onChange={e => setEditingItem({ ...editingItem, label: e.target.value })}
                       />
                       <div className="grid grid-cols-2 gap-4">
                          <button 
                             onClick={() => { setEditingItem(null); setError(''); }}
                             className="py-5 bg-white/5 text-slate-500 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white/10 transition-all italic"
                          >
                             {t("adminMisc.standardization.cancel")}
                          </button>
                          <button 
                             onClick={() => handleSaveType(editingItem)}
                             disabled={isProcessing || !editingItem.label}
                             className="py-5 bg-[#FF6600] text-black font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white transition-all shadow-xl shadow-[#FF6600]/20 italic"
                          >
                             {isProcessing ? t("adminMisc.standardization.saving") : t("adminMisc.standardization.saveEvolution")}
                          </button>
                       </div>
                    </div>
                 </motion.div>
              </div>
           )}
        </AnimatePresence>
      }
    >
      <div className="space-y-12">
        <header className="space-y-8 text-left">
           <div className="flex justify-between items-start">
              <div className="space-y-4">
                 <div className="flex items-center gap-4">
                    <Shield className="w-5 h-5 text-[#FF6600]" />
                    <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.4em]">{t("adminMisc.standardization.operationalGovernance")}</span>
                 </div>
                 <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tighter uppercase italic leading-none">{t("adminMisc.standardization.operationalStandards")}</h2>
              </div>
              <button 
                 onClick={() => router.push('/admin/programs')}
                 className="group flex items-center gap-4 px-8 py-4 bg-white/5 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#FF6600] hover:text-black transition-all border border-white/5 hover:border-[#FF6600]"
              >
                 <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                 <span>{t("adminMisc.standardization.backToMissionHub")}</span>
              </button>
           </div>
           
           <div className="flex items-center gap-10 border-b border-white/5 pb-4">
                <button 
                   onClick={() => setActiveTab('task')}
                   className={`text-[11px] font-black uppercase tracking-[0.3em] pb-4 transition-all relative ${activeTab === 'task' ? 'text-[#FF6600]' : 'text-slate-500 hover:text-white'}`}
                >
                   {t("adminMisc.standardization.tabTasks")}
                   {activeTab === 'task' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6600]" />}
                </button>
                <button 
                   onClick={() => setActiveTab('deliverable')}
                   className={`text-[11px] font-black uppercase tracking-[0.3em] pb-4 transition-all relative ${activeTab === 'deliverable' ? 'text-[#FF6600]' : 'text-slate-500 hover:text-white'}`}
                >
                   {t("adminMisc.standardization.tabDeliverables")}
                   {activeTab === 'deliverable' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6600]" />}
                </button>
                <button 
                   onClick={() => setActiveTab('media')}
                   className={`text-[11px] font-black uppercase tracking-[0.3em] pb-4 transition-all relative ${activeTab === 'media' ? 'text-[#FF6600]' : 'text-slate-500 hover:text-white'}`}
                >
                   {t("adminMisc.standardization.tabMedia")}
                   {activeTab === 'media' && <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6600]" />}
                </button>
            </div>
           <p className="text-slate-400 font-bold max-w-2xl opacity-70 border-l-2 border-[#FF6600]/30 pl-6">{t("adminMisc.standardization.governanceHubDescription")}</p>
        </header>

        <div className="max-w-4xl mx-auto space-y-12">
           
           {/* TACTICAL COMMAND BAR - HIDDEN FOR MEDIA */}
           {activeTab !== 'media' ? (
              <div className="ios-card bg-white/[0.03] border-[#FF6600]/20 !p-10 flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-2 h-full bg-[#FF6600]" />
                 <div className="flex-1 space-y-4 w-full">
                    <div className="flex items-center gap-4">
                       <Plus className="w-5 h-5 text-[#FF6600]" />
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{t("adminMisc.standardization.registerNew", { type: activeTab === 'task' ? t("adminMisc.standardization.operationalTask") : t("adminMisc.standardization.tacticalDeliverable") })}</h4>
                    </div>
                    <input 
                       placeholder={t("adminMisc.standardization.enterNamePlaceholder", { category: activeTab === 'deliverable' ? t("adminMisc.standardization.deliverableName") : t("adminMisc.standardization.taskName"), example: activeTab === 'deliverable' ? t("adminMisc.standardization.pitchDeck") : t("adminMisc.standardization.workshop") })}
                       className="w-full bg-white/5 border border-white/10 p-6 rounded-2xl text-white outline-none font-black text-2xl uppercase placeholder:text-slate-700 tracking-widest italic focus:border-[#FF6600] transition-all"
                       value={newType.label}
                       onChange={e => setNewType({ category: activeTab, label: e.target.value })}
                    />
                 </div>
                 <button 
                    onClick={() => handleSaveType({ category: activeTab, label: newType.label })}
                    disabled={!newType.label || isProcessing}
                    className="w-full md:w-auto px-16 py-8 bg-[#FF6600] text-black font-black uppercase text-[12px] tracking-[0.3em] rounded-3xl hover:bg-white transition-all disabled:opacity-20 shadow-2xl shadow-[#FF6600]/30 italic whitespace-nowrap"
                 >
                    {isProcessing ? t("adminMisc.standardization.deploying") : t("adminMisc.standardization.addNew", { category: activeTab === 'deliverable' ? t("adminMisc.standardization.deliverableName") : t("adminMisc.standardization.taskName") })}
                 </button>
              </div>
           ) : (
              <div className="ios-card bg-white/[0.01] border-white/5 !p-10 flex items-center gap-6 opacity-60 grayscale shadow-inner">
                 <Lock className="w-8 h-8 text-slate-600" />
                 <div className="text-left">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none mb-2">{t("adminMisc.standardization.immutableMediaRegistry")}</h4>
                    <p className="text-xs font-bold text-slate-700 italic">{t("adminMisc.standardization.submissionFormatsLocked")}</p>
                 </div>
              </div>
           )}

           <div className="space-y-8">
              <div className="flex items-center gap-4">
                 <div className="h-px flex-1 bg-white/5" />
                 <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em] italic">{t("adminMisc.standardization.activeRegistry")}</h3>
                 <div className="h-px flex-1 bg-white/5" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                 {types.filter(t => t.category === activeTab).map(item => {
                    const label = item.label.toLowerCase();
                    const IconComponent = activeTab === 'task' ? Target : (
                       label.includes('link') || label.includes('url') ? Globe :
                       label.includes('pdf') || label.includes('doc') || label.includes('file') ? FileType :
                       label.includes('video') || label.includes('media') ? Film : Diamond
                    );
                    
                    return (
                       <div key={item.id} className="ios-card group border-white/5 hover:border-[#FF6600]/30 transition-all bg-white/[0.01] !p-8 flex justify-between items-center relative overflow-hidden">
                          <div className="flex items-center gap-6">
                             <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-slate-600 group-hover:text-[#FF6600] group-hover:bg-[#FF6600]/10 transition-all border border-white/5 group-hover:border-[#FF6600]/20">
                                <IconComponent className="w-5 h-5" />
                             </div>
                             <span className="text-sm font-black text-white uppercase tracking-widest italic">{item.label}</span>
                          </div>
                          
                          {/* BUTTONS - HIDDEN FOR MEDIA */}
                          {activeTab !== 'media' && (
                             <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                <button onClick={() => setEditingItem(item)} className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all" title={t("adminMisc.standardization.rename")}><Settings className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteType(item)} disabled={isProcessing} className="p-3 rounded-xl bg-white/5 text-slate-700 hover:text-rose-500 hover:bg-rose-500/10 transition-all" title={t("adminMisc.standardization.decommission")}><Trash2 className="w-4 h-4" /></button>
                             </div>
                          )}
                          
                          {activeTab === 'media' && (
                             <Lock className="w-4 h-4 text-slate-800 opacity-20" />
                          )}
                       </div>
                    );
                 })}
              </div>
              
              {types.filter(t => t.category === activeTab).length === 0 && (
                 <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem] opacity-30">
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic">{t("adminMisc.standardization.registryEmpty")}</p>
                 </div>
              )}
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
