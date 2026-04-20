'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Command, Eye, EyeOff, AlertCircle, CheckCircle, Cpu, Globe, Server } from 'lucide-react';
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
        if (data.role === 'super_admin') {
          localStorage.setItem('sa_session', data.session);
          localStorage.setItem('user', JSON.stringify(data.user));
          router.push('/v2/superadmin');
        } else if (data.role === 'pm') {
          localStorage.setItem('pm_session', data.session);
          localStorage.setItem('user', JSON.stringify(data.user));
          router.push('/v2/pm');
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
      
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
            x: [0, 50, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -right-[10%] w-[800px] h-[800px] rounded-full bg-indigo-600/20 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.05, 0.1, 0.05],
            x: [0, -40, 0]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[100px]" 
        />
      </div>

      {/* Strategic Grid Overlay */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(circle, #6366f1 0.5px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md relative z-10"
      >
        {/* Upper System Decals */}
        <div className="flex justify-between items-center mb-6 px-4">
           <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black tracking-[0.3em] text-emerald-500/50 uppercase">Network Linked</span>
           </div>
           <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter block opacity-60">System Time</span>
              <span className="text-[12px] font-mono text-indigo-400 font-bold tracking-widest">{systemTime || '00:00:00'}</span>
           </div>
        </div>

        {/* The Card */}
        <div className="relative group">
           {/* Cyber-Borders */}
           <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-blue-500/20 rounded-[2.5rem] blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
           
           <div className="relative bg-[#050510]/80 backdrop-blur-[40px] border border-white/5 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden">
              
              {/* Scanline Effect */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent animate-scan z-20 pointer-events-none" />

              {/* Login Header */}
              <div className="text-center mb-12">
                <div className="relative w-20 h-20 mx-auto mb-6">
                   <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl animate-pulse" />
                   <div className="relative w-full h-full bg-gradient-to-br from-indigo-600/20 to-indigo-900/40 rounded-2xl border border-indigo-500/30 flex items-center justify-center shadow-inner">
                      <Shield className="w-10 h-10 text-indigo-400 drop-shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
                   </div>
                </div>
                
                <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">
                  FutureStudio <span className="text-indigo-500">OS</span>
                </h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mb-4">Strategic Access Terminal</p>
                <div className="flex items-center justify-center gap-2">
                   <div className="h-[1px] w-8 bg-white/5" />
                   <span className="text-[8px] font-black text-indigo-500/40 uppercase tracking-widest">HQ-SP-2026-V1</span>
                   <div className="h-[1px] w-8 bg-white/5" />
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Identity Signature</label>
                    <div className="relative">
                      <Command className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <input
                        type="text"
                        required
                        value={useID}
                        onChange={(e) => setUseID(e.target.value)}
                        placeholder="ADMIN-ID"
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white placeholder:text-slate-700 focus:outline-none focus:border-indigo-500/50 transition-all focus:bg-white/[0.05]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Access Protocol</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-12 text-sm font-bold text-white tracking-[0.4em] placeholder:text-slate-700 placeholder:tracking-normal focus:outline-none focus:border-indigo-500/50 transition-all focus:bg-white/[0.05]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-indigo-400 transition-colors"
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
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-tight">{error}</span>
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight">Handshake Confirmed. Accessing Core...</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={loading || success}
                  className={`w-full group relative overflow-hidden rounded-2xl py-5 transition-all duration-300 ${
                    loading || success ? 'bg-indigo-600/50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_10px_20px_rgba(79,70,229,0.3)] hover:shadow-indigo-500/40'
                  }`}
                >
                  {loading && (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 flex items-center justify-center bg-indigo-600"
                    >
                       <Cpu className="w-5 h-5 text-white animate-pulse" />
                    </motion.div>
                  )}
                  <span className={`text-[11px] font-black uppercase tracking-[0.3em] text-white flex items-center justify-center gap-2 ${loading ? 'opacity-0' : 'opacity-100'}`}>
                    Initiate Authentication <Globe className="w-3 h-3 text-indigo-300" />
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
                 <div className="h-1 w-8 bg-indigo-500/20 rounded-full" />
                 <div className="h-1 w-12 bg-indigo-500/40 rounded-full" />
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
