"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { User, AlertTriangle, Check, X, ArrowRight, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";

const MERGE_FIELD_LABELS = {
  program_enrollments: "crm.duplicates.fieldProgramEnrollments",
  venture_memberships: "crm.duplicates.fieldVentureMemberships",
  timeline_events: "crm.duplicates.fieldTimelineEvents",
};

export default function DuplicatesPage() {
  const { t } = useI18n();
  const goBack = useSafeBack("/admin/crm");
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(null);
  const [preview, setPreview] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => { fetchFlags(); }, []);

  async function fetchFlags() {
    setLoading(true);
    try {
      const res = await fetch("/api/contacts/duplicates");
      const data = await res.json();
      if (data.success) setFlags(data.flags || []);
    } catch (_) {}
    setLoading(false);
  }

  async function handleDismiss(flagId) {
    try {
      await fetch(`/api/contacts/duplicates?id=${flagId}`, { method: "DELETE" });
      setFlags(f => f.filter(x => x.id !== flagId));
      notify(t("crm.duplicates.duplicateFlagDismissed"), "success");
    } catch (_) { notify(t("crm.duplicates.failedToDismiss"), "error"); }
  }

  async function handlePreview(aCid, bCid) {
    setMerging({ aCid, bCid });
    try {
      const res = await fetch(`/api/contacts/merge/preview?a=${aCid}&b=${bCid}`);
      const data = await res.json();
      if (data.success) setPreview(data);
    } catch (_) { notify(t("crm.duplicates.failedToPreviewMerge"), "error"); }
  }

  async function handleMerge(survivor, duplicate) {
    try {
      const res = await fetch("/api/contacts/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ survivor_cid: survivor, duplicate_cid: duplicate }),
      });
      const data = await res.json();
      if (data.success) {
        notify(t("crm.duplicates.mergedSuccess", { summary: data.summary || "" }), "success");
        setFlags(f => f.filter(x => x.contact_cid_a !== survivor && x.contact_cid_b !== duplicate));
        setMerging(null);
        setPreview(null);
        fetchFlags();
      } else {
        notify(t((data.error || t("crm.duplicates.mergeFailed")) || "") || (data.error || t("crm.duplicates.mergeFailed")), "error");
      }
    } catch (_) { notify(t("crm.duplicates.mergeFailed"), "error"); }
  }

  function notify(msg, type) {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  }

  return (
    <DashboardLayout role="super_admin" activeTab="crm">
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Back nav */}
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button onClick={goBack} className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("crm.backToPrevious")}
          </button>
          <Link href="/admin/crm" className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("crm.backToCrm")}
          </Link>
        </nav>

        {notification && (
          <div className={`px-4 py-3 rounded-xl text-sm font-bold ${notification.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
            {notification.msg}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin/crm" className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)]">← {t("crm.duplicates.crm")}</Link>
            <h1 className="text-xl font-black uppercase mt-1">{t("crm.duplicates.title")}</h1>
          </div>
          <button onClick={fetchFlags} className="flex items-center gap-2 px-4 py-2 bg-tertiary rounded-xl text-xs font-bold uppercase">
            <RefreshCw className="w-3 h-3" /> {t("crm.duplicates.refresh")}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">{t("crm.duplicates.loading")}</p>
        ) : flags.length === 0 ? (
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-10 text-center">
            <Check className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
            <p className="text-sm font-bold">{t("crm.duplicates.noDuplicates")}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t("crm.duplicates.noDuplicatesHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {flags.map(flag => (
              <div key={flag.id} className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-[10px] font-black uppercase bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full">
                        {t("crm.duplicates.match", {
                          reason: flag.match_reason,
                          confidence: Math.round((flag.confidence || 0) * 100),
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{flag.contact_a?.name || flag.contact_cid_a}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">{flag.contact_a?.email}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{flag.contact_b?.name || flag.contact_cid_b}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">{flag.contact_b?.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePreview(flag.contact_cid_a, flag.contact_cid_b)}
                      className="px-3 py-1.5 bg-[var(--brand-orange)] text-black font-bold text-[10px] uppercase rounded-lg"
                    >
                      {t("crm.duplicates.review")}
                    </button>
                    <button
                      onClick={() => handleDismiss(flag.id)}
                      className="px-3 py-1.5 bg-tertiary font-bold text-[10px] uppercase rounded-lg"
                    >
                      {t("crm.duplicates.dismiss")}
                    </button>
                  </div>
                </div>

                {/* Merge preview */}
                {merging && merging.aCid === flag.contact_cid_a && preview && (
                  <div className="mt-4 border-t border-[var(--border-primary)] pt-4 space-y-3">
                    <p className="text-xs font-bold uppercase">{t("crm.duplicates.mergePreview")}</p>
                    {preview.summary && (
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        {Object.entries(preview.summary).map(([k, v]) => (
                          <div key={k} className="bg-tertiary rounded-lg p-2">
                            <span className="font-bold">{v}</span> <span className="text-[var(--text-secondary)]">{t(MERGE_FIELD_LABELS[k] || "") || k}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMerge(flag.contact_cid_a, flag.contact_cid_b)}
                        className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-[10px] uppercase rounded-lg"
                      >
                        {t("crm.duplicates.keepMergeRight", {
                          name: flag.contact_a?.name || t("crm.duplicates.left"),
                        })}
                      </button>
                      <button
                        onClick={() => handleMerge(flag.contact_cid_b, flag.contact_cid_a)}
                        className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-[10px] uppercase rounded-lg"
                      >
                        {t("crm.duplicates.keepMergeLeft", {
                          name: flag.contact_b?.name || t("crm.duplicates.right"),
                        })}
                      </button>
                      <button onClick={() => { setMerging(null); setPreview(null); }} className="px-3 py-1.5 bg-tertiary font-bold text-[10px] uppercase rounded-lg">
                        {t("crm.duplicates.cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
