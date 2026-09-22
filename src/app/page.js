'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';
import { useI18n } from "@/lib/i18n";
import { roleHomeHref } from "@/lib/platform/roles";

export default function LandingPage() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const sa_session = localStorage.getItem('sa_session');

    if (sa_session === 'prime-2026-active') {
      router.replace('/admin');
    } else if (user) {
      // The destination was decided by the server when this person signed in and
      // travelled with their identity, so this bounce can never contradict the
      // login redirect. The shared map is the fallback for a stored person from
      // before that answer existed.
      router.replace(user.home || roleHomeHref(user.role) || '/workspaces');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center text-slate-200 font-sans">
      <div className="flex flex-col items-center space-y-6 text-center animate-pulse">
         <Shield className="w-12 h-12 text-[#FF6600]" />
         <div className="space-y-2">
           <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">{t("rootMisc.landing.brand")}</h2>
           <p className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center justify-center gap-2">
             <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF6600]" /> {t("rootMisc.landing.connecting")}
           </p>
         </div>
      </div>
    </div>
  );
}


