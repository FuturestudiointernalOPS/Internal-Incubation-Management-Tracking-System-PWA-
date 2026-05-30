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
    if (parsedUser.role !== 'staff' && parsedUser.role !== 'super_admin' && parsedUser.role !== 'teacher') {
      router.replace('/terminal');
      return;
    }

    const checkAssignments = async () => {
      try {
        const res = await fetch(`/api/v2/teacher/full-state?cid=${parsedUser.cid || parsedUser.id}`);
        const data = await res.json();
        if (data.success && (data.programs?.length > 0 || data.teams?.length > 0)) {
           router.replace('/teacher');
        }
      } catch (e) {}
    };

    setUser(parsedUser);
    checkAssignments();
  }, [router]);

  return (
    <DashboardLayout role="staff">
      <div className="space-y-10 pb-20 text-left">
        
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-secondary)] pb-10">
          <div className="space-y-4">
             <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-[0.4em]">Operations Terminal</span>
             </div>
             <h1 className="text-5xl font-black text-[var(--text-primary)] tracking-tighter uppercase italic">Team <span className="text-[var(--text-secondary)] opacity-40">Workspace</span></h1>
          </div>
          
          <div className="flex gap-4">
             <div className="p-4 bg-secondary border border-[var(--border-primary)] rounded-2xl px-8 flex flex-col justify-center shadow-sm">
                <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1 italic opacity-60">Active Session</span>
                <span className="text-emerald-500 font-black text-xs uppercase italic flex items-center gap-2"><Activity className="w-3 h-3" /> System Ready</span>
             </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="ios-card bg-secondary border-[var(--border-secondary)] !p-10 space-y-8 shadow-sm">
              <div className="flex items-center justify-between">
                 <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter">Operational Resources</h3>
                 <span className="text-[10px] font-black text-[var(--brand-orange)] uppercase tracking-widest italic">Knowledge Bank</span>
              </div>
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase leading-relaxed tracking-tight opacity-70">
                 Access strategic assets, deployment manuals, and curriculum nodes from the centralized library.
              </p>
              <button 
                 onClick={() => router.push('/admin/knowledge')}
                 className="w-full bg-[var(--brand-orange)] text-white font-black uppercase italic tracking-widest py-5 rounded-2xl hover:bg-[var(--text-primary)] transition-all shadow-2xl shadow-orange-600/20 flex items-center justify-center gap-3 mt-10"
              >
                 <Library className="w-5 h-5" /> Open Knowledge Bank
              </button>
           </div>

           <div className="ios-card bg-secondary border-[var(--border-secondary)] !p-10 flex flex-col justify-center text-center shadow-sm">
              <Zap className="w-12 h-12 text-[var(--brand-orange)] mx-auto mb-6 opacity-20" />
              <h3 className="text-xl font-black text-[var(--text-primary)] uppercase italic tracking-tighter mb-2">Unassigned Sector</h3>
              <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest leading-relaxed opacity-60">
                 You are currently not assigned to an active Program.<br/>
                 Contact the Super Admin to anchor your operational status.
              </p>
           </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
