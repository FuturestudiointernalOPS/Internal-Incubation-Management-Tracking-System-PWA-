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
  FolderOpen,
  FolderLock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import { dataRoomCategory, isLegacyDocumentCategory } from "@/lib/dataRoom";
import SectionHead from "@/components/ui/SectionHead";
import DataRoomDocumentTable from "./DataRoomDocumentTable";
import DataRoomUploadModal from "./DataRoomUploadModal";
import DataRoomReviewModal from "./DataRoomReviewModal";
import DataRoomPreviewModal from "./DataRoomPreviewModal";
import DataRoomSessionModal from "./DataRoomSessionModal";
import DataRoomAccessModal from "./DataRoomAccessModal";
import DataRoomVersionsModal from "./DataRoomVersionsModal";
import DataRoomShareModal from "./DataRoomShareModal";
import DataRoomActivity from "./DataRoomActivity";
import DataRoomCoverage from "./DataRoomCoverage";
import DataRoomCategoryDetailModal from "./DataRoomCategoryDetailModal";
import { downloadDocument, inlineDocumentUrl, STATUS_ORDER } from "./dataRoomUi";

const pickDataRoom = (payload) => (payload?.success ? payload : null);

/** A catalogue lens, not a category: rows filed before the Data Room existed. */
const LEGACY_FILTER = "__legacy__";

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
  const [inlineRun, setInlineRun] = useState(0);
  const [reviewDoc, setReviewDoc] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [sessionDoc, setSessionDoc] = useState(null);
  const [accessDoc, setAccessDoc] = useState(null);
  const [versionsDoc, setVersionsDoc] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [categoryDetailCode, setCategoryDetailCode] = useState(null);

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

  // The coverage table is the navigation: clicking a requirement row filters the
  // list below to that category.

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

          {/* The header "Upload document" button was removed on purpose: files
              are filed per CATEGORY (click a coverage row, or the empty room),
              so an upload always lands in a folder with a requirement behind it
              instead of in an unclassified pile. */}
        </div>
      </div>

      {isInvestor ? (
        <p className="rounded-xl border border-blue-500/25 bg-blue-500/5 px-4 py-2.5 text-xs text-blue-400">
          {t("dataRoom.readOnlyInvestor")}
        </p>
      ) : null}

      {/* ── What we ask for · what has been submitted · what is left ── */}
      {!isInvestor && (
        <DataRoomCoverage
          completeness={data?.completeness || null}
          requirements={requirements}
          canReview={viewer.can_configure_requirements}
          onChange={setRequirement}
          onSelectCategory={(code) => setCategoryDetailCode(code)}
          selectedCategory={category}
        />
      )}

      {/* ── Documents: the coverage table above chooses the category. ── */}
      <div className="space-y-4">
        <SectionHead
          icon={FolderOpen}
          title={
            category === "all"
              ? t("dataRoom.standard.documents")
              : category === LEGACY_FILTER
                ? t("dataRoom.legacy.filter")
                : (() => {
                    const entry = dataRoomCategory(category);
                    return entry ? t(entry.labelKey) : category;
                  })()
          }
          action={
            category !== "all" ? (
              <button type="button" className="stf-btn sm" onClick={() => setCategory("all")}>
                {t("dataRoom.allDocuments")}
              </button>
            ) : null
          }
        />

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
            <DataRoomDocumentTable
              documents={visible}
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
          )}
        </div>
      </div>

      {/* Due Diligence Requirements */}
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

            {/* ── Category Detail Popup Modal ── */}
      <DataRoomCategoryDetailModal
        isOpen={Boolean(categoryDetailCode)}
        categoryCode={categoryDetailCode}
        requirement={requirements.find((r) => r.category === categoryDetailCode)}
        documents={documents}
        canManage={viewer.can_manage}
        canReview={viewer.can_review}
        isInvestor={isInvestor}
        onClose={() => setCategoryDetailCode(null)}
        onOpenDoc={(doc, mode) => {
          if (mode === "download") return download(doc);
          if (mode === "preview") {
            void recordAccess(doc, "view");
            return setPreviewDoc(doc);
          }
          return openDocument(doc);
        }}
        onUploadNew={(cat) => {
          setCategoryDetailCode(null);
          setUploadState({ mode: "create", category: cat });
        }}
        onVersions={(doc) => {
          setCategoryDetailCode(null);
          setVersionsDoc(doc);
        }}
        onReplace={(doc) => {
          setCategoryDetailCode(null);
          setUploadState({ mode: "replace", document: doc });
        }}
        onEdit={(doc) => {
          setCategoryDetailCode(null);
          setUploadState({ mode: "edit", document: doc });
        }}
        onReview={(doc) => {
          setCategoryDetailCode(null);
          setReviewDoc(doc);
        }}
        onSession={(doc) => {
          setCategoryDetailCode(null);
          setSessionDoc(doc);
        }}
        onAccess={(doc) => {
          setCategoryDetailCode(null);
          setAccessDoc(doc);
        }}
        onDelete={async (doc) => {
          await removeDocument(doc);
        }}
        t={t}
      />

      {/* ── External Investor Share Modal ── */}
      <DataRoomShareModal
        ventureId={ventureId}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </div>
  );
}
