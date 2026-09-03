'use client';
import React, { useState } from 'react';
import { Settings, Globe, Database, Shield, Save, Loader2, CheckCircle } from 'lucide-react';
import { useI18n } from "@/lib/i18n";

export default function SystemConfigPage() {
  const { t } = useI18n();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  };

  return (
    <>
      <div className="space-y-8 min-h-[60vh]">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase mb-2">{t("adminMisc.settings.title")}</h2>
            <p className="text-slate-400 font-bold text-sm tracking-tight">{t("adminMisc.settings.subtitle")}</p>
          </div>
          <button onClick={handleSave} disabled={isSaving} className="btn-prime shadow-[#FF6600]/20">
            {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : saved ? <CheckCircle className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            {saved ? t("adminMisc.settings.savedSuccess") : t("adminMisc.settings.applyConfiguration")}
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="md:col-span-1 space-y-4">
              <div className="ios-card bg-[#FF6600]/80/5 border-[#FF6600]/80/10 cursor-pointer hover:border-[#FF6600]/80/30 transition-all flex items-center gap-4">
                 <Globe className="w-5 h-5 text-indigo-400" />
                 <div>
                    <h4 className="text-white font-black uppercase text-sm tracking-tight">{t("adminMisc.settings.globalNetwork")}</h4>
                    <p className="text-[10px] uppercase font-bold text-slate-500">{t("adminMisc.settings.domainsRouting")}</p>
                 </div>
              </div>
              <div className="ios-card bg-white/5 border-white/5 cursor-pointer hover:bg-white/10 transition-all flex items-center gap-4 opacity-70">
                 <Database className="w-5 h-5 text-slate-400" />
                 <div>
                    <h4 className="text-white font-black uppercase text-sm tracking-tight">{t("adminMisc.settings.tursoEdge")}</h4>
                    <p className="text-[10px] uppercase font-bold text-slate-500">{t("adminMisc.settings.databaseEngine")}</p>
                 </div>
              </div>
              <div className="ios-card bg-white/5 border-white/5 cursor-pointer hover:bg-white/10 transition-all flex items-center gap-4 opacity-70">
                 <Shield className="w-5 h-5 text-slate-400" />
                 <div>
                    <h4 className="text-white font-black uppercase text-sm tracking-tight">{t("adminMisc.settings.authProtocols")}</h4>
                    <p className="text-[10px] uppercase font-bold text-slate-500">{t("adminMisc.settings.oauthJwtConfig")}</p>
                 </div>
              </div>
           </div>

           <div className="md:col-span-2 ios-card bg-[#0d0d18] border-white/5 space-y-8">
              <div>
                 <h3 className="text-lg font-black text-indigo-400 uppercase tracking-tighter mb-4 flex items-center gap-2">
                   <Settings className="w-4 h-4" /> {t("adminMisc.settings.environmentVariables")}
                 </h3>
                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.settings.baseDeploymentUrl")}</label>
                       <input type="text" defaultValue="https://internal.futurestudio.com" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600]/80/50 transition-colors" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("adminMisc.settings.maintenanceMode")}</label>
                       <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600]/80/50 appearance-none">
                          <option value="off" className="bg-[#080810]">{t("adminMisc.settings.offlineModeDisabled")}</option>
                          <option value="on" className="bg-[#080810]">{t("adminMisc.settings.activeLockdownEnabled")}</option>
                       </select>
                    </div>
                 </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                 <div className="flex items-center justify-between p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                    <div>
                       <h4 className="text-xs font-black text-orange-400 uppercase tracking-widest">{t("adminMisc.settings.forceCacheInvalidation")}</h4>
                       <p className="text-[10px] text-slate-400 mt-1">{t("adminMisc.settings.clearsCacheMemory")}</p>
                    </div>
                    <button className="px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-black uppercase tracking-widest hover:bg-orange-500 hover:text-white transition-all">{t("adminMisc.settings.clearMemory")}</button>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </>
  );
}
