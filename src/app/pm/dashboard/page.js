'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, Briefcase, Plus, CheckCircle2, Clock, 
  TrendingUp, Calendar, Shield, Zap, 
  Filter, Download, MoreVertical, ArrowUpRight,
  Activity, Settings, UserCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function PMDashboard() {
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.replace('/terminal'); return; }
    setUser(JSON.parse(userData));
    setTimeout(() => setIsLoaded(true), 400);
  }, [router]);

  if (!isLoaded) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <DashboardLayout role="program_manager">
      <header className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-12">
        <div className="animation-reveal">
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Work Summary</h2>
          <p className="text-slate-400 font-bold tracking-tight">
            Ongoing: <span className="text-indigo-400">Spring 2026 Batch</span> — Tracking all teams and upcoming lessons.
          </p>
        </div>
        <button className="btn-prime animation-reveal">
          <Plus className="w-5 h-5" /> Plan New Session
        </button>
      </header>

      {/* TOP STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
         <StatCard label="Group Enrollment" value="14/18" sub="82% Space filled" icon={Users} color="text-indigo-400" badge="PRIME" />
         <StatCard label="Work Submitted" value="92%" sub="On daily track" icon={CheckCircle2} color="text-emerald-400" badge="EXCELLENT" />
         <StatCard label="Absence Alerts" value="04" sub="Immediate attention" icon={Clock} color="text-amber-400" badge="HIGH RISK" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
         
         {/* TEAMS PORTION */}
         <section className="xl:col-span-2 space-y-6 animation-reveal" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Teams in this Group</h3>
              <div className="flex items-center gap-2">
                <button className="btn-ghost !py-2 !px-4"><Filter className="w-4 h-4" /></button>
                <button className="btn-ghost !py-2 !px-4"><Download className="w-4 h-4" /></button>
              </div>
            </div>
            
            <div className="ios-card !p-0 overflow-hidden">
              <table className="executive-table">
                <thead>
                  <tr className="!bg-transparent">
                    {['Team Name', 'Lead Person', 'Our Progress', 'Condition', ''].map(h => (
                      <th key={h} className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <TeamRow name="VortexAI" lead="Samuel A." progress={85} health="Great" />
                  <TeamRow name="GreenFlow" lead="Marcus P." progress={42} health="At Risk" />
                  <TeamRow name="SkyNet Lab" lead="Sarah A." progress={68} health="Great" />
                </tbody>
              </table>
            </div>
         </section>

         {/* LESSONS PORTION */}
         <section className="space-y-6 animation-reveal" style={{ animationDelay: '0.2s' }}>
           <h3 className="text-xl font-black text-white uppercase tracking-tighter">Upcoming Signals</h3>
           <div className="flex flex-col gap-4">
              <LessonCard 
                title="Investor Meeting Prep" 
                time="Tomorrow, 10:00 AM" 
                color="bg-indigo-500"
                desc="Final pitch deck review session for cohort A."
              />
              <LessonCard 
                title="Idea Feedback Session" 
                time="Mar 22, 02:30 PM" 
                color="bg-emerald-500" 
                desc="Open floor for product maturity discussion."
              />
              
              <div className="ios-card bg-indigo-500/5 border-indigo-500/20 mt-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="text-indigo-400 w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase mb-1">AI Recommendation</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Based on submission trends, <span className="text-white">GreenFlow</span> requires a direct technical advisory session this week.</p>
                  </div>
                </div>
              </div>
           </div>
         </section>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, sub, icon: Icon, color, badge }) {
  return (
    <div className="ios-card group">
       <div className="flex justify-between items-start mb-6">
          <div className={`p-3 rounded-xl bg-white/5 border border-white/5 group-hover:border-indigo-500/30 transition-colors`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
          <span className="text-[9px] font-black px-3 py-1 bg-white/5 rounded-full text-slate-500 border border-white/5 tracking-widest">{badge}</span>
       </div>
       <div>
         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
         <h4 className="text-4xl font-black text-white mb-2">{value}</h4>
         <div className="flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <p className="text-xs text-slate-400 font-bold">{sub}</p>
         </div>
       </div>
       
       <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
    </div>
  );
}

function TeamRow({ name, lead, progress, health }) {
  return (
    <tr>
       <td className="px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-black text-[10px] text-indigo-400 border border-white/5">
              {name.charAt(0)}
            </div>
            <p className="font-black text-white">{name}</p>
          </div>
       </td>
       <td className="px-6 py-5">
         <p className="text-sm text-slate-400 font-bold">{lead}</p>
       </td>
       <td className="px-6 py-5">
          <div className="w-[120px]">
            <div className="flex justify-between text-[8px] font-black uppercase text-slate-500 mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
               <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400" 
               />
            </div>
          </div>
       </td>
       <td className="px-6 py-5">
          <span className={`badge ${health === 'Great' ? 'badge-glow-success' : 'badge-glow-error'}`}>
            <Activity className="w-3 h-3" /> {health}
          </span>
       </td>
       <td className="px-6 py-5 text-right font-bold text-slate-500">
          <button className="hover:text-white transition-colors"><MoreVertical className="w-5 h-5" /></button>
       </td>
    </tr>
  );
}

function LessonCard({ title, time, color, desc }) {
  return (
     <div className="ios-card !p-5 group hover:bg-white/[0.03]">
        <div className="flex items-center gap-4 mb-3">
          <div className={`w-2 h-2 rounded-full ${color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`} />
          <h4 className="font-black text-white text-sm uppercase tracking-tight group-hover:text-indigo-400 transition-colors">{title}</h4>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-4 font-bold">{desc}</p>
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <Clock className="w-3 h-3" />
            <span>{time}</span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
        </div>
     </div>
  );
}
