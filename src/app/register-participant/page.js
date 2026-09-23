'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, Users, ArrowRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useApi } from '@/lib/hooks/useApi';

export const dynamic = 'force-dynamic';

// Module scope on purpose: the hook keys its internal callback on this function,
// so an inline arrow would give it a new identity on every render and refetch in
// a loop. This endpoint signals success by the presence of `group` — there is no
// success flag to read.
const pickPublicGroup = (payload) => (payload && payload.group ? payload.group : null);

// The registration window is a property of the group, so the check that used to
// run inside the loader is now a plain reading of it during render.
function registrationWindowError(group, t) {
  if (!group?.registration_window) return '';
  const parts = group.registration_window.split('|');
  if (parts.length !== 2) return '';
  const start = new Date(parts[0]);
  const end = new Date(parts[1]);
  end.setHours(23, 59, 59, 999);
  const now = new Date();
  if (now < start)
    return t('rootMisc.registerParticipant.registrationOpens', { date: parts[0] });
  if (now > end) return t('rootMisc.registerParticipant.registrationClosed');
  return '';
}

function RegisterParticipantContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const groupId = searchParams.get('group_id');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });

  // The loader's work — cache-first paint, discarding a stale response, the
  // background refresh — belongs to the hook, so the screen keeps no group state
  // of its own and never sets state from an effect. Without a group identifier
  // there is nothing to ask for.
  const {
    data: loadedGroup,
    loading,
    error: fetchError,
  } = useApi(groupId ? `/api/public/group-info?id=${groupId}` : null, {
    transform: pickPublicGroup,
    deps: [groupId],
  });

  const windowError = registrationWindowError(loadedGroup, t);
  const group = windowError ? null : loadedGroup;
  // The submit failure is the one part that is genuinely state; everything else
  // is a reading of the loaded group, or of the link itself.
  const error =
    submitError ||
    windowError ||
    (!groupId ? t('rootMisc.registerParticipant.noGroupId') : '') ||
    (fetchError ? t('rootMisc.registerParticipant.loadFailed') : '') ||
    (!loading && !group ? t('rootMisc.registerParticipant.groupNotFound') : '');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    setSubmitting(true);

    try {
      const response = await fetch('/api/public/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          group_id: groupId,
        }),
      });
      const payload = await response.json();

      if (payload.success) {
        setSuccess(true);
      } else {
        setSubmitError(t((payload.error || t('rootMisc.registerParticipant.registrationFailed')) || "") || (payload.error || t('rootMisc.registerParticipant.registrationFailed')));
      }
    } catch {
      // Network/parse failure — the registration may still have been saved.
      setSubmitError(t('rootMisc.registerParticipant.couldNotConfirm') || "We couldn't confirm your registration. Please check your email — if we received it, you'll hear from us shortly.");
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
          <input required type="text" placeholder={t('rootMisc.registerParticipant.fullNamePlaceholder')} name="name" value={form.name} onChange={event => setForm({...form, name: event.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />
          <input required type="email" placeholder={t('rootMisc.registerParticipant.emailPlaceholder')} name="email" value={form.email} onChange={event => setForm({...form, email: event.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />
          <input type="text" placeholder={t('rootMisc.registerParticipant.phonePlaceholder')} name="phone" value={form.phone} onChange={event => setForm({...form, phone: event.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />
          <input required type="password" placeholder={t('rootMisc.registerParticipant.createPasswordPlaceholder')} name="password" value={form.password} onChange={event => setForm({...form, password: event.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />

          {error && <p className="text-rose-500 text-xs font-bold">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full py-3 bg-[#FF6600] text-black font-black uppercase tracking-widest rounded-xl text-sm hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> {t('rootMisc.registerParticipant.completeRegistration')}</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function RegisterParticipantPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#FF6600] animate-spin" />
        </div>
      }
    >
      <RegisterParticipantContent />
    </Suspense>
  );
}
