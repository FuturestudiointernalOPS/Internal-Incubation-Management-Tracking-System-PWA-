'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function InviteAcceptPage({ params }) {
  const { t } = useI18n();
  const unwrappedParams = use(params);
  const { token } = unwrappedParams;
  const router = useRouter();

  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });

  useEffect(() => {
    fetchInvite();
  }, [token]);

  const fetchInvite = async () => {
    try {
      const res = await fetch(`/api/invites/${token}`);
      const data = await res.json();
      if (data.invite) {
        setInvite(data.invite);
      } else {
        setError(
          t((data.error || 'Invalid or expired invite link.') || '') ||
            (data.error || 'Invalid or expired invite link.'),
        );
      }
    } catch (e) {
      setError('Failed to validate invite.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invites/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.user) {
        setSuccess(true);
      } else {
        setError(
          t((data.error || 'Registration failed.') || '') ||
            (data.error || 'Registration failed.'),
        );
      }
    } catch (e) {
      setError('Network error.');
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
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Registration Complete</h1>
          <p className="text-slate-400 text-sm">You have successfully joined <strong className="text-white">{invite?.program_name || 'the program'}</strong>.</p>
          <button onClick={() => router.push('/login')} className="px-8 py-3 bg-[#FF6600] text-black font-black uppercase tracking-widest rounded-xl text-sm hover:bg-white transition-all">
            Go to Login
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
          <h1 className="text-xl font-black text-white uppercase tracking-tighter">Invalid Invite</h1>
          <p className="text-slate-400 text-sm">{error}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Join Program</h1>
          <p className="text-slate-400 text-sm">{invite?.program_name || 'Program'} — {invite?.group_name || 'Open Registration'}</p>
          <p className="text-[10px] text-[#FF6600] font-bold uppercase tracking-widest">Invited as {invite?.role || 'participant'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input required type="text" placeholder="Full Name" name="name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />
          <input required type="email" placeholder="Email Address" name="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />
          <input type="text" placeholder="Phone (optional)" name="phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />
          <input required type="password" placeholder="Create Password" name="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#FF6600] transition-all" />

          {error && <p className="text-rose-500 text-xs font-bold">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full py-3 bg-[#FF6600] text-black font-black uppercase tracking-widest rounded-xl text-sm hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Complete Registration</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
