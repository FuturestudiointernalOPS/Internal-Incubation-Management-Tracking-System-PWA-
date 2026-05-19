'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const sa_session = localStorage.getItem('sa_session');

    if (sa_session === 'prime-2026-active') {
      router.replace('/admin');
    } else if (user) {
      if (user.role === 'program_manager') router.replace('/pm/dashboard');
      else if (user.role === 'super_admin') router.replace('/admin');
      else router.replace('/login');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center text-slate-200 font-sans">
      <div className="flex flex-col items-center space-y-6 text-center animate-pulse">
         <Shield className="w-12 h-12 text-[#FF6600]" />
         <div className="space-y-2">
           <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.6em] leading-none">ImpactOS Terminal</h2>
           <p className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center justify-center gap-2">
             <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF6600]" /> Connecting Secure Session...
           </p>
         </div>
      </div>
    </div>
  );
}


