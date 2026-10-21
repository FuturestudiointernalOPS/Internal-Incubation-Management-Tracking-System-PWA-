"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FileText, Loader2, RefreshCw, Search, ShieldCheck, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import { DATA_ROOM_CATEGORIES, dataRoomCategory, isLegacyDocumentCategory } from "@/lib/dataRoom";
import DataRoomDocumentCard from "./DataRoomDocumentCard";
import DataRoomUploadModal from "./DataRoomUploadModal";
import DataRoomReviewModal from "./DataRoomReviewModal";
import DataRoomAccessModal from "./DataRoomAccessModal";
import DataRoomVersionsModal from "./DataRoomVersionsModal";
import { downloadDocument, STATUS_ORDER } from "./dataRoomUi";

const pickDataRoom = (payload) => (payload?.success ? payload : null);

/** A catalogue lens, not a category: rows filed before the Data Room existed. */
const LEGACY_FILTER = "__legacy__";

/**
 * VENTURE DATA ROOM — the venture's confidential document set.
 *
 * One screen, used by every role that may see it (founder, member, assigned
 * staff, reviewer, granted investor). It does not decide what a person may do:
 * the API returns a `viewer` block, and the screen only renders the buttons
 * that block allows. A hand-typed request without the matching permission is
 * refused by the service, not hidden by the UI.
 */
