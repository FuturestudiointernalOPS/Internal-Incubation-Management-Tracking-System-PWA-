"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  Share2,
  Sparkles,
  BarChart3,
  Layers,
  FolderLock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import { DATA_ROOM_CATEGORIES, dataRoomCategory, isLegacyDocumentCategory } from "@/lib/dataRoom";
import DataRoomDocumentCard from "./DataRoomDocumentCard";
import DataRoomUploadModal from "./DataRoomUploadModal";
import DataRoomReviewModal from "./DataRoomReviewModal";
import DataRoomPreviewModal from "./DataRoomPreviewModal";
import DataRoomSessionModal from "./DataRoomSessionModal";
import DataRoomAccessModal from "./DataRoomAccessModal";
import DataRoomVersionsModal from "./DataRoomVersionsModal";
import DataRoomShareModal from "./DataRoomShareModal";
import DataRoomActivity from "./DataRoomActivity";
import { downloadDocument, inlineDocumentUrl, STATUS_ORDER } from "./dataRoomUi";

const pickDataRoom = (payload) => (payload?.success ? payload : null);

/** A catalogue lens, not a category: rows filed before the Data Room existed. */
const LEGACY_FILTER = "__legacy__";

const DUE_DILIGENCE_FOLDERS = [
  {
    key: "pitch",
    title: "Pitch & Strategy",
    icon: Sparkles,
    categories: ["pitch_deck", "company_overview", "market_traction"],
    description: "Pitch decks, 1-pagers, market research",
  },
  {
    key: "financials",
    title: "Financials & Model",
    icon: BarChart3,
    categories: ["financials_projections", "fundraising_cap_table"],
    description: "Projections, cap table, runway",
  },
  {
    key: "legal",
    title: "Legal & Corporate",
    icon: ShieldCheck,
    categories: ["legal_corporate", "due_diligence"],
    description: "Incorporation, agreements, compliance",
  },
  {
    key: "product",
    title: "Product & Impact",
    icon: Layers,
    categories: ["product_technology", "team", "impact_sustainability", "reports_milestones"],
    description: "Architecture, team bios, progress reports",
  },
];

