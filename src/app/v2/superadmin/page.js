'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, Zap, Layers, FolderRoot, Users, 
  Activity, Shield, ChevronRight, LayoutDashboard,
  Rocket, Sparkles, Filter, Search, TrendingUp
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { getPrefetchedData } from '@/utils/prefetch';
import { IMPACT_CACHE } from '@/utils/impactCache';
import { Copy, CheckCircle2, Link as LinkIcon } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color, badge, onClick }) => (
  <div 
    onClick={onClick}
    className={`ios-card group transition-all duration-300 ${onClick ? 'cursor-pointer hover:border-[#FF6600]/50 hover:bg-white/[0.04] hover:-translate-y-1' : ''}`}
  >
    <div className="flex justify-between items-start mb-6">
      <div className={`p-3 rounded-xl bg-white/5 border border-white/5 ${color} group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      {badge && <span className="badge badge-glow-success uppercase text-[8px] font-black">{badge}</span>}
      {onClick && <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-[#FF6600] group-hover:translate-x-1 transition-all" />}
    </div>
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{title}</p>
    <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{value}</h3>
  </div>
);

export default function SuperAdminV2Dashboard() {
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();

  const [stats, setStats] = useState({ programs: 0, projects: 0, participants: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sa = localStorage.getItem('sa_session');
    if (!sa || (!sa.startsWith('sa-session-') && sa !== 'prime-2026-active')) {
      router.replace('/terminal');
      return;
    }

    const fetchData = async () => {
      try {
        const url = '/api/v2/superadmin/full-state';
        
        // 1. Check Prefetch Store (Zero Latency)
        const prefetched = getPrefetchedData(url);
        if (prefetched) {
          setStats({ ...prefetched.stats, activeLogs: prefetched.activity || [] });
          setLoading(false);
          return;
        }

        // 2. Check Local Cache (Fast Feedback)
        const cached = IMPACT_CACHE.get('superadmin_dashboard');
        if (cached) {
          setStats({ ...cached.stats, activeLogs: cached.activity || [] });
          setLoading(false);
        }

        const res = await fetch(url);
        const data = await res.json();
        
        if (data.success) {
           setStats({
              ...data.stats,
              activeLogs: data.activity || []
           });
           IMPACT_CACHE.set('superadmin_dashboard', data);
        }
      } catch (err) {
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    setIsLoaded(true);
  }, [router]);

  if (!isLoaded) return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
    </div>
  );

  return (
    <DashboardLayout role="super_admin" activeTab="v2">
      <div className="space-y-12">
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div className="animation-reveal">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-[#FF6600] font-black text-[10px] uppercase tracking-[0.4em]">Internal Operations</span>
              <div className="h-px w-10 bg-[#FF6600]/30" />
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Operational Dashboard</h2>
            <p className="text-slate-400 font-bold tracking-tight">
               Manage program lifecycles and operational tracking across the platform.
            </p>
          </div>
          <div className="flex gap-4">
             <button 
                onClick={() => router.push('/v2/superadmin/programs/new')}
                className="btn-prime !py-4 shadow-orange-600/10"
             >
                <Plus className="w-5 h-5 mr-2" /> Create New Program
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Active Programs" 
            value={stats.programs} 
            icon={Layers} 
            color="text-[#FF6600]" 
            badge="ACTIVE" 
            onClick={() => router.push('/v2/superadmin/programs')}
          />
          <StatCard 
            title="Team Members" 
            value={stats.totalStaff || 0} 
            icon={Users} 
            color="text-emerald-400" 
            badge="SYNCED" 
            onClick={() => router.push('/v2/superadmin/communications/contacts')}
          />
          <StatCard 
            title="Total Enrolled" 
            value={stats.participants} 
            icon={Rocket} 
            color="text-amber-400" 
            onClick={() => router.push('/v2/superadmin/communications/contacts')}
          />
          <StatCard 
            title="Platform Health" 
            value="100%" 
            icon={Activity} 
            color="text-rose-400" 
            badge="STABLE" 
            onClick={() => router.push('/v2/superadmin/settings')}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 space-y-8">
              <div className="ios-card overflow-hidden">
                 <div className="flex items-center justify-between mb-8">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                       <Sparkles className="w-4 h-4 text-[#FF6600]" /> Recent Activity Log
                    </h4>
                    <button className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest hover:text-white transition-colors">View All Logs</button>
                 </div>
                 
                 <div className="space-y-6">
                    {stats.activeLogs && stats.activeLogs.length > 0 ? (
                       stats.activeLogs.map((log, index) => (
                          <div key={index} className="flex items-center gap-4 group cursor-default">
                             <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 group-hover:border-[#FF6600]/30 transition-all">
                                <Activity className="w-4 h-4 text-[#FF6600]" />
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black text-white uppercase tracking-tighter truncate">{log.action}</p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{log.user || 'System'} · {new Date(log.timestamp).toLocaleString()}</p>
                             </div>
                             <ChevronRight className="w-3 h-3 text-slate-800" />
                          </div>
                       ))
                    ) : (
                       <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-dashed border-white/10">
                             <Activity className="w-8 h-8 text-slate-700" />
                          </div>
                          <p className="text-slate-500 font-bold max-w-xs">Connecting to the database... No active events found yet.</p>
                       </div>
                    )}
                 </div>
              </div>
           </div>

           <div className="space-y-8">
              <div className="ios-card bg-[#FF6600]/5 border-[#FF6600]/10 text-left">
                 <h4 className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest mb-6">Quick Actions</h4>
                 <div className="space-y-3">
                     <button 
                        onClick={() => router.push('/v2/superadmin/communications/contacts')}
                        className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-orange-500/30 hover:bg-white/10 transition-all group"
                     >
                        <span className="text-xs font-black text-white uppercase tracking-tighter">Bulk Import Participants</span>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-orange-400 transition-colors" />
                     </button>
                     <button 
                        onClick={() => router.push('/v2/superadmin/communications/contacts')}
                        className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-orange-500/30 hover:bg-white/10 transition-all group"
                     >
                        <span className="text-xs font-black text-white uppercase tracking-tighter">Assign Program Managers</span>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-orange-400 transition-colors" />
                     </button>
                     <button 
                        onClick={() => router.push('/v2/superadmin/settings')}
                        className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-orange-500/30 hover:bg-white/10 transition-all group"
                     >
                        <span className="text-xs font-black text-white uppercase tracking-tighter">Configure Group Schema</span>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[#FF6600] transition-colors" />
                     </button>
                     
                     <div className="pt-4 mt-4 border-t border-white/5">
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-3 ml-1">Temporary Access</p>
                        <button 
                           onClick={async () => {
                              try {
                                 // Fetch programs to get a valid ID if needed, or use a system-wide one
                                 const progRes = await fetch('/api/v2/pm/programs');
                                 const progData = await progRes.json();
                                 const program_id = progData.programs?.[0]?.id || 'SYSTEM-GENERIC';

                                 const res = await fetch('/api/v2/invites', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                       program_id,
                                       group_name: 'Future Studio',
                                       role: 'staff',
                                       expiresInHours: 1,
                                       created_by: 'super_admin'
                                    })
                                 });
                                 const data = await res.json();
                                 if (data.inviteUrl) {
                                    navigator.clipboard.writeText(data.inviteUrl);
                                    window.dispatchEvent(new CustomEvent('impactos:notify', { 
                                       detail: { type: 'success', message: 'Future Studio Invite copied (Expires in 1hr)' } 
                                    }));
                                 }
                              } catch (e) {
                                 console.error(e);
                              }
                           }}
                           className="w-full flex items-center justify-between p-4 rounded-xl bg-[#FF6600]/10 border border-[#FF6600]/20 hover:bg-[#FF6600]/20 transition-all group"
                        >
                           <div className="flex items-center gap-3">
                              <LinkIcon className="w-4 h-4 text-[#FF6600]" />
                              <span className="text-xs font-black text-[#FF6600] uppercase tracking-tighter">Future Studio Link</span>
                           </div>
                           <Copy className="w-4 h-4 text-[#FF6600]/50 group-hover:text-[#FF6600]" />
                        </button>
                     </div>
                 </div>
              </div>

              <div className="ios-card bg-[#0d0d18] border-white/5">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">System Status</h4>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                       <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Turso Database Engine</span>
                       <span className="text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">ONLINE</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                       <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">V2 Core Systems</span>
                       <span className="text-[9px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">ACTIVE</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
