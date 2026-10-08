/**
 * The screen's chrome and its two blocks.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: the page keeps every state
 * value, every read and every handler, and hands this view what it renders —
 * the toast, the already-submitted banner, the header/toggle controls, and
 * `ctx` for the report body and the modals. The JSX is moved verbatim, so the
 * DOM returned here is byte-for-byte the tree that page used to return.
 */

"use client";
import { CheckCircle2 } from "lucide-react";
import WeeklyOverview from "@/components/staff/op-report/WeeklyOverview";
import ReportHeader from "@/components/staff/op-report/ReportHeader";
import ReportTypeToggle from "@/components/staff/op-report/ReportTypeToggle";
import ReportContent from "@/components/staff/op-report/ReportContent";
import OpReportModals from "@/components/staff/op-report/OpReportModals";

export default function OpReportView({
  toast,
  t,
  existingReport,
  reportType,
  weekInfo,
  onSelectType,
  onNavigateWeek,
  ctx,
}) {
  return (
    <>
      <div className="stf space-y-6 pb-20 text-left">
        {/* Toast */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-[500] px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-widest border shadow-2xl ${
              toast.type === "error"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* HEADER */}
        <ReportHeader
          onNavigateWeek={onNavigateWeek}
          reportType={reportType}
          weekInfo={weekInfo}
        />

        <WeeklyOverview existingReport={existingReport} history={ctx.history} now={new Date(ctx.now)} reportType={reportType} weekInfo={weekInfo} />

        {/* REPORT TYPE TOGGLE */}
        <ReportTypeToggle
          onSelectType={onSelectType}
          reportType={reportType}
        />

        {existingReport?.status === "submitted" && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
              {t("staff.opReport.alreadySubmitted")}
            </p>
          </div>
        )}

        <ReportContent ctx={ctx} />
      </div>
      <OpReportModals ctx={ctx} />
    </>
  );
}
