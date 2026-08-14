'use client';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Trash2, Undo2, AlertTriangle, Loader2, RefreshCw, UserX, UserCheck, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from "@/lib/i18n";

export default function RecycleBinPage() {
  const { t } = useI18n();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [msg, setMsg] = useState(null);
  const [search, setSearch] = useState('');

  const fetchArchived = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/contacts?archived=1');
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchArchived(); }, []);

  const handleRestore = async (cid, name) => {
    setProcessing(cid);
    try {
      const res = await fetch('/api/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid, deleted: 0 }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: t('adminMisc.recycleBin.restoredToast', { name }) });
        fetchArchived();
      } else {
        setMsg({ type: 'error', text: t((data.error || t('adminMisc.recycleBin.restoreFailed')) || "") || (data.error || t('adminMisc.recycleBin.restoreFailed')) });
      }
    } catch (e) {
      setMsg({ type: 'error', text: t('adminMisc.recycleBin.networkError') });
    } finally {
      setProcessing(null);
    }
  };

  const handlePermanentDelete = async (cid, name) => {
    setProcessing(cid);
    try {
      const res = await fetch(`/api/contacts?cid=${cid}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: t('adminMisc.recycleBin.permanentlyDeletedToast', { name }) });
        fetchArchived();
      } else {
        setMsg({ type: 'error', text: t((data.error || t('adminMisc.recycleBin.deleteFailed')) || "") || (data.error || t('adminMisc.recycleBin.deleteFailed')) });
      }
    } catch (e) {
      setMsg({ type: 'error', text: t('adminMisc.recycleBin.networkError') });
    } finally {
      setProcessing(null);
    }
  };

  const filtered = contacts.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="super_admin" activeTab="recycle-bin">
      <div className="space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">{t('adminMisc.recycleBin.title')}</h2>
            <p className="text-slate-400 font-bold tracking-tight">{t('adminMisc.recycleBin.subtitle')}</p>
          </div>
          <button onClick={fetchArchived} className="btn-ghost p-3" title={t('adminMisc.recycleBin.refresh')}>
            <RefreshCw className="w-5 h-5" />
          </button>
        </header>

        {msg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`p-4 rounded-xl flex items-center gap-3 ${msg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
            {msg.type === 'success' ? <UserCheck className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
            <p className="text-xs font-bold uppercase text-white">{msg.text}</p>
          </motion.div>
        )}

        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder={t('adminMisc.recycleBin.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-[#FF6600] animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="ios-card border-white/5 border-dashed flex flex-col items-center justify-center p-20 text-center">
            <Trash2 className="w-16 h-16 text-slate-500 mb-6 opacity-30" />
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">{t('adminMisc.recycleBin.emptyTitle')}</h3>
            <p className="text-sm font-bold text-slate-500">{t('adminMisc.recycleBin.emptyDesc')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => (
              <div key={c.cid} className="ios-card bg-white/[0.02] border-white/5 flex items-center justify-between p-4 hover:border-[#FF6600]/20 transition-all">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400"><UserX className="w-5 h-5" /></div>
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight">{c.name}</p>
                    <p className="text-[10px] text-slate-400">{c.email} · {c.group_name || t('adminMisc.recycleBin.noGroup')} · {c.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleRestore(c.cid, c.name)} disabled={processing === c.cid} className="btn-ghost px-3 py-2 text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold uppercase flex items-center gap-1">
                    {processing === c.cid ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />} {t('adminMisc.recycleBin.restore')}
                  </button>
                  <button onClick={() => handlePermanentDelete(c.cid, c.name)} disabled={processing === c.cid} className="btn-ghost px-3 py-2 text-rose-400 hover:bg-rose-500/10 text-xs font-bold uppercase flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> {t('adminMisc.recycleBin.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
