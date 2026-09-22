'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, ArrowRight, Users } from 'lucide-react';
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

// Module scope: the read hook keys its callback on this identity, so an inline
// arrow would refetch on every render. The answer is kept raw because the
// rejection reason and the invitation behind it are read separately below.
const pickInvite = (d) => d;

/**
 * Public acceptance screen for a Venture member invitation.
 *
 * The invited person may be a complete stranger to the platform, so this page
 * offers the one thing that turns an invitation into a member: their name, and
 * — when they have no account yet — a password to sign in with.
 */
export default function VentureMemberInvitePage({ params }) {
  const { t } = useI18n();
  const { token } = use(params);
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [form, setForm] = useState({ name: '', password: '' });

  const { data: inviteData, loading, error: fetchError } = useApi(
    `/api/venture-member-invites/${token}`,
    { transform: pickInvite, deps: [token] },
  );

  const invite = inviteData?.invite || null;
  const linkError = inviteData && !inviteData.invite
    ? (inviteData.error || t("rootMisc.ventureMemberInvite.invalidInvite"))
    : fetchError
      ? t("rootMisc.ventureMemberInvite.failedToValidate")
      : '';
  const error = submitError || linkError;

  // A person the platform has never seen needs a password to be able to sign in
  // afterwards; someone who already has an account does not.
  const needsPassword = !invite?.has_account;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (needsPassword && (!form.password || form.password.length < 6)) {
      setSubmitError(t("rootMisc.ventureMemberInvite.passwordRequired"));
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/venture-member-invites/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setSubmitError(data.error || t("rootMisc.ventureMemberInvite.acceptFailed"));
      }
    } catch {
      setSubmitError(t("rootMisc.ventureMemberInvite.networkError"));
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
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">
            {t("rootMisc.ventureMemberInvite.accepted")}
          </h1>
          <p className="text-slate-400 text-sm">
            {t("rootMisc.ventureMemberInvite.acceptedMessage")}{" "}
            <strong className="text-white">{invite?.venture_name || ""}</strong>.
          </p>
          <button onClick={() => router.push('/login')} className="px-8 py-3 bg-[#FF6600] text-black font-bold uppercase tracking-wide rounded-xl text-sm hover:bg-white transition-all">
            {t("rootMisc.ventureMemberInvite.goToLogin")}
          </button>
        </motion.div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md w-full text-center space-y-6">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto" />
          <h1 className="text-xl font-black text-white uppercase tracking-tighter">
            {t("rootMisc.ventureMemberInvite.invalidInvite")}
          </h1>
          <p className="text-slate-400 text-sm">{error}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#FF6600]/10 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-[#FF6600]" />
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
            {t("rootMisc.ventureMemberInvite.joinVenture")}
          </h1>
          <p className="text-slate-400 text-sm">
            {invite?.venture_name || t("rootMisc.ventureMemberInvite.theVenture")}
          </p>
          <p className="text-[10px] text-[#FF6600] font-bold uppercase tracking-widest">
            {t("rootMisc.ventureMemberInvite.invitedAs")}{" "}
            {invite?.member_type === "founder"
              ? t("rootMisc.ventureMemberInvite.founder")
              : t("rootMisc.ventureMemberInvite.teamMember")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              {t("rootMisc.ventureMemberInvite.emailAddress")}
            </label>
            <input
              type="email"
              value={invite?.email || ''}
              readOnly
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-400 outline-none"
            />
          </div>
          <input
            required
            type="text"
            placeholder={t("rootMisc.ventureMemberInvite.fullName")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all"
          />
          <div>
            <input
              required={needsPassword}
              type="password"
              placeholder={t("rootMisc.ventureMemberInvite.createPassword")}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all"
            />
            <p className="text-[10px] text-slate-500 mt-1.5">
              {needsPassword
                ? t("rootMisc.ventureMemberInvite.passwordHint")
                : t("rootMisc.ventureMemberInvite.passwordOptionalHint")}
            </p>
          </div>

          {error && <p className="text-rose-500 text-xs font-bold">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#FF6600] text-black font-black uppercase tracking-widest rounded-xl text-sm hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ArrowRight className="w-4 h-4" /> {t("rootMisc.ventureMemberInvite.acceptInvitation")}
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
