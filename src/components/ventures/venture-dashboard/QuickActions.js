"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Zap, Layers, Shield, User, Building2, BookOpen } from "lucide-react";

/**
 * The quick-actions card (wizard, verification, founders, edit, knowledge).
 * Extracted verbatim from VentureDashboard.
 */
export default function QuickActions({ id }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <div className="card">
      <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3 flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("vadmin.dashboard.quickActions")}
      </h3>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => router.push(`/ventures/${id}/wizard`)} className="px-3 py-2 bg-brand-orange/10 text-[var(--brand-orange)] rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
          <Layers className="w-3 h-3" /> {t("vadmin.dashboard.profileWizard")}
        </button>
        <button onClick={() => router.push(`/admin/ventures/${id}/verification`)} className="px-3 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
          <Shield className="w-3 h-3" /> {t("vadmin.dashboard.uploadDocuments")}
        </button>
        <button onClick={() => router.push(`/admin/ventures/${id}/founders`)} className="px-3 py-2 bg-blue-500/10 text-blue-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
          <User className="w-3 h-3" /> {t("vadmin.dashboard.inviteFounder")}
        </button>
        <button onClick={() => router.push(`/admin/ventures/${id}/edit`)} className="px-3 py-2 bg-amber-500/10 text-amber-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
          <Building2 className="w-3 h-3" /> {t("vadmin.dashboard.editVenture")}
        </button>
        <button onClick={() => router.push(`/admin/knowledge`)} className="px-3 py-2 bg-purple-500/10 text-purple-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
          <BookOpen className="w-3 h-3" /> {t("vadmin.dashboard.knowledgeHub")}
        </button>
      </div>
    </div>
  );
}
