"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  User,
  UserCheck,
  Eye,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

/**
 * IMPORT IDENTITY REVIEW
 * Lists rows flagged during historical import for identity verification.
 * Admin resolves each flag after verifying in the CRM duplicates tool.
 */

function ImportReviewContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(searchParams.get("status") || "pending");
  const [resolving, setResolving] = useState(null);
  const [notification, setNotification] = useState(null);

  const notify = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchFlags = useCallback(async (bypassCache = false) => {
    const url = `/api/platform/import/review-flags?status=${filter}`;
    const apply = (data) => {
      if (data.success) setFlags(data.flags || []);
    };
    setLoading(true);
    try {
      // Cache-first paint: switching filters / returning to this page renders
      // instantly from a fresh snapshot; resolving a flag passes
      // bypassCache=true so the list always reflects the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) cacheSet(url, data);
      apply(data);
    } catch (_) {}
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const resolveFlag = async (id, status) => {
    setResolving(id);
    try {
      const res = await fetch("/api/platform/import/review-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (data.success) {
        notify(status === "resolved" ? t("adminMisc.platformImportReview.flagResolved") : t("adminMisc.platformImportReview.flagReopened"));
        fetchFlags(true);
      }
    } catch (_) {}
    setResolving(null);
  };

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {notification && (
          <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-black uppercase animate-in">
            {notification}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Link
            href="/admin/platform/import"
            className="text-[10px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--brand-orange)] flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> {t("adminMisc.platformImportReview.backToImport")}
          </Link>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">
              {t("adminMisc.platformImportReview.eyebrow")}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            {t("adminMisc.platformImportReview.title")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("adminMisc.platformImportReview.subtitle")}
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          {[
            { key: "pending", label: `${t("adminMisc.platformImportReview.tabPending")} (${filter === "pending" ? flags.length : ""})` },
            { key: "resolved", label: t("adminMisc.platformImportReview.tabResolved") },
            { key: "all", label: t("adminMisc.platformImportReview.tabAll") },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                filter === tab.key
                  ? "bg-[var(--brand-orange)] text-black"
                  : "bg-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label.replace(`(${filter === tab.key ? flags.length : ""})`, filter === tab.key ? `(${flags.length})` : "")}
            </button>
          ))}
          <button
            onClick={fetchFlags}
            className="ml-auto p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
            title={t("adminMisc.platformImportReview.refresh")}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
          </div>
        ) : flags.length === 0 ? (
          <div className="card p-16 text-center">
            <UserCheck className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-primary)] uppercase">
              {t("adminMisc.platformImportReview.nothingToReview")}
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] mt-2">
              {filter === "pending"
                ? t("adminMisc.platformImportReview.noPendingFlags")
                : t("adminMisc.platformImportReview.noFlagsInView")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {flags.map((f) => (
              <div
                key={f.id}
                className={`card p-5 border-l-4 ${
                  f.status === "resolved" ? "border-emerald-500" : "border-amber-500"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      f.status === "resolved" ? "bg-emerald-500/10" : "bg-amber-500/10"
                    }`}>
                      {f.status === "resolved" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-black text-[var(--text-primary)] uppercase">
                        {f.applicant_name || t("adminMisc.platformImportReview.unknown")}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                        {f.applicant_email || t("adminMisc.platformImportReview.noEmail")} · {t("adminMisc.platformImportReview.rowPrefix")} {f.row_number} · {t("adminMisc.platformImportReview.methodLabel")} {f.method}
                      </p>
                      <p className="text-[10px] text-amber-500 font-bold mt-2">
                        {f.reason}
                      </p>
                      {f.matched_cid && (
                        <p className="text-[9px] text-[var(--text-secondary)] mt-1 font-mono">
                          {t("adminMisc.platformImportReview.linkedTo")} {f.matched_name || f.matched_cid} ({f.matched_cid})
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {f.matched_cid && (
                      <Link
                        href={`/admin/crm/timeline?cid=${f.matched_cid}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                      >
                        <Eye className="w-3 h-3" /> {t("adminMisc.platformImportReview.viewCrm")}
                      </Link>
                    )}
                    <Link
                      href="/admin/crm/duplicates"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                    >
                      <User className="w-3 h-3" /> {t("adminMisc.platformImportReview.duplicates")}
                    </Link>
                    {f.status === "pending" ? (
                      <button
                        onClick={() => resolveFlag(f.id, "resolved")}
                        disabled={resolving === f.id}
                        className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase hover:brightness-110 disabled:opacity-40"
                      >
                        {resolving === f.id ? "..." : t("adminMisc.platformImportReview.markResolved")}
                      </button>
                    ) : (
                      <button
                        onClick={() => resolveFlag(f.id, "pending")}
                        disabled={resolving === f.id}
                        className="px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                      >
                        {t("adminMisc.platformImportReview.reopen")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function ImportReviewPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>}>
      <ImportReviewContent />
    </Suspense>
  );
}
