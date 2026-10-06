"use client";

import { BarChart3, Link2, Users, FileText, Mail, Send, Settings } from "lucide-react";
import RunDetailHeader from "@/components/platform/runs/RunDetailHeader";
import EvalProgressPanel from "@/components/platform/runs/EvalProgressPanel";
import RunTabs from "@/components/platform/runs/RunTabs";
import RunResponsesPanel from "@/components/platform/runs/RunResponsesPanel";
import RunAdminTabs from "@/components/platform/runs/RunAdminTabs";
import RunDetailModals from "@/components/platform/runs/RunDetailModals";

export default function RunDetailView({ bulkAbortRef, filterRowRef, runBulkApprove, retryAbortRef, runRetryEmails, ctx }) {
  const {
    selectedRun,
    groups,
    setSelectedRun,
    handleLaunch,
    handleStatusChange,
    handleDeleteRun,
    openManualAdd,
    evalProgress,
    evalStats,
    canReview,
    handleBatchEvaluate,
    t,
    notification,
    runListNotice,
    detailTab,
    setDetailTab,
    assignments,
  } = ctx;

  const tabs = [
    { id: "overview", label: t("platformMisc.runs.tabOverview"), icon: BarChart3 },
    { id: "share", label: t("platformMisc.runs.tabShare"), icon: Link2 },
    { id: "assignments", label: t("platformMisc.runs.tabAssignments", { count: assignments.length }), icon: Users },
    { id: "responses", label: t("platformMisc.runs.tabAllResponses"), icon: FileText, href: `/platform/responses?run_id=${selectedRun?.id || ""}` },
    { id: "templates", label: t("platformMisc.runs.tabTemplates"), icon: Mail },
    { id: "emails", label: t("platformMisc.runs.tabEmails"), icon: Send },
    { id: "settings", label: t("platformMisc.runs.tabSettings"), icon: Settings },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {(notification || runListNotice) && (
        <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-bold uppercase animate-in">
          {notification || runListNotice}
        </div>
      )}
      <RunDetailHeader
        selectedRun={selectedRun}
        groups={groups}
        onBack={() => setSelectedRun(null)}
        handleLaunch={handleLaunch}
        handleStatusChange={handleStatusChange}
        handleDeleteRun={handleDeleteRun}
        openManualAdd={openManualAdd}
        evalProgress={evalProgress}
        canReview={canReview}
        handleBatchEvaluate={handleBatchEvaluate}
        t={t}
      />
      <EvalProgressPanel evalProgress={evalProgress} evalStats={evalStats} t={t} />
      <RunTabs tabs={tabs} detailTab={detailTab} onSelect={setDetailTab} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <RunResponsesPanel bulkAbortRef={bulkAbortRef} filterRowRef={filterRowRef} runBulkApprove={runBulkApprove} ctx={ctx} />
        <RunAdminTabs retryAbortRef={retryAbortRef} runRetryEmails={runRetryEmails} ctx={ctx} />
      </div>
      <RunDetailModals ctx={ctx} />
    </div>
  );
}
