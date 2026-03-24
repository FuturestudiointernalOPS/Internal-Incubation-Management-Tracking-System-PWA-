'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Briefcase, TrendingUp, BarChart3, PieChart,
  Target, Zap, Star, Shield, Filter, Download,
  ExternalLink, ChevronRight, Activity, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function PortfolioManagement() {
  const [data, setData] = useState({ users: [], projects: [], roles: [] });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const response = await fetch('/api/data');
      const db = await response.json();
      setData(db);
      setIsLoaded(true);
    }
    fetchData();
  }, []);

  if (!isLoaded) return <div className="min-h-screen flex-center bg-slate-50 font-bold text-indigo-600 animate-pulse tracking-widest text-xs">CALIBRATING PORTFOLIO METRICS...</div>;

  return (
    <DashboardLayout role="program_manager">
      <div className="space-y-12">
        {/* PORTFOLIO HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Venture Portfolio</h2>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-widest leading-none flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2" /> 24 Strategic Assets Under Tracking
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-3 px-8 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-50 transition-all shadow-xl shadow-slate-100 uppercase tracking-widest leading-none">
                <Download className="w-4 h-4" /> Investor Report
            </button>
            <button className="flex items-center gap-3 px-8 py-3.5 bg-indigo-600 rounded-2xl text-xs font-black text-white hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 uppercase tracking-widest leading-none">
                <Shield className="w-4 h-4" /> AI Evaluation
            </button>
          </div>
        </div>

        {/* FINANCIAL & GROWTH KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            {[
              { label: 'Total Valuation', val: '$18.4M', trend: 'STABLE', icon: DollarSign, colorMap: { icon: 'text-indigo-500/10', text: 'text-indigo-600', bg: 'bg-indigo-50' } },
              { label: 'Funds Raised', val: '$4.2M', trend: '+12%', icon: TrendingUp, colorMap: { icon: 'text-emerald-500/10', text: 'text-emerald-600', bg: 'bg-emerald-50' } },
              { label: 'Avg Equity', val: '7.5%', trend: 'LOCKED', icon: Shield, colorMap: { icon: 'text-blue-500/10', text: 'text-blue-600', bg: 'bg-blue-50' } },
              { label: 'Health Score', val: '9.2', trend: 'PRIME', icon: Star, colorMap: { icon: 'text-violet-500/10', text: 'text-violet-600', bg: 'bg-violet-50' } }
            ].map((kpi, i) => (
              <motion.div key={i} whileHover={{ y: -5 }} className="ios-card bg-white p-8 border-slate-100 shadow-xl shadow-slate-100 transition-all group overflow-hidden relative">
                  <kpi.icon className={`absolute -right-4 -top-4 w-24 h-24 ${kpi.colorMap.icon} group-hover:scale-110 transition-transform`} />
                  <div className="flex flex-col justify-between h-full relative z-10">
                      <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 opacity-70">{kpi.label}</p>
                          <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{kpi.val}</h4>
                      </div>
                      <div className="flex items-center mt-6">
                          <span className={`text-[10px] font-black ${kpi.colorMap.text} uppercase tracking-[0.2em] ${kpi.colorMap.bg} px-2 py-1 rounded-full`}>{kpi.trend}</span>
                      </div>
                  </div>
              </motion.div>
            ))}
        </div>

        {/* VENTURE ROSTER & TRACKING */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            <div className="xl:col-span-8 space-y-8">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Venture Roster</h3>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-300 mr-2" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sorting by ROI</span>
                    </div>
                </div>

                <div className="compact-grid">
                    {[
                      { name: 'VortexAI', stage: 'Seed', traction: '$1.2M ARR', roi: '12x', status: 'Rising Star' },
                      { name: 'GreenFlow', stage: 'Pre-Seed', traction: '$400k ARR', roi: '4x', status: 'Stable' },
                      { name: 'CyberSphere', stage: 'MVP', traction: '$50k Pilot', roi: '2x', status: 'Early' }
                    ].map((v, i) => (
                      <motion.div key={i} className="ios-card p-4 flex items-center justify-between hover:bg-slate-50 transition-all translate-y-0 hover:-translate-y-1">
                          <div className="flex items-center gap-6">
                              <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex-center text-xl font-black text-indigo-600 shadow-inner">
                                  {v.name[0]}
                              </div>
                              <div>
                                  <h5 className="font-extrabold text-xl text-slate-900 tracking-tight leading-none mb-2">{v.name}</h5>
                                  <div className="flex items-center gap-3">
                                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">{v.stage}</span>
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{v.traction}</span>
                                  </div>
                              </div>
                          </div>
                          <div className="flex items-center gap-12 pr-6">
                              <div className="text-right">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-60">PROJECTED ROI</p>
                                  <span className="text-xl font-black text-emerald-600 tracking-tight">{v.roi}</span>
                              </div>
                              <button className="p-4 bg-slate-900 border border-slate-700 rounded-2xl text-white hover:scale-105 active:scale-95 shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-3">
                                  <BarChart3 className="w-4 h-4" /> <span className="text-[10px] font-black uppercase tracking-widest pr-2 hidden md:block">Analytics</span>
                              </button>
                          </div>
                      </motion.div>
                    ))}
                </div>
            </div>

            <div className="xl:col-span-4 flex flex-col gap-10">
                <div className="ios-card bg-white p-10 border-slate-100 shadow-2xl shadow-slate-100/50 relative overflow-hidden group">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex-center mb-10 group-hover:scale-110 transition-transform">
                        <Zap className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight mb-8 leading-none">AI Insight Generator</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 leading-none opacity-60">Contextual Focus</p>
                    <p className="text-lg font-bold leading-relaxed tracking-tight text-slate-800 mb-10">
                        VortexAI is showing high-velocity growth. AI recommends updating their Series A deck.
                    </p>
                    <div className="space-y-4">
                        <button className="w-full py-4.5 bg-indigo-600 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">GENERATE SERIES A PREVIEW</button>
                        <button className="w-full py-4.5 bg-slate-50 border border-slate-100 rounded-2xl text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-3">
                            <Download className="w-3 h-3" /> EXPORT INSIGHT TABLE
                        </button>
                    </div>
                </div>

                <div className="ios-card bg-slate-900 p-10 text-white shadow-2xl shadow-indigo-200 border-indigo-500/20 overflow-hidden relative group">
                    <Activity className="absolute -right-6 -bottom-6 w-32 h-32 text-indigo-500/10 group-hover:scale-110 transition-transform" />
                    <h3 className="text-lg font-black uppercase tracking-tight mb-10 leading-none flex items-center">
                        <Target className="w-5 h-5 mr-3 text-indigo-400" /> Milestone Tracking
                    </h3>
                    <div className="space-y-8">
                        {[
                          { name: 'Pitch Submission', val: 100, status: 'DONE' },
                          { name: 'Revenue Verification', val: 75, status: 'ACTIVE' },
                          { name: 'Series A Prep', val: 20, status: 'WAITING' }
                        ].map((ms, i) => (
                          <div key={i} className="space-y-4">
                              <div className="flex justify-between items-end">
                                  <p className="text-xs font-black uppercase tracking-widest leading-none text-indigo-200/50">{ms.name}</p>
                                  <span className={`text-[9px] font-black uppercase tracking-widest bg-white/10 px-2 py-1 rounded-md ${ms.status === 'DONE' ? 'text-emerald-400' : 'text-indigo-200'}`}>{ms.status}</span>
                              </div>
                              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${ms.val}%` }} className={`h-full ${ms.status === 'DONE' ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
                              </div>
                          </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
