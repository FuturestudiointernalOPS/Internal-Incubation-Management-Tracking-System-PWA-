'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Command, Eye, EyeOff, AlertCircle, CheckCircle, Cpu, Server, ArrowRight, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

/**
 * IMPACTOS SECURE TERMINAL — OPERATIONAL ACCESS
 * High-performance, standardized login for staff and admins.
 */

export default function TerminalLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [systemTime, setSystemTime] = useState('');
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use standardized credentials keys: email and password
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, isTerminal: true })
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Redirect to de-versioned standardized routes
        setTimeout(() => {
          if (data.user.role === 'super_admin') {
            router.push('/admin');
          } else if (data.user.role === 'program_manager') {
            localStorage.setItem('pm_session', 'pm-session-' + Date.now());
            router.push('/pm');
          } else if (data.user.role === 'staff' || data.user.role === 'teacher') {
            router.push('/teacher');
          } else {
            router.push('/participant');
          }
        }, 800);
      } else {
        setError(data.error || 'Authentication Failed.');
        setLoading(false);
      }
    } catch (err) {
      setError('Connection failure. Please check your network.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans relative overflow-hidden bg-[var(--bg-primary)]">
      {/* Background Decal */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(circle, var(--brand-orange) 0.5px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <div className="w-full max-w-md relative z-10 animate-in">
        
        <div className="flex justify-between items-center mb-8 px-2">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)] animate-pulse shadow-[0_0_8px_var(--brand-orange)]" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase">Terminal secured</span>
           </div>
           <div className="text-right">
              <span className="text-[10px] font-bold text-[var(--brand-orange)] tracking-widest">{systemTime || '00:00:00'}</span>
           </div>
        </div>

        <div className="card !p-10 shadow-2xl border-[var(--border-primary)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[var(--brand-orange)] to-transparent opacity-30" />

            <div className="text-center mb-10">
              <div className="w-16 h-16 mx-auto mb-6 bg-[var(--brand-orange)] rounded-2xl flex items-center justify-center shadow-xl shadow-[var(--brand-orange)]/20">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] uppercase">ImpactOS</h1>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.4em] mt-2">Operational Command</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">Access Identity</label>
                  <div className="relative">
                    <Command className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                    <input
                      type="text"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="EMAIL OR ID"
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">Secure Pin</label>
                  <div className="relative">
                     <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                     <input
                       type={showPassword ? 'text' : 'password'}
                       required
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       placeholder="••••••••"
                       className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-12 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                     />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-tight">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || success}
                className={`btn w-full py-5 text-[11px] font-bold uppercase tracking-[0.3em] ${
                  success ? 'bg-emerald-500 text-white' : 'btn-primary'
                }`}
              >
                {success ? 'ACCESS GRANTED' : (loading ? 'VALIDATING...' : 'INITIALIZE SESSION')}
                {!loading && !success && <ArrowRight className="w-4 h-4 ml-2" />}
              </button>
            </form>
        </div>

        <div className="mt-8 flex justify-between items-center px-4 opacity-30">
           <div className="flex gap-4">
              <Server className="w-4 h-4 text-[var(--text-secondary)]" />
              <div className="space-y-1">
                 <div className="h-1 w-8 bg-[var(--brand-orange)] rounded-full" />
                 <div className="h-1 w-12 bg-[var(--brand-orange)] opacity-50 rounded-full" />
              </div>
           </div>
           <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.25em]">
             Strategic Asset · FutureStudio HQ
           </p>
        </div>
      </div>
    </div>
  );
}
