/**
 * The list view: dashboard, toolbar, table, create modal, date picker.
 *
 * Cut out of src/app/platform/runs/page.js as-is: the page keeps every state
 * value and every write, and hands this block what it reads through `ctx`.
 * The names it needs are listed in the signature — nothing else.
 */

"use client";

import CreateRunModal from "@/components/platform/runs/CreateRunModal";
import DashboardStats from "@/components/platform/runs/DashboardStats";
import DatePickerModal from "@/components/platform/runs/DatePickerModal";
import RunsTable from "@/components/platform/runs/RunsTable";
import RunsToolbar from "@/components/platform/runs/RunsToolbar";
import { Loader2 } from "lucide-react";

export default function RunListView({ ctx }) {
  const {
    createData,
    creatingGroup,
    dashboardStats,
    forms,
    groups,
    handleArchiveRun,
    handleCreate,
    handleCreateGroupInline,
    handleDeleteRun,
    handleRestoreRun,
    inlineGroupName,
    loading,
    notification,
    openRun,
    page,
    perPage,
    runListNotice,
    runs,
    saving,
    search,
    setCreateData,
    setInlineGroupName,
    setPage,
    setSearch,
    setShowCreate,
    setShowDatePicker,
    setShowInlineGroup,
    setSortDir,
    setSortField,
    setStatusFilter,
    showCreate,
    showDatePicker,
    showInlineGroup,
    sortDir,
    sortField,
    statusFilter,
    t,
    totalRuns,
  } = ctx;

return (
  <div className="p-6 space-y-6 animate-in">
    {(notification || runListNotice) && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-[10px] font-bold uppercase">{notification || runListNotice}</div>}

    {/* Operational Dashboard */}
    <DashboardStats dashboardStats={dashboardStats} t={t} />

    <RunsToolbar
      search={search}
      setSearch={setSearch}
      statusFilter={statusFilter}
      onStatusFilterChange={(value) => { setStatusFilter(value); setPage(1); }}
      onNewRun={() => setShowCreate(true)}
      t={t}
    />
    {loading ? <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" /></div> : (
      <RunsTable runs={runs} search={search} statusFilter={statusFilter} sortField={sortField} sortDir={sortDir} page={page} perPage={perPage} total={totalRuns} onSort={(field, direction) => { setSortField(field); setSortDir(direction); setPage(1); }} onPage={setPage} openRun={openRun} groups={groups} onArchive={handleArchiveRun} onRestore={handleRestoreRun} onDelete={handleDeleteRun} />
    )}

    {/* Create modal */}
    {/* ─── Date Picker Modal (completely outside create modal, no clipping) ─── */}
    {showDatePicker && (
      <DatePickerModal
        datePicker={showDatePicker}
        createData={createData}
        setCreateData={setCreateData}
        onClose={() => setShowDatePicker(null)}
        t={t}
      />
    )}

    {showCreate && (
      <CreateRunModal
        createData={createData}
        setCreateData={setCreateData}
        forms={forms}
        groups={groups}
        saving={saving}
        handleCreate={handleCreate}
        showInlineGroup={showInlineGroup}
        setShowInlineGroup={setShowInlineGroup}
        inlineGroupName={inlineGroupName}
        setInlineGroupName={setInlineGroupName}
        creatingGroup={creatingGroup}
        handleCreateGroupInline={handleCreateGroupInline}
        setShowDatePicker={setShowDatePicker}
        onClose={() => setShowCreate(false)}
        onDismiss={() => { setShowCreate(false); setShowDatePicker(null); }}
        t={t}
      />
    )}

  </div>
);
}
