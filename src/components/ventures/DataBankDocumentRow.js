"use client";

import { useCallback, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  History,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";

/**
 * ONE upload in a Venture's Data bank (verification) document list, with the
 * whole set of actions a document carries:
 *
 *   view     — open the file (short-lived signed URL, minted by the read);
 *   download — save it under its own name;
 *   versions — the full history, from version 1 to the newest;
 *   delete   — remove it (and its history) after an in-app confirmation;
 *   new version — file a newer file for the SAME document (upload-capable
 *                 viewers only), so the history grows instead of piling up
 *                 look-alike rows.
 *
 * The delete/version calls live here so every screen that renders a document
 * (founder, Super Admin, Lead Manager) behaves identically; the parent only
 * re-reads through `onChanged`.
 */

// Documents are private: prefer the short-lived signed URL minted by the read,
// and fall back to the raw value only when it is an external link (pasted links
// carry no storage path and need no signature).
const documentHref = (documentEntry) => {
  if (documentEntry?.file_url_signed) return documentEntry.file_url_signed;
  const raw = String(documentEntry?.file_url || "").trim();
  return /^https?:\/\//i.test(raw) ? raw : null;
};

/** Save a (possibly cross-origin, signed) URL under a chosen file name. */
async function saveUrl(url, fileName) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("download failed");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName || "document";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export default function DataBankDocumentRow({ ventureId, doc, canUpload = false, onChanged }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();

  const [busy, setBusy] = useState(null); // "delete" | "upload" | null
  const [error, setError] = useState(null);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const href = documentHref(doc);

  const handleView = () => {
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleDownload = async () => {
    if (!href) return;
    await downloadHref(href, doc.file_name);
  };

  const downloadHref = async (url, fileName) => {
    try {
      await saveUrl(url, fileName);
    } catch (_) {
      // A refused cross-origin read still opens the file rather than doing nothing.
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const loadVersions = useCallback(async () => {
    setLoadingVersions(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/ventures/${ventureId}/verification/documents/${doc.id}/versions`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.error || t("venture.verificationTab.versionsLoadFailed"));
      setVersions(data.versions || []);
    } catch (caughtError) {
      setError(caughtError?.message || t("venture.verificationTab.versionsLoadFailed"));
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  }, [ventureId, doc.id, t]);

  const handleOpenVersions = () => {
    setShowVersions(true);
    loadVersions();
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      message: t("venture.verificationTab.deleteDocumentConfirm", { name: doc.file_name }),
      tone: "danger",
    });
    if (!confirmed) return;
    setBusy("delete");
    setError(null);
    try {
      const response = await fetch(`/api/ventures/${ventureId}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_document", document_id: doc.id }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || t("venture.manager.actionFailed"));
      onChanged?.();
    } catch (caughtError) {
      setError(caughtError?.message || t("venture.manager.actionFailed"));
    } finally {
      setBusy(null);
    }
  };

  const handleNewVersion = async (file) => {
    if (!file) return;
    setBusy("upload");
    setError(null);
    try {
      // The file goes to the same private bucket through the same Venture-gated
      // multipart route the first upload used; the path is then filed as the
      // document's next version.
      const form = new FormData();
      form.append("file", file);
      form.append("category", doc.category || "document");
      const uploadRes = await fetch(`/api/ventures/${ventureId}/verification/upload`, {
        method: "POST",
        body: form,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadData?.success || !uploadData?.path) {
        throw new Error(uploadData?.error || t("vadmin.verification.uploadFailed"));
      }

      const versionRes = await fetch(
        `/api/ventures/${ventureId}/verification/documents/${doc.id}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_url: uploadData.path,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
          }),
        },
      );
      const versionData = await versionRes.json().catch(() => ({}));
      if (!versionData.success) {
        throw new Error(versionData.error || t("vadmin.verification.uploadFailed"));
      }
      if (showVersions) await loadVersions();
      onChanged?.();
    } catch (caughtError) {
      setError(caughtError?.message || t("vadmin.verification.uploadFailed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-[var(--border-primary)] bg-surface-3 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={12} className="text-[var(--brand-orange)] shrink-0" />
            <span className="text-[10px] font-bold text-[var(--text-primary)] truncate">{doc.file_name}</span>
            {doc.file_size ? (
              <span className="text-[10px] text-[var(--text-secondary)] shrink-0">
                ({(doc.file_size / 1024).toFixed(0)} KB)
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {href && (
              <>
                <button
                  onClick={handleView}
                  title={t("common.view")}
                  className="p-1 text-[var(--brand-orange)] hover:bg-brand-orange/10 rounded"
                >
                  <Eye size={12} />
                </button>
                <button
                  onClick={handleDownload}
                  title={t("common.download")}
                  className="p-1 text-[var(--brand-orange)] hover:bg-brand-orange/10 rounded"
                >
                  <Download size={12} />
                </button>
              </>
            )}
            <button
              onClick={handleOpenVersions}
              title={t("venture.verificationTab.versionHistory")}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded"
            >
              <History size={12} />
            </button>
            {canUpload && (
              <label
                title={t("venture.verificationTab.uploadVersion")}
                className={`p-1 text-[var(--brand-orange)] hover:bg-brand-orange/10 rounded cursor-pointer ${busy === "upload" ? "opacity-40 pointer-events-none" : ""}`}
              >
                {busy === "upload" ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  className="hidden"
                  disabled={busy === "upload"}
                  onChange={(event) => {
                    if (event.target.files[0]) handleNewVersion(event.target.files[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            )}
            <button
              onClick={handleDelete}
              disabled={busy === "delete"}
              title={t("venture.verificationTab.deleteDocument")}
              className="p-1 text-rose-500 hover:bg-rose-500/10 rounded shrink-0 disabled:opacity-30"
            >
              {busy === "delete" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        </div>
        {error && <p className="text-[10px] text-rose-500 mt-1 break-words">{error}</p>}
      </div>

      {showVersions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowVersions(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                  <History size={13} className="text-[var(--brand-orange)]" />
                  {t("venture.verificationTab.versionHistory")}
                </h2>
                <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">{doc.file_name}</p>
              </div>
              <button
                onClick={() => setShowVersions(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--text-secondary)]"
              >
                <X size={16} />
              </button>
            </div>

            {loadingVersions ? (
              <div className="py-6 text-center">
                <Loader2 size={18} className="animate-spin mx-auto text-[var(--brand-orange)]" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-[11px] text-[var(--text-secondary)]">{t("venture.verificationTab.noVersions")}</p>
            ) : (
              <div className="space-y-2">
                {versions.map((version, index) => {
                  const versionHref = documentHref(version);
                  const isCurrent = index === versions.length - 1;
                  return (
                    <div
                      key={version.id || version.version_number}
                      className="rounded-xl border border-[var(--border-primary)] bg-surface-2 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-primary)]">
                            {t("venture.verificationTab.version", { n: version.version_number })}
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                              {t("venture.verificationTab.versionCurrent")}
                            </span>
                          )}
                        </div>
                        {versionHref && (
                          <button
                            onClick={() => downloadHref(versionHref, version.file_name)}
                            title={t("common.download")}
                            className="p-1 text-[var(--brand-orange)] hover:bg-brand-orange/10 rounded shrink-0"
                          >
                            <Download size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">{version.file_name}</p>
                      {version.version_notes && (
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 break-words">{version.version_notes}</p>
                      )}
                      <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">
                        {version.uploaded_at ? new Date(version.uploaded_at).toLocaleString() : ""}
                        {version.uploaded_by ? ` · ${version.uploaded_by}` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
