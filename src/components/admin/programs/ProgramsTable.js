"use client";

import {
  Plus,
  Search,
  ChevronRight,
  User,
  Users,
  Edit3,
  Archive,
  RotateCcw,
  Trash2,
  Settings,
  ArrowLeft,
  Signal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";

const TABS = (t) => [
  { key: "all", label: t("admin.tabAll") },
  { key: "active", label: t("admin.tabActive") },
  { key: "planned", label: t("adminMisc.programs.tabPlanned") },
  { key: "pending", label: t("admin.tabPending") },
  { key: "completed", label: t("admin.tabCompleted") },
  { key: "archived", label: t("admin.tabArchived") },
];

function ProgramStatusBadge({ status, t }) {
  const STATUS_STYLES = {
    active: "bg-emerald-500/10 text-emerald-500",
    in_progress: "bg-blue-500/10 text-blue-500",
    planned: "bg-sky-500/10 text-sky-500",
    pending: "bg-amber-500/10 text-amber-500",
    completed: "bg-purple-500/10 text-purple-500",
    archived: "bg-rose-500/10 text-rose-500",
  };
  const STATUS_LABELS = {
    active: t("adminMisc.programs.statusInProgress"),
    in_progress: t("adminMisc.programs.statusInProgress"),
    planned: t("adminMisc.programs.statusPlanned"),
    pending: t("adminMisc.programs.statusPending"),
    completed: t("adminMisc.programs.statusCompleted"),
    archived: t("adminMisc.programs.statusArchived"),
  };
  return (
    <span
      className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${STATUS_STYLES[status] ?? "bg-slate-500/10 text-[var(--text-secondary)]"}`}
    >
      {STATUS_LABELS[status] ?? status ?? t("adminMisc.programs.unknown")}
    </span>
  );
}

/**
 * ProgramsTable
 *
 * Renders the header, tab filters, search bar, and programs data table.
 *
 * Props:
 * - programs       {Array}    Filtered programs to display
 * - loading        {boolean}  Show skeleton while data loads
 * - activeTab      {string}   Currently selected tab key
 * - onTabChange    {fn}       (tabKey) => void
 * - search         {string}   Current search text
 * - onSearchChange {fn}       (value) => void
 * - onEditProgram  {fn}       (program) => void — opens the edit modal
 * - onArchive      {fn}       (id, isArchiving, event, name) => void
 * - onDelete       {fn}       (id, event, name) => void
 * - toDateInputValue {fn}     (value) => YYYY-MM-DD string
 */
export default function ProgramsTable({
  programs,
  loading,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  onEditProgram,
  onArchive,
  onDelete,
  toDateInputValue,
}) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <div className="space-y-10 pb-20 animate-in text-left">
      {/* ── Page header ───────────────────────────────────────────────── */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
        <div className="space-y-4">
          <button
            onClick={() => router.push("/admin")}
            className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all font-bold text-[10px] uppercase tracking-wide"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
            {t("adminMisc.programs.backToDashboard")}
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Signal className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("adminMisc.programs.administration")}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
              {t("admin.programsList")}
            </h1>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push("/admin/standardization")}
            className="btn btn-secondary gap-2"
          >
            <Settings className="w-4 h-4" /> {t("navigation.settings")}
          </button>
          <button
            onClick={() => router.push("/admin/programs/new")}
            className="btn btn-primary gap-2"
          >
            <Plus className="w-4 h-4" /> {t("admin.newProgram")}
          </button>
        </div>
      </header>

      {/* ── Filters & search ──────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-secondary border border-[var(--border-primary)] rounded-xl p-1">
          {TABS(t).map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === tab.key
                  ? "bg-[var(--brand-orange)] text-black"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("admin.search")}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl py-3 pl-10 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
          />
        </div>
      </div>

      {/* ── Data table ────────────────────────────────────────────────── */}
      {loading ? (
        <TableSkeleton rows={10} />
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("adminMisc.programs.programDetails")}</th>
                <th>{t("adminMisc.programs.status")}</th>
                <th>{t("adminMisc.programs.programManager")}</th>
                <th>{t("adminMisc.programs.engagement")}</th>
                <th className="text-right">{t("adminMisc.programs.administration")}</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((program, index) => (
                <tr
                  key={program?.id || index}
                  className="group cursor-pointer hover:bg-secondary"
                  onClick={() =>
                    program?.id && router.push(`/admin/programs/${program.id}`)
                  }
                >
                  {/* Program details */}
                  <td>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-secondary border border-[var(--border-primary)] flex items-center justify-center text-[var(--brand-orange)]">
                        <Signal className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                          {program?.name || t("adminMisc.programs.unnamedMission")}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-0.5 line-clamp-1 max-w-xs">
                          {program?.description || t("adminMisc.programs.noDirective")}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td>
                    <ProgramStatusBadge status={program?.status} t={t} />
                  </td>

                  {/* PM */}
                  <td>
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-[var(--brand-orange)]" />
                      <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">
                        {program?.pm_name || t("admin.unassigned")}
                      </span>
                    </div>
                  </td>

                  {/* Engagement */}
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">
                          {program?.participants_count || 0}{" "}
                          {t("adminMisc.programs.members")}
                        </span>
                        <span className="text-[10px] font-bold text-[var(--brand-orange)] uppercase mt-0.5">
                          {Math.round(program?.completion_index || 0)}%
                          {t("adminMisc.programs.progress")}
                        </span>
                      </div>
                      <div className="w-16 h-1 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--brand-orange)]"
                          style={{ width: `${program?.completion_index || 0}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      {activeTab === "archived" ? (
                        <>
                          <button
                            onClick={(e) =>
                              onArchive(program?.id, false, e, program?.name)
                            }
                            title={t("adminMisc.programs.restore")}
                            className="p-2 hover:text-emerald-500"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) =>
                              onDelete(program?.id, e, program?.name)
                            }
                            title={t("adminMisc.programs.delete")}
                            className="p-2 hover:text-rose-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/programs/${program?.id}`);
                            }}
                            title={t("adminMisc.programs.launchExecutiveDashboard")}
                            className="p-2 hover:text-[var(--brand-orange)]"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const formatted = { ...program };
                              formatted.start_date = toDateInputValue(
                                program.start_date,
                              );
                              formatted.end_date = toDateInputValue(
                                program.end_date,
                              );
                              onEditProgram(formatted);
                            }}
                            title={t("admin.edit")}
                            className="p-2 hover:text-[var(--brand-orange)]"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/admin/programs/${program?.id}/teams`,
                              );
                            }}
                            title={t("adminMisc.programs.manageTeams")}
                            className="p-2 hover:text-[var(--brand-orange)]"
                          >
                            <Users className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) =>
                              onArchive(program?.id, true, e, program?.name)
                            }
                            title={t("adminMisc.programs.archive")}
                            className="p-2 hover:text-orange-500"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
