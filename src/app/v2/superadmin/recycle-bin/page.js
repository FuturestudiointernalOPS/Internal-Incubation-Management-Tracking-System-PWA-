'use client';
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Trash2, AlertTriangle } from 'lucide-react';

export default function RecycleBinPage() {
  return (
    <DashboardLayout role="super_admin" activeTab="recycle-bin">
      <div className="space-y-8 min-h-[60vh]">
        <header>
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">Recycle Bin</h2>
          <p className="text-slate-400 font-bold tracking-tight">Recover or permanently destroy archived system records.</p>
        </header>

        <div className="ios-card bg-rose-500/5 border-rose-500/10">
           <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-rose-500/20 text-rose-400">
                 <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                 <h3 className="text-xl font-black text-rose-400 uppercase tracking-tighter">Auto-Purge Active</h3>
                 <p className="text-xs font-bold text-slate-400">Items located here are destroyed permanently after 30 days.</p>
              </div>
           </div>
        </div>

        <div className="ios-card border-white/5 border-dashed relative overflow-hidden flex flex-col items-center justify-center p-20 text-center">
           <Trash2 className="w-16 h-16 text-slate-500 mb-6 opacity-30" />
           <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Bin is Empty</h3>
           <p className="text-sm font-bold text-slate-500">There are currently no items awaiting recovery or deletion.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
