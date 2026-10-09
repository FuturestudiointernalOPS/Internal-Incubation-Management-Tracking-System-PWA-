"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Target, User, Building2, FileText, Clock } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import CrmActivityPanel from "@/components/ui/CrmActivityPanel";

export const dynamic = "force-dynamic";

export default function CrmLeadDetailPage({ params }) {
  const { t } = useI18n();
  const router = useRouter();
  
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { id } = await params;
        const res = await fetch(`/api/crm/leads/${id}`);
        const data = await res.json();
        if (alive) {
          if (data.success) setLead(data.lead);
          else setError(t(data.error || "errors.somethingWrong"));
        }
      } catch {
        if (alive) setError(t("errors.somethingWrong"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [params, t]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="text-red-500">
        {error || t("crm.leads.notFound")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/crm/leads")}
          className="p-2 rounded-full hover:bg-[var(--surface-2)] text-[var(--text-secondary)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
            {lead.title}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {t(`crm.leads.types.${lead.lead_type}`) || lead.lead_type}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-4">
              {t("crm.leads.detailsLabel")}
            </h2>
            <div className="space-y-4 text-sm text-[var(--text-primary)]">
              <div>
                <span className="text-[var(--text-secondary)] block text-xs">{t("crm.leads.statusLabel")}</span>
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[var(--surface-3)] mt-1">
                  {t(`crm.leads.statuses.${lead.status}`) || lead.status}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-secondary)] block text-xs">{t("crm.leads.qualificationLabel")}</span>
                <span className="mt-1 block">
                  {t(`crm.leads.qualifications.${lead.qualification_state}`) || lead.qualification_state}
                </span>
              </div>
              {lead.description && (
                <div>
                  <span className="text-[var(--text-secondary)] block text-xs">{t("crm.leads.descriptionLabel")}</span>
                  <p className="mt-1">{lead.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-4">
              {t("crm.leads.relationsLabel")}
            </h2>
            <div className="space-y-4">
              {lead.contact_name && (
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-primary)]">{lead.contact_name}</span>
                </div>
              )}
              {lead.organization_name && (
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-primary)]">{lead.organization_name}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-sm text-[var(--text-primary)]">
                  {t("crm.leads.ownerLabel")}: {lead.owner_name || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activities + Next Action */}
      <CrmActivityPanel leadId={lead.id} />
    </div>
  );
}
