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
import ReportHeader from "@/components/staff/op-report/ReportHeader";
import ReportTypeToggle from "@/components/staff/op-report/ReportTypeToggle";
import WeeklyOverview from "@/components/staff/op-report/WeeklyOverview";
import ReportContent from "@/components/staff/op-report/ReportContent";
import OpReportModals from "@/components/staff/op-report/OpReportModals";

export default function OpReportView({
  toast,
  existingReport,
  history,
  now,
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


        {/* REPORT TYPE TOGGLE */}
        <ReportTypeToggle
          onSelectType={onSelectType}
          reportType={reportType}
        />

        <WeeklyOverview
          existingReport={existingReport}
          history={history}
          now={now}
          reportType={reportType}
          weekInfo={weekInfo}
          tasks={ctx.tasks}
        />

        <ReportContent ctx={ctx} />
      </div>
      <OpReportModals ctx={ctx} />
    </>
  );
}
