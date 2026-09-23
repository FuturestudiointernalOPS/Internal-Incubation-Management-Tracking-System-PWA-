'use client';
import { useState } from 'react';
import { Trash2, Undo2, AlertTriangle, Loader2, RefreshCw, UserX, UserCheck, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

// Module scope on purpose: the hook keys its internal callback on this function,
// so an inline arrow would give it a new identity on every render and refetch in
// a loop.
const pickArchivedContacts = (payload) => payload?.contacts || [];

export default function RecycleBinPage() {
  const { t } = useI18n();
  const [processing, setProcessing] = useState(null);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState('');
  // The loader's work — painting from the cache first, discarding a stale
  // response, the background refresh — belongs to the hook, so the screen keeps
  // no data state of its own and never sets state from an effect. Both mutations
  // call refresh(), which bypasses the cache like the old bypassCache did.
  const { data: contacts, loading, refresh } = useApi('/api/contacts?archived=1', {
    defaultValue: [],
    transform: pickArchivedContacts,
  });

  const handleRestore = async (contactId, name) => {
    setProcessing(contactId);
    try {
      const response = await fetch('/api/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: contactId, deleted: 0 }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: t('adminMisc.recycleBin.restoredToast', { name }) });
        refresh();
      } else {
        setMessage({ type: 'error', text: t((data.error || t('adminMisc.recycleBin.restoreFailed')) || "") || (data.error || t('adminMisc.recycleBin.restoreFailed')) });
      }
    } catch {
      setMessage({ type: 'error', text: t('adminMisc.recycleBin.networkError') });
    } finally {
      setProcessing(null);
    }
  };

  const handlePermanentDelete = async (contactId, name) => {
    setProcessing(contactId);
    try {
      const response = await fetch(`/api/contacts?cid=${contactId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setMessage({ type: 'success', text: t('adminMisc.recycleBin.permanentlyDeletedToast', { name }) });
        refresh();
      } else {
        setMessage({ type: 'error', text: t((data.error || t('adminMisc.recycleBin.deleteFailed')) || "") || (data.error || t('adminMisc.recycleBin.deleteFailed')) });
      }
    } catch {
      setMessage({ type: 'error', text: t('adminMisc.recycleBin.networkError') });
    } finally {
      setProcessing(null);
    }
  };

  const filtered = contacts.filter(contact =>
    !search || contact.name?.toLowerCase().includes(search.toLowerCase()) || contact.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase mb-2">{t('adminMisc.recycleBin.title')}</h2>
            <p className="text-slate-400 font-bold text-sm tracking-tight">{t('adminMisc.recycleBin.subtitle')}</p>
          </div>
          <button onClick={refresh} className="btn-ghost p-3" title={t('adminMisc.recycleBin.refresh')}>
            <RefreshCw className="w-5 h-5" />
          </button>
        </header>

        {message && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
            {message.type === 'success' ? <UserCheck className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
            <p className="text-xs font-bold uppercase text-white">{message.text}</p>
          </motion.div>
        )}

        <div className="relative">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder={t('adminMisc.recycleBin.searchPlaceholder')} value={search} onChange={event => setSearch(event.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />
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
            {filtered.map(contact => (
              <div key={contact.cid} className="ios-card bg-white/[0.02] border-white/5 flex items-center justify-between p-4 hover:border-[#FF6600]/20 transition-all">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400"><UserX className="w-5 h-5" /></div>
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight">{contact.name}</p>
                    <p className="text-[10px] text-slate-400">{contact.email} · {contact.group_name || t('adminMisc.recycleBin.noGroup')} · {contact.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleRestore(contact.cid, contact.name)} disabled={processing === contact.cid} className="btn-ghost px-3 py-2 text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold uppercase flex items-center gap-1">
                    {processing === contact.cid ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />} {t('adminMisc.recycleBin.restore')}
                  </button>
                  <button onClick={() => handlePermanentDelete(contact.cid, contact.name)} disabled={processing === contact.cid} className="btn-ghost px-3 py-2 text-rose-400 hover:bg-rose-500/10 text-xs font-bold uppercase flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> {t('adminMisc.recycleBin.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