export default function VentureDataRoom({ ventureId, className = "" }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const { data, loading, error, status, refresh } = useApi(
    ventureId ? `/api/ventures/${ventureId}/data-room` : null,
    { defaultValue: null, transform: pickDataRoom, deps: [ventureId] },
  );

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [documentStatus, setDocumentStatus] = useState("all");
  const [uploadState, setUploadState] = useState(null);
  const [reviewDoc, setReviewDoc] = useState(null);
  const [accessDoc, setAccessDoc] = useState(null);
  const [versionsDoc, setVersionsDoc] = useState(null);

  const documents = useMemo(() => data?.documents || [], [data]);
  const viewer = data?.viewer || { can_manage: false, can_review: false, type: "member" };
  const completeness = data?.completeness || null;
  const requirements = data?.requirements || [];
  const grants = data?.grants || [];
  const history = data?.history || [];
  const isInvestor = viewer.type === "investor";

  const categories = useMemo(() => {
    if (data?.categories?.length) return data.categories;
    // An investor has no requirement list: show only the categories they can
    // actually see, never the empty structure of the whole room.
    if (isInvestor) {
      const seen = new Set(documents.map((entry) => entry.category));
      return DATA_ROOM_CATEGORIES.filter((entry) => seen.has(entry.code)).map((entry) => ({
        code: entry.code,
        labelKey: entry.labelKey,
        count: documents.filter((documentEntry) => documentEntry.category === entry.code).length,
        level: "conditional",
      }));
    }
    return [];
  }, [data, documents, isInvestor]);

  // Legacy documents are kept and shown, but they are not a Data Room category.
  // This count and lens make them findable so they can be re-filed.
  const legacyCount = useMemo(
    () => documents.filter((entry) => isLegacyDocumentCategory(entry.category)).length,
    [documents],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return documents.filter((entry) => {
      if (category === LEGACY_FILTER) {
        if (!isLegacyDocumentCategory(entry.category)) return false;
      } else if (category !== "all" && entry.category !== category) {
        return false;
      }
      if (documentStatus !== "all" && entry.status !== documentStatus) return false;
      if (!needle) return true;
      return [entry.title, entry.name, entry.description, entry.file_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [documents, category, documentStatus, search]);

  const missingLabels = (completeness?.missing_required || [])
    .map((code) => dataRoomCategory(code))
    .filter(Boolean)
    .map((entry) => t(entry.labelKey));

  const openDocument = async (documentEntry) => {
    if (documentEntry.file_url_signed) {
      window.open(documentEntry.file_url_signed, "_blank", "noopener,noreferrer");
    }
  };

  const download = async (documentEntry) => {
    await downloadDocument(documentEntry);
  };

  const removeDocument = async (documentEntry) => {
    if (!(await confirm({ message: t("dataRoom.deleteConfirm", { title: documentEntry.title }), tone: "danger" }))) {
      return;
    }
    await fetch(`/api/ventures/${ventureId}/data-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", document_id: documentEntry.id }),
    });
    refresh();
  };

  const setRequirement = async (categoryCode, level) => {
    await fetch(`/api/ventures/${ventureId}/data-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_requirement", category: categoryCode, level }),
    });
    refresh();
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="animate-spin mx-auto text-[var(--brand-orange)]" size={22} />
        <p className="text-[10px] text-[var(--text-secondary)] mt-2">{t("dataRoom.loading")}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-6 text-center space-y-3 ${className}`}>
        <AlertTriangle size={22} className="mx-auto text-rose-400" />
        <p className="text-[11px] text-[var(--text-secondary)] break-words">
          {status === 404 ? t("errors.notFound") : error || t("dataRoom.errors.loadFailed")}
        </p>
        <button
          type="button"
          onClick={() => refresh()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]"
        >
          <RefreshCw size={12} /> {t("dataRoom.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-black text-[var(--text-primary)] flex items-center gap-2">
            <ShieldCheck size={15} className="text-[var(--brand-orange)]" /> {t("dataRoom.title")}
          </h2>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
            {isInvestor ? t("dataRoom.investorSubtitle") : t("dataRoom.subtitle")}
          </p>
        </div>
        {viewer.can_manage ? (
          <button
            type="button"
            onClick={() => setUploadState({ mode: "create" })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest"
          >
            <Upload size={13} /> {t("dataRoom.upload")}
          </button>
        ) : null}
      </div>

      {isInvestor ? (
        <p className="rounded-xl border border-blue-500/25 bg-blue-500/5 px-3 py-2 text-[10px] text-blue-400">
          {t("dataRoom.readOnlyInvestor")}
        </p>
      ) : null}

      {completeness && !isInvestor ? (
        <div className="rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              {t("dataRoom.completeness.title")}
            </p>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${completeness.is_ready ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
              {completeness.readiness_percent === null
                ? t("dataRoom.completeness.notRequired")
                : completeness.is_ready
                  ? t("dataRoom.completeness.ready")
                  : t("dataRoom.completeness.notReady")}
            </span>
          </div>
          {completeness.readiness_percent !== null ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--brand-orange)] transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, completeness.readiness_percent))}%` }}
                />
              </div>
              <span className="text-[11px] font-black text-[var(--text-primary)]">
                {t("dataRoom.completeness.percent", { percent: completeness.readiness_percent })}
              </span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3 text-[9px] uppercase tracking-wide text-[var(--text-secondary)]">
            <span>{t("dataRoom.completeness.verified")}: <strong className="text-[var(--text-primary)]">{completeness.verified_documents}</strong></span>
            <span>{t("dataRoom.completeness.awaitingReview")}: <strong className="text-[var(--text-primary)]">{completeness.awaiting_review}</strong></span>
            <span>{t("dataRoom.completeness.rejected")}: <strong className="text-[var(--text-primary)]">{completeness.rejected_documents}</strong></span>
            <span>{t("dataRoom.completeness.expired")}: <strong className="text-[var(--text-primary)]">{completeness.expired_documents}</strong></span>
            <span>{t("dataRoom.completeness.missing")}: <strong className="text-[var(--text-primary)]">{completeness.missing_required.length}</strong></span>
          </div>
          {missingLabels.length > 0 ? (
            <p className="text-[10px] text-amber-400 break-words">
              {t("dataRoom.completeness.missingList", { categories: missingLabels.join(", ") })}
            </p>
          ) : null}
          <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed">{t("dataRoom.completeness.note")}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        {!isInvestor ? (
          <div className="space-y-1">
            <CategoryRow
              active={category === "all"}
              label={t("dataRoom.allCategories")}
              count={documents.length}
              onClick={() => setCategory("all")}
            />
            {categories.map((entry) => (
              <CategoryRow
                key={entry.code}
                active={category === entry.code}
                label={t(entry.labelKey)}
                count={entry.count}
                level={entry.level}
                onClick={() => setCategory(entry.code)}
              />
            ))}
            {legacyCount > 0 ? (
              <CategoryRow
                active={category === LEGACY_FILTER}
                label={t("dataRoom.legacy.filter")}
                count={legacyCount}
                onClick={() => setCategory(LEGACY_FILTER)}
              />
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("dataRoom.searchPlaceholder")}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[10px] text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
              />
            </div>
            <select
              value={documentStatus}
              onChange={(event) => setDocumentStatus(event.target.value)}
              className="px-3 py-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[10px] text-[var(--text-primary)] outline-none"
            >
              <option value="all">{t("dataRoom.allStatuses")}</option>
              {STATUS_ORDER.map((entry) => (
                <option key={entry} value={entry}>{t(`dataRoom.status.${entry}`)}</option>
              ))}
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-6 text-center space-y-1">
              <FileText size={20} className="mx-auto text-[var(--text-secondary)]" />
              <p className="text-[11px] text-[var(--text-secondary)]">{t("dataRoom.noDocuments")}</p>
              {category === LEGACY_FILTER ? (
                <p className="text-[9px] text-[var(--text-secondary)]">{t("dataRoom.legacy.filterHint")}</p>
              ) : category !== "all" && !isInvestor ? (
                <p className="text-[9px] text-[var(--text-secondary)]">{t("dataRoom.emptyCategory")}</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((entry) => (
                <DataRoomDocumentCard
                  key={entry.id}
                  documentEntry={entry}
                  t={t}
                  canManage={viewer.can_manage}
                  canReview={viewer.can_review}
                  onOpen={(documentEntry, mode) => (mode === "download" ? download(documentEntry) : openDocument(documentEntry))}
                  onVersions={setVersionsDoc}
                  onReplace={(documentEntry) => setUploadState({ mode: "replace", document: documentEntry })}
                  onEdit={(documentEntry) => setUploadState({ mode: "edit", document: documentEntry })}
                  onReview={setReviewDoc}
                  onAccess={setAccessDoc}
                  onDelete={removeDocument}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {viewer.can_review && requirements.length > 0 ? (
        <RequirementsPanel
          requirements={requirements}
          canReview={viewer.can_review}
          t={t}
          onChange={setRequirement}
        />
      ) : null}

      {!isInvestor && history.length > 0 ? (
        <div className="rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("dataRoom.history.title")}
          </p>
          {history.slice(0, 12).map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-[var(--text-primary)]">
                {t(`dataRoom.history.actions.${event.action}`)}
                {event.details?.category ? ` · ${dataRoomCategory(event.details.category) ? t(dataRoomCategory(event.details.category).labelKey) : event.details.category}` : ""}
              </span>
              <span className="text-[var(--text-secondary)] shrink-0">
                {event.actor_name || event.actor_cid} · {new Date(event.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {uploadState ? (
        <DataRoomUploadModal
          mode={uploadState.mode}
          documentEntry={uploadState.document}
          ventureId={ventureId}
          maxFileMb={data.max_file_mb}
          t={t}
          onClose={() => setUploadState(null)}
          onDone={refresh}
        />
      ) : null}

      {reviewDoc ? (
        <DataRoomReviewModal
          documentEntry={reviewDoc}
          ventureId={ventureId}
          t={t}
          onClose={() => setReviewDoc(null)}
          onDone={refresh}
        />
      ) : null}

      {accessDoc ? (
        <DataRoomAccessModal
          documentEntry={accessDoc}
          grants={grants}
          ventureId={ventureId}
          t={t}
          onClose={() => setAccessDoc(null)}
          onDone={refresh}
        />
      ) : null}

      {versionsDoc ? (
        <DataRoomVersionsModal
          documentEntry={versionsDoc}
          ventureId={ventureId}
          t={t}
          onClose={() => setVersionsDoc(null)}
        />
      ) : null}
    </div>
  );
}

function CategoryRow({ active, label, count, level, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
        active
          ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
          : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
      }`}
    >
      <span className="text-[10px] font-bold truncate">{label}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        {level === "required" ? <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)]" title="required" /> : null}
        <span className="text-[9px] tabular-nums">{count}</span>
      </span>
    </button>
  );
}

function RequirementsPanel({ requirements, canReview, t, onChange }) {
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-4 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
        {t("dataRoom.requirements.title")}
      </p>
      <p className="text-[9px] text-[var(--text-secondary)] leading-relaxed">{t("dataRoom.requirements.description")}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {requirements.map((row) => {
          const entry = dataRoomCategory(row.category);
          if (!entry) return null;
          return (
            <div key={row.category} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-[var(--surface-1)]">
              <span className="text-[10px] text-[var(--text-primary)] truncate">
                {t(entry.labelKey)}
                {row.customized ? <span className="text-[9px] text-[var(--text-secondary)]"> · {t("dataRoom.requirements.customized")}</span> : null}
              </span>
              {canReview ? (
                <select
                  value={row.level}
                  onChange={(event) => onChange(row.category, event.target.value)}
                  className="text-[9px] bg-transparent border border-[var(--border-primary)] rounded px-1 py-0.5 text-[var(--text-secondary)] outline-none"
                >
                  {["required", "recommended", "conditional", "not_applicable"].map((level) => (
                    <option key={level} value={level}>{t(`dataRoom.level.${level}`)}</option>
                  ))}
                </select>
              ) : (
                <span className="text-[9px] font-bold uppercase text-[var(--text-secondary)]">
                  {t(`dataRoom.level.${row.level}`)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {canReview ? (
        <p className="text-[9px] text-[var(--text-secondary)]">{t("dataRoom.requirements.editableHint")}</p>
      ) : null}
    </div>
  );
}
