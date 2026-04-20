'use client';

import React, { useState } from 'react';
import { Shield, Lock, Command, ArrowRight, Zap, Target, Sparkles, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        
        if (data.success) {
            localStorage.setItem('user', JSON.stringify(data.user));
            // Redirect based on role
            if (data.user.role === 'super_admin') {
                router.push('/v2/superadmin');
            } else if (data.user.role === 'program_manager') {
                router.push('/pm/dashboard');
            } else {
                router.push('/v2/participant');
            }
        } else {
            setErrorMsg(data.error || 'Login Denied');
        }
    } catch (err) {
        setErrorMsg('System error. Please try again later.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center p-6 font-sans bg-mesh overflow-hidden">
      <div className="w-full max-w-[440px] space-y-10 relative z-10">
        
        {/* LOGO AREA */}
        <div className="flex flex-col items-center text-center space-y-6 animation-reveal">
          <motion.div 
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            className="w-20 h-20 rounded-[2rem] bg-indigo-600 flex items-center justify-center shadow-[0_20px_50px_rgba(79,70,229,0.35)] border border-white/20"
          >
            <Zap className="text-white w-10 h-10" />
          </motion.div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">ImpactOS</h1>
            <div className="flex items-center gap-3 justify-center opacity-60">
                <span className="w-8 h-px bg-slate-500" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Access Terminal</p>
                <span className="w-8 h-px bg-slate-500" />
            </div>
          </div>
        </div>

        {/* LOGIN CARD */}
        <div className="ios-card !p-12 shadow-[0_50px_100px_rgba(0,0,0,0.5)] animation-reveal" style={{ animationDelay: '0.1s' }}>
          <form onSubmit={handleLogin} className="space-y-8">
            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3">
                 <AlertCircle className="w-5 h-5 text-rose-500" />
                 <span className="text-[11px] font-black text-rose-500 uppercase tracking-widest leading-tight">{errorMsg}</span>
              </div>
            )}
            
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                <Shield className="w-3 h-3 text-indigo-400" /> Identity Access
              </label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex. sarah@impactos.com" 
                className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 px-6 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-3 relative">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                <Lock className="w-3 h-3 text-indigo-400" /> Secure Pin
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-6 pr-14 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all placeholder:text-slate-600"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="btn-prime w-full !py-6 group shadow-lg shadow-indigo-600/10"
            >
              <span className="flex items-center justify-center gap-4">
                {loading ? 'Logging in...' : 'Log in'}
                {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />}
              </span>
            </button>
          </form>

          {/* DECORATIVE ELEMENTS */}
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Binary className="w-20 h-20 text-white" />
          </div>
        </div>

        <div className="text-center animation-reveal" style={{ animationDelay: '0.2s' }}>
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] leading-relaxed">
              &copy; 2026 FutureStudio Proprietary Intelligence Layer.<br/>
              Authorized Personnel Only.
            </p>
        </div>
      </div>

      {/* BACKGROUND DECOR */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px]" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-900/10 rounded-full blur-[100px]" />
    </div>
  );
}

function Binary({ className }) {
    return (
        <div className={className}>
            <p className="text-[10px] font-mono leading-tight">10101<br/>01101<br/>11010<br/>00101</p>
        </div>
    );
}

