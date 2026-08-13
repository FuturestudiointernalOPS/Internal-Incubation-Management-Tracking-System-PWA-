'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, AlertCircle, Users } from 'lucide-react';
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
      setError('No group ID provided.');
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
              setError(`Registration opens on ${parts[0]}. Please come back then.`);
              setGroup(null);
            } else if (now > end) {
              setError('Registration window has closed.');
              setGroup(null);
            }
          }
        }
      } else {
        setError('Group not found.');
      }
    } catch (e) {
      setError('Failed to load group info.');
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
        setError(
          t((data.error || 'Registration failed.') || '') ||
            (data.error || 'Registration failed.'),
        );
      }
    } catch (e) {
      setError('Network error during registration.');
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
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Application Submitted</h1>
          <p className="text-slate-400 text-sm">Your registration for <strong className="text-white">{group?.name || 'the program'}</strong> has been submitted.</p>
          <p className="text-slate-500 text-xs">Our team will review your application. If approved, you will receive an email with your login instructions within 24 hours.</p>
        </motion.div>
      </div>
    );
  }

  if (error && !group) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md w-full text-center space-y-6">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto" />
          <h1 className="text-xl font-black text-white uppercase tracking-tighter">Invalid Link</h1>
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
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Join {group?.name || 'Program'}</h1>
          <p className="text-slate-400 text-sm">Complete the form to register as a participant.</p>
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
