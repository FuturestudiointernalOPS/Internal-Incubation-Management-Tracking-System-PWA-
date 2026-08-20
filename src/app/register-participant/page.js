'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, Users, ArrowRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default function RegisterParticipantPage() {
  const { t } = useI18n();
  const [groupId, setGroupId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setGroupId(params.get('group_id'));
  }, []);

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });

  useEffect(() => {
    if (groupId) {
      setError('');
      fetchGroup();
    } else {
      setError(t('rootMisc.registerParticipant.noGroupId'));
      setLoading(false);
    }
  }, [groupId]);

  const fetchGroup = async () => {
    try {
      const res = await fetch(`/api/public/group-info?id=${groupId}`);
      const data = await res.json();
      if (data.group) {
        setGroup(data.group);
        setError('');
        // Vérifier la fenêtre d'inscription
        if (data.group.registration_window) {
          const parts = data.group.registration_window.split('|');
          if (parts.length === 2) {
            const start = new Date(parts[0]);
            const end = new Date(parts[1]);
            end.setHours(23, 59, 59, 999);
            const now = new Date();
            if (now < start) {
              setError(t('rootMisc.registerParticipant.registrationOpens', { date: parts[0] }));
              setGroup(null);
            } else if (now > end) {
              setError(t('rootMisc.registerParticipant.registrationClosed'));
              setGroup(null);
            }
          }
        }
      } else {
        setError(t('rootMisc.registerParticipant.groupNotFound'));
      }
    } catch (e) {
      setError(t('rootMisc.registerParticipant.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/public/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          group_id: groupId,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(true);
      } else {
        setError(t((data.error || t('rootMisc.registerParticipant.registrationFailed')) || "") || (data.error || t('rootMisc.registerParticipant.registrationFailed')));
      }
    } catch (e) {
      // Network/parse failure — the registration may still have been saved.
      setError(t('rootMisc.registerParticipant.couldNotConfirm') || "We couldn't confirm your registration. Please check your email — if we received it, you'll hear from us shortly.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#FF6600] animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full text-center space-y-6">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">{t('rootMisc.registerParticipant.applicationSubmitted')}</h1>
          <p className="text-slate-400 text-sm">{t('rootMisc.registerParticipant.registrationIntro')}{" "}<strong className="text-white">{group?.name || t('rootMisc.registerParticipant.theProgram')}</strong>{" "}{t('rootMisc.registerParticipant.submittedEnding')}</p>
          <p className="text-slate-500 text-xs">{t('rootMisc.registerParticipant.reviewNotice')}</p>
        </motion.div>
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md w-full text-center space-y-6">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto" />
          <h1 className="text-xl font-black text-white uppercase tracking-tighter">{t('rootMisc.registerParticipant.invalidLink')}</h1>
          <p className="text-slate-400 text-sm">{error}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Users className="w-6 h-6 text-[#FF6600]" />
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">{t('rootMisc.registerParticipant.joinTitle', { name: group?.name || t('rootMisc.registerParticipant.program') })}</h1>
          <p className="text-slate-400 text-sm">{t('rootMisc.registerParticipant.completeForm')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input required type="text" placeholder={t('rootMisc.registerParticipant.fullNamePlaceholder')} name="name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />
          <input required type="email" placeholder={t('rootMisc.registerParticipant.emailPlaceholder')} name="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />
          <input type="text" placeholder={t('rootMisc.registerParticipant.phonePlaceholder')} name="phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />
          <input required type="password" placeholder={t('rootMisc.registerParticipant.createPasswordPlaceholder')} name="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />

          {error && <p className="text-rose-500 text-xs font-bold">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full py-3 bg-[#FF6600] text-black font-black uppercase tracking-widest rounded-xl text-sm hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> {t('rootMisc.registerParticipant.completeRegistration')}</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
