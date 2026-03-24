'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Zap, Shield, TrendingUp, Briefcase, 
  ArrowRight, CheckCircle2, Globe, Activity,
  ChevronRight, Sparkles, Binary
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const sa_session = localStorage.getItem('sa_session');

    if (sa_session === 'prime-2026-active') {
      router.push('/sa-hq-sp-2026-v1');
    } else if (user) {
      if (user.role === 'program_manager') router.push('/pm/dashboard');
      else if (user.role === 'super_admin') router.push('/sa-hq-sp-2026-v1');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#080810] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-x-hidden bg-mesh">
      
      {/* NAVIGATION */}
      <nav className="fixed top-0 left-0 w-full h-[80px] bg-[#0d0d18]/60 backdrop-blur-2xl border-b border-white/5 z-[100] px-8 lg:px-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Zap className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">ImpactOS</h1>
        </div>
        
        <div className="hidden lg:flex items-center gap-10">
          {['Core Ops', 'Portfolio', 'AI Signals'].map((item) => (
            <a key={item} href="#" className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hover:text-indigo-400 transition-colors">
              Phase: {item}
            </a>
          ))}
        </div>

        <button 
          onClick={() => router.push('/login')}
          className="btn-prime !py-3 !px-8 shadow-indigo-600/10"
        >
          Access Terminal
        </button>
      </nav>

      {/* HERO SECTION */}
      <header className="pt-48 pb-32 px-8 lg:px-20 relative">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-24">
            <div className="flex-1 space-y-10 animation-reveal">
                <div className="space-y-6">
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-indigo-500/20 leading-none">
                        <Sparkles className="w-3 h-3" /> Next-Generation Incubation Intelligence
                    </span>
                    <h2 className="text-7xl lg:text-[100px] font-black text-white tracking-tighter leading-[0.85] uppercase">
                        Digitalize <br/> <span className="text-indigo-600 text-glow">Scale</span> Impact.
                    </h2>
                </div>
                <p className="text-xl text-slate-400 font-bold max-w-xl leading-relaxed tracking-tight opacity-80">
                    The internal operating system designed for FutureStudio to streamline incubation cycles and venture tracking with Real-time AI signals.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <button onClick={() => router.push('/login')} className="btn-prime w-full sm:w-auto !py-5 !px-12 group">
                        Initialize Session <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button className="btn-ghost w-full sm:w-auto !py-5 !px-10 border-white/5 hover:bg-white/5">
                        Explore Methodology
                    </button>
                </div>
            </div>

            {/* HERO VISUAL (The Terminal GUI) */}
            <div className="flex-1 w-full relative perspective-[1000px]">
                <motion.div 
                    initial={{ opacity: 0, rotateY: 20, rotateX: 5 }}
                    animate={{ opacity: 1, rotateY: 0, rotateX: 0 }}
                    transition={{ duration: 1 }}
                    className="ios-card bg-indigo-950/20 border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.6)] rounded-[3rem] p-4 group"
                >
                    <div className="bg-[#080810] rounded-[2.5rem] p-10 aspect-[4/3] relative flex items-center justify-center overflow-hidden border border-white/5">
                        {/* MOCK UI CONTENT */}
                        <div className="grid grid-cols-2 gap-6 w-full max-w-md relative z-10">
                            {[
                                { icon: Activity, label: 'Ops Health', val: 'PRIME', color: 'text-indigo-400' },
                                { icon: TrendingUp, label: 'Yield', val: '42%', color: 'text-emerald-400' },
                                { icon: Briefcase, label: 'Workspaces', val: '24', color: 'text-orange-400' },
                                { icon: Sparkles, label: 'AI Signal', val: 'STRONG', color: 'text-purple-400' }
                            ].map((s, i) => (
                                <div key={i} className="bg-white/5 p-6 rounded-3xl border border-white/5 flex flex-col items-center justify-center space-y-2 hover:bg-white/10 transition-all cursor-default">
                                    <s.icon className={`w-5 h-5 ${s.color} mb-1`} />
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">{s.label}</p>
                                    <p className="text-2xl font-black text-white leading-none tracking-tighter">{s.val}</p>
                                </div>
                            ))}
                        </div>
                        {/* BACKGROUND RADIALS */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-transparent pointer-events-none" />
                        <div className="absolute top-10 right-10 flex gap-2">
                           <div className="w-2 h-2 rounded-full bg-rose-500/40" />
                           <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                           <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
      </header>

      {/* PHASE BREAKDOWN SECTION */}
      <section className="py-40 px-8 lg:px-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
            <div className="space-y-10 animation-reveal">
                <div className="space-y-2">
                  <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Section 01</p>
                  <h3 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">Operational <br/> Mastery.</h3>
                </div>
                <p className="text-slate-400 font-bold text-lg leading-relaxed max-w-md">Focusing on daily program cycles, cohort management, and automated session workflows.</p>
                <div className="space-y-5 pt-4">
                    {[
                        'Automated Onboarding Wizards',
                        'Live Attendance Signal Tracking',
                        'Task Submission Pipeline',
                        'Real-time Analytics Dashboard'
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-4 text-xs font-black text-slate-300 uppercase tracking-[0.2em] leading-none group">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
                               <CheckCircle2 className="w-4 h-4 text-indigo-400 group-hover:text-white" /> 
                            </div>
                            {item}
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-10 animation-reveal" style={{ animationDelay: '0.2s' }}>
                <div className="space-y-2">
                  <p className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em]">Section 02</p>
                  <h3 className="text-5xl font-black text-white tracking-tighter uppercase leading-none border-indigo-500/20">Portfolio <br/> Intelligence.</h3>
                </div>
                <p className="text-slate-400 font-bold text-lg leading-relaxed max-w-md">Transitioning into long-term venture health, ROI monitoring, and investor readiness.</p>
                <div className="space-y-5 pt-4">
                    {[
                        'Venture Health Scoring Logic',
                        'AI-Assisted Investor Reports',
                        'Burn Rate & Runway Alerts',
                        'DeepSeek Intelligence Integration'
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-4 text-xs font-black text-slate-300 uppercase tracking-[0.2em] leading-none group">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
                               <Binary className="w-4 h-4 text-indigo-400 group-hover:text-white" /> 
                            </div>
                            {item}
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-24 px-8 lg:px-20 border-t border-white/5 bg-[#0d0d18]/40">
         <div className="flex flex-col items-center space-y-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-600/30">
              <Zap className="text-white w-8 h-8" />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.6em]">ImpactOS Deployment</p>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                &copy; 2026 FutureStudio. Strategic Intelligence Asset.
              </p>
            </div>
         </div>
      </footer>
    </div>
  );
}

