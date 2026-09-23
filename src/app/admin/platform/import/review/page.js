"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
import { useApi } from "@/lib/hooks/useApi";

/**
 * IMPORT IDENTITY REVIEW
 * Lists rows flagged during historical import for identity verification.
 * Admin resolves each flag after verifying in the CRM duplicates tool.
 */

// Module scope on purpose: the hook keys its internal callback on this function,
// so an inline arrow would give it a new identity on every render and refetch in
// a loop.
const pickReviewFlags = (payload) => (payload?.success ? payload.flags || [] : []);

function ImportReviewContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState(searchParams.get("status") || "pending");
  const [resolving, setResolving] = useState(null);
  const [notification, setNotification] = useState(null);

  const notify = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // The loader's work — each status filter caching under its own URL, the
  // cache-first paint, discarding a stale response and the background refresh —
  // belongs to the hook, so the screen keeps no list state of its own and never
  // sets state from an effect. The filter stays a plain dependency, and resolving
  // a row calls refresh(), which bypasses the cache like bypassCache did.
  const { data: flags, loading, refresh } = useApi(
    `/api/platform/import/review-flags?status=${filter}`,
    { defaultValue: [], transform: pickReviewFlags, deps: [filter] },
  );

  const resolveFlag = async (id, status) => {
    setResolving(id);
    try {
      const response = await fetch("/api/platform/import/review-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await response.json();
      if (data.success) {
        notify(status === "resolved" ? t("adminMisc.platformImportReview.flagResolved") : t("adminMisc.platformImportReview.flagReopened"));
        refresh();
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
            className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--brand-orange)] flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> {t("adminMisc.platformImportReview.backToImport")}
          </Link>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
              {t("adminMisc.platformImportReview.eyebrow")}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
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
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${
                filter === tab.key
                  ? "bg-[var(--brand-orange)] text-black"
                  : "bg-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label.replace(`(${filter === tab.key ? flags.length : ""})`, filter === tab.key ? `(${flags.length})` : "")}
            </button>
          ))}
          <button
            onClick={refresh}
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
            {flags.map((flag) => (
              <div
                key={flag.id}
                className={`card p-5 border-l-4 ${
                  flag.status === "resolved" ? "border-emerald-500" : "border-amber-500"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      flag.status === "resolved" ? "bg-emerald-500/10" : "bg-amber-500/10"
                    }`}>
                      {flag.status === "resolved" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                        {flag.applicant_name || t("adminMisc.platformImportReview.unknown")}
                      </p>
                      <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                        {flag.applicant_email || t("adminMisc.platformImportReview.noEmail")} · {t("adminMisc.platformImportReview.rowPrefix")} {flag.row_number} · {t("adminMisc.platformImportReview.methodLabel")} {flag.method}
                      </p>
                      <p className="text-[10px] text-amber-500 font-bold mt-2">
                        {flag.reason}
                      </p>
                      {flag.matched_cid && (
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 font-mono">
                          {t("adminMisc.platformImportReview.linkedTo")} {flag.matched_name || flag.matched_cid} ({flag.matched_cid})
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {flag.matched_cid && (
                      <Link
                        href={`/admin/crm/timeline?cid=${flag.matched_cid}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                      >
                        <Eye className="w-3 h-3" /> {t("adminMisc.platformImportReview.viewCrm")}
                      </Link>
                    )}
                    <Link
                      href="/admin/crm/duplicates"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                    >
                      <User className="w-3 h-3" /> {t("adminMisc.platformImportReview.duplicates")}
                    </Link>
                    {flag.status === "pending" ? (
                      <button
                        onClick={() => resolveFlag(flag.id, "resolved")}
                        disabled={resolving === flag.id}
                        className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-40"
                      >
                        {resolving === flag.id ? "..." : t("adminMisc.platformImportReview.markResolved")}
                      </button>
                    ) : (
                      <button
                        onClick={() => resolveFlag(flag.id, "pending")}
                        disabled={resolving === flag.id}
                        className="px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
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
