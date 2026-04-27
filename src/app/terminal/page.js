'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Command, Eye, EyeOff, AlertCircle, CheckCircle, Cpu, Globe, Server, ArrowRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function SuperAdminLoginPage() {
  const [useID, setUseID] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [systemTime, setSystemTime] = useState('');
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
      const res = await fetch('/api/v2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useID, accessCode })
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        if (data.role === 'super_admin') {
          localStorage.setItem('sa_session', data.session);
          router.push('/v2/superadmin');
        } else if (data.role === 'program_manager' || data.role === 'pm') {
          localStorage.setItem('pm_session', data.session);
          router.push('/v2/pm');
        } else {
          localStorage.setItem('part_session', data.session);
          router.push('/v2/participant');
        }
      } else {
        setError(data.error || 'Authentication Failed.');
        setLoading(false);
      }
    } catch (err) {
      setError('System connection failure. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans relative overflow-hidden bg-[#02020a]">
      {/* Strategic Grid Overlay */}
      <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(circle, #FF6600 0.5px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Upper System Decals */}
        <div className="flex justify-between items-center mb-6 px-4">
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#FF6600] animate-pulse shadow-[0_0_10px_rgba(255,102,0,0.5)]" />
              <span className="text-[10px] font-black tracking-[0.3em] text-[#FF6600]/50 uppercase italic">Terminal Linked</span>
           </div>
           <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter block opacity-60 italic">System Time</span>
              <span className="text-[12px] font-mono text-[#FF6600] font-black tracking-widest italic">{systemTime || '00:00:00'}</span>
           </div>
        </div>

        {/* The Card */}
        <div className="relative group">
           {/* Cyber-Borders */}
           <div className="absolute -inset-0.5 bg-gradient-to-r from-[#FF6600]/20 to-[#e65c00]/20 rounded-[2.5rem] blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
           
           <div className="relative bg-[#050510]/80 backdrop-blur-[40px] border border-white/5 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden">
              
              {/* Scanline Effect */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF6600]/30 to-transparent animate-scan z-20 pointer-events-none" />

              {/* Login Header */}
              <div className="text-center mb-12">
                <div className="relative w-20 h-20 mx-auto mb-6">
                   <div className="absolute inset-0 bg-[#FF6600]/20 rounded-2xl blur-xl animate-pulse" />
                   <div className="relative w-full h-full bg-gradient-to-br from-[#FF6600]/20 to-[#e65c00]/40 rounded-2xl border border-[#FF6600]/30 flex items-center justify-center shadow-inner">
                      <Shield className="w-10 h-10 text-[#FF6600] drop-shadow-[0_0_10px_rgba(255,102,0,0.5)]" />
                   </div>
                </div>
                
                <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2 italic">
                   ImpactOS <span className="text-[#FF6600]">V2</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mb-4 italic">Secure Terminal Login</p>
                <div className="flex items-center justify-center gap-2">
                   <div className="h-[1px] w-8 bg-white/5" />
                   <span className="text-[8px] font-black text-[#FF6600]/40 uppercase tracking-widest italic">FutureStudio Operations</span>
                   <div className="h-[1px] w-8 bg-white/5" />
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleLogin} className="space-y-6 text-left">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest ml-1 italic">Identity Access</label>
                    <div className="relative">
                      <Command className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <input
                        type="text"
                        required
                        value={useID}
                        onChange={(e) => setUseID(e.target.value)}
                        placeholder="ADMIN-ID"
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-black text-white placeholder:text-slate-700 focus:outline-none focus:border-[#FF6600]/50 transition-all focus:bg-white/[0.05]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[#FF6600] uppercase tracking-widest ml-1 italic">Secure Pin</label>
                    <div className="relative">
                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                       <input
                         type={showPassword ? 'text' : 'password'}
                         required
                         value={accessCode}
                         onChange={(e) => setAccessCode(e.target.value)}
                         placeholder="Your Password"
                         className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-12 text-sm font-black text-white placeholder:text-slate-700 focus:outline-none focus:border-[#FF6600]/50 transition-all focus:bg-white/[0.05]"
                       />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-[#FF6600] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/5 border border-rose-500/10"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-tight italic">{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading || success}
                  className={`w-full group relative overflow-hidden rounded-2xl py-5 transition-all duration-300 ${
                    success ? 'bg-emerald-500' : (loading ? 'bg-[#FF6600]/50 cursor-not-allowed' : 'bg-[#FF6600] hover:bg-[#e65c00] shadow-[0_10px_20px_rgba(255,102,0,0.3)] hover:shadow-[#FF6600]/40')
                  }`}
                >
                  {loading && !success && (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 flex items-center justify-center bg-[#FF6600]"
                    >
                       <Cpu className="w-5 h-5 text-black animate-pulse" />
                    </motion.div>
                  )}
                  <span className={`text-[11px] font-black uppercase tracking-[0.3em] text-black flex items-center justify-center gap-2 ${loading && !success ? 'opacity-0' : 'opacity-100'}`}>
                    {success ? 'ACCESS GRANTED' : 'LOGIN TO TERMINAL'} {!success && <ArrowRight className="w-3 h-3 text-black/60" />}
                  </span>
                </button>
              </form>
           </div>
        </div>

        {/* Hardware Status Indicators */}
        <div className="mt-8 flex justify-between items-center px-4 opacity-40 grayscale hover:grayscale-0 transition duration-500">
           <div className="flex gap-4">
              <Server className="w-4 h-4 text-slate-500" />
              <div className="space-y-1">
                 <div className="h-1 w-8 bg-[#FF6600]/20 rounded-full" />
                 <div className="h-1 w-12 bg-[#FF6600]/40 rounded-full" />
              </div>
           </div>
           <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.25em]">
             High-Security Clearance Required · 2026-HQ
           </p>
        </div>
      </motion.div>

      <style jsx global>{`
        @keyframes scan {
          0% { transform: translateY(-100%); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: translateY(500px); opacity: 0; }
        }
        .animate-scan {
          animation: scan 4s linear infinite;
        }
      `}</style>
    </div>
  );
}
