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
import DashboardLayout from "@/components/layout/DashboardLayout";
import Link from "next/link";

/**
 * IMPORT IDENTITY REVIEW
 * Lists rows flagged during historical import for identity verification.
 * Admin resolves each flag after verifying in the CRM duplicates tool.
 */

function ImportReviewContent() {
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

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/import/review-flags?status=${filter}`);
      const data = await res.json();
      if (data.success) setFlags(data.flags || []);
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
        notify(status === "resolved" ? "Flag resolved" : "Flag reopened");
        fetchFlags();
      }
    } catch (_) {}
    setResolving(null);
  };

  return (
    <DashboardLayout role="super_admin">
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
            <ArrowLeft className="w-3 h-3" /> Back to Import
          </Link>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">
              Import
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Identity Review
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Rows where the importer found only a name match. Verify each identity
            before running AI evaluation to avoid merging two different people.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2">
          {[
            { key: "pending", label: `Pending (${filter === "pending" ? flags.length : ""})` },
            { key: "resolved", label: "Resolved" },
            { key: "all", label: "All" },
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
            title="Refresh"
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
              Nothing to review
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] mt-2">
              {filter === "pending"
                ? "No pending identity flags. The import resolved all contacts confidently."
                : "No flags in this view."}
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
                        {f.applicant_name || "Unknown"}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                        {f.applicant_email || "no email"} · Row {f.row_number} · Method: {f.method}
                      </p>
                      <p className="text-[10px] text-amber-500 font-bold mt-2">
                        {f.reason}
                      </p>
                      {f.matched_cid && (
                        <p className="text-[9px] text-[var(--text-secondary)] mt-1 font-mono">
                          Linked to: {f.matched_name || f.matched_cid} ({f.matched_cid})
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
                        <Eye className="w-3 h-3" /> View CRM
                      </Link>
                    )}
                    <Link
                      href="/admin/crm/duplicates"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                    >
                      <User className="w-3 h-3" /> Duplicates
                    </Link>
                    {f.status === "pending" ? (
                      <button
                        onClick={() => resolveFlag(f.id, "resolved")}
                        disabled={resolving === f.id}
                        className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase hover:brightness-110 disabled:opacity-40"
                      >
                        {resolving === f.id ? "..." : "Mark Resolved"}
                      </button>
                    ) : (
                      <button
                        onClick={() => resolveFlag(f.id, "pending")}
                        disabled={resolving === f.id}
                        className="px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[9px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function ImportReviewPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>}>
      <ImportReviewContent />
    </Suspense>
  );
}
