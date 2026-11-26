import React, { useState, useRef } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatLocaleDate } from "@/lib/constants";
import { useApi } from "@/lib/hooks/useApi";
import { formatLabel, pickProjects, pickTasks } from "./constants";
import ReportTasksTable from "./ReportTasksTable";

export default function ReportDetailModal({ report, onClose }) {
  const { t, lang } = useI18n();
  // Both reads come from the shared hook, which owns the cache, the cache-first
  // paint and the discarding of a stale answer. The week's tasks are addressed on
  // the report they belong to: with no report there is nothing to read.
  const { data: weekTasks, loading: weekTasksLoading } = useApi(
    report?.user_id && report?.week_number && report?.year
      ? `/api/tasks?user_id=${report.user_id}&week=${report.week_number}&year=${report.year}&sort=oldest`
      : null,
    {
      defaultValue: [],
      transform: pickTasks,
      deps: [report?.user_id, report?.week_number, report?.year],
    },
  );
  const { data: projects } = useApi("/api/projects", {
    defaultValue: [],
    transform: pickProjects,
  });
  const [expandedTaskMeta] = useState(null);
  const [taskLogs, setTaskLogs] = useState({});
  const pdfContentRef = useRef(null);

  const projectMap = {};
  projects.forEach((project) => {
    projectMap[project.id] = project;
  });

  const _fetchTaskLogs = async (taskId) => {
    if (taskLogs[taskId]) return;
    try {
      const response = await fetch(`/api/tasks/logs?task_id=${taskId}`);
      const payload = await response.json();
      if (payload.success)
        setTaskLogs((prev) => ({ ...prev, [taskId]: payload.logs || [] }));
    } catch {
      /* silent */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm print:bg-white print:!fixed print:!inset-0 print:!z-[9999] print:!overflow-auto"
      onClick={() => {
        if (!window.printing) onClose();
      }}
    >
      <div className="card w-full max-w-2xl space-y-6 border-brand-orange/30 animate-in text-left overflow-y-auto max-h-[90vh] print:!max-h-none print:!shadow-none print:!border-none print:!p-0 print:!bg-white print:!text-black print:!w-full print:!max-w-full print:!m-0">
        {/* Header */}
        <div className="flex justify-between items-start print:hidden">
          <div>
            <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-widest">
              {report.report_type === "standup"
                ? t("reports.standup")
                : t("reports.retro")}{" "}
              · W{report.week_number}
            </span>
            <h3 className="text-2xl font-bold text-white uppercase tracking-tight mt-1">
              {report.user_name}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const exportButton = document.getElementById("pdf-export-btn");
                if (exportButton) {
                  exportButton.disabled = true;
                  exportButton.textContent = t("adminMisc.opReports.generating");
                }
                try {
                  // Method 1: Try html2canvas + jsPDF for a clean PDF file
                  const modalEl = pdfContentRef.current;
                  if (modalEl) {
                    const html2canvasPkg = await import("html2canvas");
                    const html2canvas =
                      html2canvasPkg.default || html2canvasPkg;
                    const jsPdfPkg = await import("jspdf");
                    const { jsPDF } = jsPdfPkg;

                    const canvas = await Promise.race([
                      html2canvas(modalEl, {
                        scale: 2,
                        useCORS: false,
                        allowTaint: true,
                        backgroundColor: "#ffffff",
                        logging: false,
                        imageTimeout: 15000,
                      }),
                      new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("timeout")), 20000),
                      ),
                    ]);

                    const imgData = canvas.toDataURL("image/png");
                    const pdf = new jsPDF("p", "mm", "a4");
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                    let heightLeft = pdfHeight;
                    let position = 0;
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    pdf.addImage(
                      imgData,
                      "PNG",
                      0,
                      position,
                      pdfWidth,
                      pdfHeight,
                    );
                    heightLeft -= pageHeight;
                    while (heightLeft > 0) {
                      position = heightLeft - pdfHeight;
                      pdf.addPage();
                      pdf.addImage(
                        imgData,
                        "PNG",
                        0,
                        position,
                        pdfWidth,
                        pdfHeight,
                      );
                      heightLeft -= pageHeight;
                    }
                    const reportType =
                      report.report_type === "standup" ? "StandUp" : "Retro";
                    pdf.save(
                      `${report.user_name?.replace(/\s+/g, "_")}_Week${report.week_number}_${reportType}.pdf`,
                    );
                    return; // Success — exit
                  }
                } catch (error) {
                  console.warn(
                    "html2canvas failed, falling back to browser print:",
                    error.message || error,
                  );
                }

                // Method 2: Fallback — use browser's native Print → Save as PDF
                try {
                  window.printing = true;
                  window.print();
                  setTimeout(() => {
                    window.printing = false;
                  }, 2000);
                  window.dispatchEvent(
                    new CustomEvent("impactos:notify", {
                      detail: {
                        type: "info",
                        message: t("adminMisc.opReports.printDialogOpened"),
                        duration: 5000,
                      },
                    }),
                  );
                } catch (printErr) {
                  console.error("Print fallback also failed:", printErr);
                  window.dispatchEvent(
                    new CustomEvent("impactos:notify", {
                      detail: {
                        type: "error",
                        message: t("adminMisc.opReports.pdfExportUnavailable"),
                        duration: 6000,
                      },
                    }),
                  );
                } finally {
                  if (exportButton) {
                    exportButton.disabled = false;
                    exportButton.innerHTML = `<svg class="w-4 h-4" stroke="currentColor" fill="none" viewBox="0 0 24 24" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ${t("reports.exportPdf")}`;
                  }
                }
              }}
              id="pdf-export-btn"
              className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide"
            >
              <Download className="w-4 h-4" /> {t("reports.exportPdf")}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-lg"
            >
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </button>
          </div>
        </div>

        {/* PDF content wrapper (used by html2canvas for export) */}
        <div ref={pdfContentRef}>
          {/* PDF header with logo — visible in both print and html2canvas */}
          <div className="flex items-center gap-4 p-4 border-b border-[var(--border-primary)] print:border-gray-300 print:p-4">
            <Image
              src="/brand/logo_full.png"
              alt="Future Studio"
              width={1018}
              height={1024}
              className="h-10 w-auto object-contain print:h-10"
            />
            <div>
              <h1 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-tight print:text-black">
                {report.user_name}
              </h1>
              <p className="text-[10px] font-medium text-[var(--text-secondary)] print:text-gray-500">
                {report.report_type === "standup"
                  ? t("reports.standup")
                  : t("reports.retro")}{" "}
                — {t("time.week")} {report.week_number} · {report.year}
              </p>
            </div>
          </div>

          {/* Info bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-tertiary rounded-2xl border border-[var(--border-primary)] print:bg-gray-50 print:border print:border-gray-200 print:rounded print:p-4">
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] print:text-gray-500">
                {t("reports.teamMember")}
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
                {report.user_name}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] print:text-gray-500">
                {t("reports.role")}
              </p>
              <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
                {formatLabel(report.user_role)}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] print:text-gray-500">
                {t("time.week")}
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
                W{report.week_number} · {report.year}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] print:text-gray-500">
                {t("time.submitted")}
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide print:text-black">
                {new Date(report.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Report content — Task Table */}
          <ReportTasksTable
            weekTasks={weekTasks}
            weekTasksLoading={weekTasksLoading}
            projectMap={projectMap}
            taskLogs={taskLogs}
            expandedTaskMeta={expandedTaskMeta}
          />

          {/* Blockers detail section */}
          {weekTasks.some((task) => (task.blockers || []).length > 0) && (
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest">
                {t("reports.blockers")}
              </p>
              {weekTasks
                .filter((task) => (task.blockers || []).length > 0)
                .map((task) => (
                  <div key={task.id} className="space-y-1">
                    <p className="text-[10px] font-bold text-black">
                      {task.title}
                    </p>
                    {task.blockers.map((blocker) => (
                      <div
                        key={blocker.id}
                        className="flex items-center gap-2 pl-4 text-[9px]"
                      >
                        <span
                          className={
                            blocker.status === "active"
                              ? "text-red-500"
                              : "text-green-500"
                          }
                        >
                          ◆
                        </span>
                        <span className="font-medium text-black">
                          {blocker.title}
                        </span>
                        <span
                          className={`text-[7px] font-bold px-1 py-0.5 rounded ${blocker.status === "active" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                        >
                          {blocker.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          )}

          {/* Carry-Over Trace */}
          {weekTasks.filter(
            (task) =>
              task.status === "carried_over" ||
              (task.reschedule_count || 0) > 0,
          ).length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                {t("reports.carryOverHistory")}
              </p>
              {weekTasks
                .filter(
                  (task) =>
                    task.status === "carried_over" ||
                    (task.reschedule_count || 0) > 0,
                )
                .map((task) => {
                  const weeks = task.reschedule_count || 0;
                  const trace = [];
                  for (let weekOffset = weeks; weekOffset >= 0; weekOffset--) {
                    let weekNumber = report.week_number - weekOffset;
                    if (weekNumber < 1) {
                      weekNumber += 52;
                    }
                    trace.push(`W${weekNumber}`);
                  }
                  return (
                    <div
                      key={task.id}
                      className="p-3 border border-indigo-200 rounded"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-black">
                          {task.title}
                        </p>
                        <span
                          className={`text-[8px] font-bold px-2 py-0.5 rounded ${weeks >= 3 ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}
                        >
                          {t("reports.nWeeks", { count: weeks })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {trace.map((week, index) => (
                          <React.Fragment key={week}>
                            <span
                              className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${index === trace.length - 1 ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              {week}
                            </span>
                            {index < trace.length - 1 && (
                              <span className="text-gray-400 text-[9px]">
                                →
                              </span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Task Action Logs */}
          {weekTasks.filter((task) => expandedTaskMeta === task.id).length > 0 &&
            taskLogs[expandedTaskMeta] &&
            taskLogs[expandedTaskMeta].length > 0 && (
              <div className="space-y-2">
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                  {t("reports.assignmentHistory")}
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {taskLogs[expandedTaskMeta].map((log, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-[9px] py-1 px-2 rounded bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[7px] font-bold px-1 py-0.5 rounded ${
                            log.action_type === "TASK_CREATED"
                              ? "bg-green-100 text-green-700"
                              : log.action_type === "TASK_ASSIGNED"
                                ? "bg-blue-100 text-blue-700"
                                : log.action_type === "TASK_ACCEPTED"
                                  ? "bg-indigo-100 text-indigo-700"
                                  : log.action_type === "TASK_COMPLETED"
                                    ? "bg-green-100 text-green-700"
                                    : log.action_type === "TASK_CARRIED_OVER"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {log.action_type?.replace(/_/g, " ")}
                        </span>
                        <span className="text-gray-500">
                          {log.description || ""}
                        </span>
                      </div>
                      <span className="text-gray-600">
                        {log.created_at
                          ? formatLocaleDate(log.created_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, lang)
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Print footer */}
          <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-400 p-4">
            <p>
              {t("reports.generatedFrom")} — {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
        {/* end PDF content wrapper */}
        <button
          onClick={onClose}
          className="btn btn-primary w-full py-4 font-bold uppercase tracking-widest print:hidden"
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
