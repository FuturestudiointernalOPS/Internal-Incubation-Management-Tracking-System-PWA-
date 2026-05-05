'use client';
import React, { useState, useEffect } from 'react';
import { 
  Rocket, Library, Target, Activity, Shield, 
  ChevronRight, ArrowRight, Zap, Search,
  Briefcase, Clock
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function StaffDashboard() {
  const router = useRouter();
  const [user, setUser] = useState({});

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.replace('/terminal');
      return;
    }
    const parsedUser = JSON.parse(userString);
    if (parsedUser.role !== 'staff' && parsedUser.role !== 'super_admin') {
      router.replace('/terminal');
      return;
    }
    setUser(parsedUser);
  }, [router]);

  return (
    <DashboardLayout role="staff">
      <div className="space-y-10 pb-20 text-left">
        
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-white/5 pb-10">
          <div className="space-y-4">
             <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#FF6600]" />
                <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-[0.4em]">Operations Terminal</span>
             </div>
             <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">Team <span className="text-slate-600">Workspace</span></h1>
          </div>
          
          <div className="flex gap-4">
             <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl px-8 flex flex-col justify-center">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 italic">Active Session</span>
                <span className="text-emerald-500 font-black text-xs uppercase italic flex items-center gap-2"><Activity className="w-3 h-3" /> System Ready</span>
             </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="ios-card bg-white/[0.01] border-white/5 !p-10 space-y-8">
              <div className="flex items-center justify-between">
                 <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Operational Resources</h3>
                 <span className="text-[10px] font-black text-[#FF6600] uppercase tracking-widest italic">Knowledge Bank</span>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed tracking-tight">
                 Access strategic assets, deployment manuals, and curriculum nodes from the centralized library.
              </p>
              <button 
                 onClick={() => router.push('/admin/knowledge')}
                 className="w-full bg-[#FF6600] text-black font-black uppercase italic tracking-widest py-5 rounded-2xl hover:bg-white transition-all shadow-2xl shadow-orange-600/20 flex items-center justify-center gap-3 mt-10"
              >
                 <Library className="w-5 h-5" /> Open Knowledge Bank
              </button>
           </div>

           <div className="ios-card bg-white/[0.01] border-white/5 !p-10 flex flex-col justify-center text-center">
              <Zap className="w-12 h-12 text-[#FF6600] mx-auto mb-6 opacity-20" />
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Unassigned Sector</h3>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-relaxed">
                 You are currently not assigned to an active Program.<br/>
                 Contact the Super Admin to anchor your operational status.
              </p>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