export default function VentureDataRoom({ ventureId, className = "" }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const { data, loading, error, status, refresh } = useApi(
    ventureId ? `/api/ventures/${ventureId}/data-room` : null,
    { defaultValue: null, transform: pickDataRoom, deps: [ventureId] },
  );

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [documentStatus, setDocumentStatus] = useState("all");
  const [uploadState, setUploadState] = useState(null);
  const [inlineRun, setInlineRun] = useState(0);
  const [reviewDoc, setReviewDoc] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [sessionDoc, setSessionDoc] = useState(null);
  const [accessDoc, setAccessDoc] = useState(null);
  const [versionsDoc, setVersionsDoc] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const documents = useMemo(() => data?.documents || [], [data]);
  const viewer = data?.viewer || {
    can_manage: false,
    can_review: false,
    can_configure_requirements: false,
    type: "member",
  };
  const requirements = data?.requirements || [];
  const grants = data?.grants || [];
  const history = data?.history || [];
  const accessHistory = data?.access_history || [];
  const isInvestor = viewer.type === "investor";
  const canUpload = viewer.can_manage && viewer.type !== "super_admin" && !isInvestor;

  const categories = useMemo(() => {
    if (data?.categories?.length) return data.categories;
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

  const legacyCount = useMemo(
    () => documents.filter((entry) => isLegacyDocumentCategory(entry.category)).length,
    [documents],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return documents.filter((entry) => {
      if (selectedFolder) {
        const folder = DUE_DILIGENCE_FOLDERS.find((f) => f.key === selectedFolder);
        if (folder && !folder.categories.includes(entry.category)) return false;
      }
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
  }, [documents, category, selectedFolder, documentStatus, search]);

  const selectedCategory =
    canUpload && category !== "all" && category !== LEGACY_FILTER && dataRoomCategory(category) ? category : null;
  const inlineCategory =
    selectedCategory && !documents.some((entry) => entry.category === selectedCategory) ? selectedCategory : null;

  const recordAccess = (documentEntry, accessType) =>
    fetch(`/api/ventures/${ventureId}/data-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record_access",
        document_id: documentEntry.id,
        access_type: accessType,
      }),
    }).catch(() => {});

  const openDocument = (documentEntry) => {
    if (!documentEntry.file_url_signed) return;
    void recordAccess(documentEntry, "view");
    window.open(inlineDocumentUrl(ventureId, documentEntry), "_blank", "noopener,noreferrer");
  };

  const download = async (documentEntry) => {
    await recordAccess(documentEntry, "download");
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
    <div className={`space-y-6 ${className}`}>
      {/* ── Header Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-[var(--text-primary)] flex items-center gap-2">
            <ShieldCheck size={18} className="text-[var(--brand-orange)]" /> {t("dataRoom.title")}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {isInvestor ? t("dataRoom.investorSubtitle") : t("dataRoom.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canUpload && (
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-primary)] bg-surface-2 hover:bg-surface-3 text-[var(--text-primary)] text-xs font-bold transition-all shadow-sm"
            >
              <Share2 size={14} className="text-[var(--brand-orange)]" />
              <span>Share with Investor</span>
            </button>
          )}

          {canUpload && (
            <button
              type="button"
              onClick={() => setUploadState({ mode: "create", category: selectedCategory || undefined })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-xs font-extrabold transition-all shadow-sm hover:opacity-90"
            >
              <Upload size={14} />
              <span>{t("dataRoom.upload")}</span>
            </button>
          )}
        </div>
      </div>

      {isInvestor ? (
        <p className="rounded-xl border border-blue-500/25 bg-blue-500/5 px-4 py-2.5 text-xs text-blue-400">
          {t("dataRoom.readOnlyInvestor")}
        </p>
      ) : null}

      {/* ── 4 Institutional Due Diligence Folders ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {DUE_DILIGENCE_FOLDERS.map((folder) => {
          const Icon = folder.icon;
          const folderDocsCount = documents.filter((d) => folder.categories.includes(d.category)).length;
          const isSelected = selectedFolder === folder.key;

          return (
            <button
              key={folder.key}
              type="button"
              onClick={() => {
                if (isSelected) {
                  setSelectedFolder(null);
                } else {
                  setSelectedFolder(folder.key);
                  setCategory("all");
                }
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                isSelected
                  ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/10 shadow-sm"
                  : "border-[var(--border-primary)] bg-surface-2 hover:border-[var(--border-primary)]/80"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div
                  className={`p-2 rounded-xl ${
                    isSelected
                      ? "bg-[var(--brand-orange)] text-black"
                      : "bg-surface-3 text-[var(--brand-orange)]"
                  }`}
                >
                  <Icon size={16} />
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-3 text-[var(--text-secondary)]">
                  {folderDocsCount} {folderDocsCount === 1 ? "file" : "files"}
                </span>
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[var(--text-primary)]">
                  {folder.title}
                </h4>
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                  {folder.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Main Data Room Explorer ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-6 items-start">
        {/* Categories Sidebar */}
        {!isInvestor ? (
          <div className="space-y-1 p-2 rounded-2xl border border-[var(--border-primary)] bg-surface-1">
            <CategoryRow
              active={category === "all" && !selectedFolder}
              label={t("dataRoom.allCategories")}
              count={documents.length}
              onClick={() => {
                setCategory("all");
                setSelectedFolder(null);
              }}
            />
            {categories.map((entry) => (
              <CategoryRow
                key={entry.code}
                active={category === entry.code}
                label={t(entry.labelKey)}
                count={entry.count}
                level={entry.level}
                onClick={() => {
                  setCategory(entry.code);
                  setSelectedFolder(null);
                }}
              />
            ))}
            {legacyCount > 0 ? (
              <CategoryRow
                active={category === LEGACY_FILTER}
                label={t("dataRoom.legacy.filter")}
                count={legacyCount}
                onClick={() => {
                  setCategory(LEGACY_FILTER);
                  setSelectedFolder(null);
                }}
              />
            ) : null}
          </div>
        ) : null}

        {/* Documents Main Area */}
        <div className="space-y-4">
          {inlineCategory ? (
            <DataRoomUploadModal
              key={`${inlineCategory}-${inlineRun}`}
              inline
              mode="create"
              defaultCategory={inlineCategory}
              ventureId={ventureId}
              maxFileMb={data.max_file_mb}
              t={t}
              onDone={() => {
                setInlineRun((value) => value + 1);
                refresh();
              }}
            />
          ) : null}

          {/* Search & Status Filter */}
          <div className="flex flex-wrap gap-2.5">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("dataRoom.searchPlaceholder")}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[var(--border-primary)] bg-surface-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
              />
            </div>
            <select
              value={documentStatus}
              onChange={(event) => setDocumentStatus(event.target.value)}
              className="px-3 py-2.5 rounded-xl border border-[var(--border-primary)] bg-surface-2 text-xs text-[var(--text-primary)] outline-none"
            >
              <option value="all">{t("dataRoom.allStatuses")}</option>
              {STATUS_ORDER.map((entry) => (
                <option key={entry} value={entry}>{t(`dataRoom.status.${entry}`)}</option>
              ))}
            </select>
          </div>

          {/* Document Cards */}
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-10 text-center space-y-2">
              <FolderLock size={28} className="mx-auto text-[var(--text-secondary)]" />
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {documents.length === 0
                  ? canUpload
                    ? t("dataRoom.emptyRoom")
                    : isInvestor
                      ? t("dataRoom.emptyRoomInvestor")
                      : t("dataRoom.emptyRoomAwaitingUpload")
                  : search.trim() || documentStatus !== "all" || category === "all"
                    ? t("dataRoom.noMatch")
                    : t("dataRoom.noDocuments")}
              </p>
              {documents.length === 0 && canUpload && !inlineCategory ? (
                <button
                  type="button"
                  onClick={() => setUploadState({ mode: "create" })}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--brand-orange)] text-black text-xs font-extrabold uppercase tracking-wide"
                >
                  <Upload size={14} /> {t("dataRoom.upload")}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((entry) => (
                <DataRoomDocumentCard
                  key={entry.id}
                  documentEntry={entry}
                  t={t}
                  canManage={viewer.can_manage}
                  canReview={viewer.can_review}
                  onOpen={(documentEntry, mode) => {
                    if (mode === "download") return download(documentEntry);
                    if (mode === "preview") {
                      void recordAccess(documentEntry, "view");
                      return setPreviewDoc(documentEntry);
                    }
                    return openDocument(documentEntry);
                  }}
                  onVersions={setVersionsDoc}
                  onReplace={(documentEntry) => setUploadState({ mode: "replace", document: documentEntry })}
                  onEdit={(documentEntry) => setUploadState({ mode: "edit", document: documentEntry })}
                  onReview={setReviewDoc}
                  onSession={setSessionDoc}
                  onAccess={setAccessDoc}
                  onDelete={removeDocument}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Due Diligence Requirements */}
      {(viewer.can_review || viewer.can_configure_requirements) && requirements.length > 0 ? (
        <RequirementsPanel
          requirements={requirements}
          canReview={viewer.can_configure_requirements}
          canManage={viewer.can_manage}
          t={t}
          onChange={setRequirement}
        />
      ) : null}

      {!isInvestor ? <DataRoomActivity kind="history" events={history} /> : null}
      {!isInvestor ? <DataRoomActivity kind="access" events={accessHistory} /> : null}

      {/* ── Dialog Modals ── */}
      {uploadState ? (
        <DataRoomUploadModal
          mode={uploadState.mode}
          documentEntry={uploadState.document}
          defaultCategory={uploadState.category}
          ventureId={ventureId}
          maxFileMb={data.max_file_mb}
          t={t}
          onClose={() => setUploadState(null)}
          onDone={refresh}
        />
      ) : null}

      {previewDoc ? (
        <DataRoomPreviewModal
          documentEntry={previewDoc}
          ventureId={ventureId}
          t={t}
          canReview={viewer.can_review}
          onClose={() => setPreviewDoc(null)}
          onDone={refresh}
        />
      ) : null}

      {sessionDoc ? (
        <DataRoomSessionModal
          documentEntry={sessionDoc}
          ventureId={ventureId}
          t={t}
          onClose={() => setSessionDoc(null)}
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

      {/* ── External Investor Share Modal ── */}
      <DataRoomShareModal
        ventureId={ventureId}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </div>
  );
}

function CategoryRow({ active, label, count, level, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
        active
          ? "border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] font-bold"
          : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]"
      }`}
    >
      <span className="text-xs truncate">{label}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        {level === "required" ? <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)]" title="required" /> : null}
        <span className="text-[11px] tabular-nums font-semibold">{count}</span>
      </span>
    </button>
  );
}

function RequirementsPanel({ requirements, canReview, canManage, t, onChange }) {
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-5 space-y-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)]">
          {t("dataRoom.requirements.title")}
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
          {t("dataRoom.requirements.description")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {requirements.map((row) => {
          const entry = dataRoomCategory(row.category);
          if (!entry) return null;
          return (
            <div key={row.category} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--surface-1)] border border-[var(--border-primary)]">
              <span className="text-xs text-[var(--text-primary)] truncate font-medium">
                {t(entry.labelKey)}
                {row.customized ? <span className="text-[10px] text-[var(--text-secondary)]"> · {t("dataRoom.requirements.customized")}</span> : null}
              </span>
              {canReview ? (
                <select
                  value={row.level}
                  onChange={(event) => onChange(row.category, event.target.value)}
                  className="text-xs bg-transparent border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[var(--text-secondary)] outline-none"
                >
                  {["required", "recommended", "conditional", "not_applicable"].map((level) => (
                    <option key={level} value={level}>{t(`dataRoom.level.${level}`)}</option>
                  ))}
                </select>
              ) : (
                <span className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                  {t(`dataRoom.level.${row.level}`)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {canReview ? (
        <p className="text-[11px] text-[var(--text-secondary)]">
          {canManage
            ? t("dataRoom.requirements.editableHint")
            : t("dataRoom.requirements.leadManagerHint")}
        </p>
      ) : null}
    </div>
  );
}
