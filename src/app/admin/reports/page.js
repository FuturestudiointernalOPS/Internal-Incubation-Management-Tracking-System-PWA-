'use client';
import React, { useState, useEffect } from 'react';
import { BarChart3, Clock } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

export default function ReportsPlaceholder() {
  const [role, setRole] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setRole(user.role || 'staff');
  }, []);

  if (!role) return null;

  return (
    <DashboardLayout role={role}>
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20 flex items-center justify-center text-[var(--brand-orange)] animate-pulse">
          <BarChart3 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Intelligence <span className="text-slate-600">Reporting</span></h1>
          <div className="flex items-center justify-center gap-2 text-[var(--brand-orange)]">
            <Clock className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Module Deployment Pending</span>
          </div>
        </div>
        <p className="max-w-md text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
          The tactical reporting engine is currently undergoing final calibration. Access will be granted in the next operational phase.
        </p>
      </div>
    </DashboardLayout>
  );
}
