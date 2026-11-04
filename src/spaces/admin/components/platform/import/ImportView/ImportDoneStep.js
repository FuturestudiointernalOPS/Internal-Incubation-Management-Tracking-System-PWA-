"use client";

import { motion } from "framer-motion";
import { CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

/**
 * The final wizard panel of the platform import: the result summary, the
 * duplicate-batch notice, identity/error rows and the exits. Presentational —
 * the screen owns the state and handlers and passes them down.
 */
export default function ImportDoneStep({ importResult, handleReset, t }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-8 space-y-6"
    >
      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        <p className="text-[11px] font-bold text-emerald-500 uppercase">
          {t("adminMisc.platformImport.importComplete")}
        </p>
      </div>

      {importResult.duplicate_batch && importResult.previous_batch && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-[10px] font-bold text-amber-500 uppercase">
            {t("adminMisc.platformImport.duplicateWarning", { batchId: importResult.previous_batch.id, date: new Date(importResult.previous_batch.created_at).toLocaleDateString() })}
          </p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
            {t("adminMisc.platformImport.duplicateSkipped")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center border-l-4 border-emerald-500">
          <p className="text-2xl font-black tracking-tight text-emerald-500">
            {importResult.imported}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {t("adminMisc.platformImport.statImported")}
          </p>
        </div>
        <div className="card p-4 text-center border-l-4 border-amber-500">
          <p className="text-2xl font-black tracking-tight text-amber-500">
            {importResult.skipped}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {t("adminMisc.platformImport.statSkipped")}
          </p>
        </div>
        <div className="card p-4 text-center border-l-4 border-blue-500">
          <p className="text-2xl font-black tracking-tight text-blue-500">
            {importResult.needs_review || 0}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {t("adminMisc.platformImport.statNeedsReview")}
          </p>
        </div>
        <div className="card p-4 text-center border-l-4 border-rose-500">
          <p className="text-2xl font-black tracking-tight text-rose-500">
            {importResult.errors?.length || 0}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            {t("adminMisc.platformImport.statErrors")}
          </p>
        </div>
      </div>

      {importResult.needs_review > 0 && importResult.review_rows?.length > 0 && (
        <div className="card p-4 border-l-4 border-blue-500">
          <p className="text-[10px] font-bold text-blue-500 uppercase mb-2">
            {t("adminMisc.platformImport.identityReviewRequired")}
          </p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mb-3">
            {t("adminMisc.platformImport.identityReviewHint")}
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {importResult.review_rows.slice(0, 20).map((reviewRow, index) => (
              <p key={index} className="text-[10px] text-[var(--text-secondary)]">
                {t("adminMisc.platformImport.rowPrefix")} {reviewRow.row}: {reviewRow.name} {reviewRow.email ? `(${reviewRow.email})` : ""} — {reviewRow.reason}
              </p>
            ))}
            {importResult.review_rows.length > 20 && (
              <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                {t("adminMisc.platformImport.moreRows", { count: importResult.review_rows.length - 20 })}
              </p>
            )}
          </div>
        </div>
      )}

      {importResult.errors?.length > 0 && (
        <div className="card p-4">
          <p className="text-[10px] font-bold text-rose-500 uppercase mb-2">
            {t("adminMisc.platformImport.rowErrors")}
          </p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {importResult.errors.slice(0, 10).map((errorRow, index) => (
              <p
                key={index}
                className="text-[10px] text-[var(--text-secondary)] font-mono"
              >
                {t("adminMisc.platformImport.rowPrefix")} {errorRow.row}: {t(errorRow.error || "") || errorRow.error}
              </p>
            ))}
          </div>
        </div>
      )}

      {importResult.needs_review > 0 && (
        <Link
          href="/admin/platform/import/review?status=pending"
          className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3"
        >
          <AlertTriangle className="w-4 h-4" />
          {importResult.needs_review === 1
            ? t("adminMisc.platformImport.reviewFlaggedOne", { count: importResult.needs_review })
            : t("adminMisc.platformImport.reviewFlaggedMany", { count: importResult.needs_review })}
        </Link>
      )}

      <button
        onClick={handleReset}
        className="btn w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3"
      >
        <RefreshCw className="w-4 h-4" />
        {t("adminMisc.platformImport.newImport")}
      </button>
    </motion.div>
  );
}
