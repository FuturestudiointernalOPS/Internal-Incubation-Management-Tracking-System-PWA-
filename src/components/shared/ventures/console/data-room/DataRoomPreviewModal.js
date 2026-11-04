"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, X, XCircle } from "lucide-react";
import { Overlay } from "./DataRoomUploadModal";
import { STATUS_CLASS, documentTitle, inlineDocumentUrl } from "./dataRoomUi";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
const FRAME_EXTENSIONS = ["pdf", "txt", "csv", "md"];

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const PAGE_STYLE =
  "<style>body{font-family:system-ui,sans-serif;font-size:13px;color:#222;padding:16px;line-height:1.5}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px;vertical-align:top}img{max-width:100%}</style>";

/**
 * How this file can be shown: "image" and "frame" by the browser itself,
 * "docx" and "xlsx" rendered here into a script-free page, or null when nothing
 * can show it (e.g. a slide deck).
 */
export function previewKind(documentEntry) {
  const name = String(documentEntry?.file_name || "").toLowerCase();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  const type = String(documentEntry?.file_type || "").toLowerCase();
  if (extension === "docx") return "docx";
  if (extension === "xlsx") return "xlsx";
  if (type.startsWith("image/") || IMAGE_EXTENSIONS.includes(extension)) return "image";
  if (type === "application/pdf" || type.startsWith("text/") || FRAME_EXTENSIONS.includes(extension)) return "frame";
  return null;
}

/** Read the file's bytes and turn Word / Excel into a static HTML page. */
async function renderOfficeHtml(kind, url) {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}download=1`);
  if (!response.ok) throw new Error("read failed");
  if (kind === "docx") {
    const mammoth = (await import("mammoth/mammoth.browser")).default;
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await response.arrayBuffer() });
    return `${PAGE_STYLE}${value}`;
  }
  const { readSheet } = await import("read-excel-file/browser");
  const grid = await readSheet(await response.blob(), 1, { trim: false });
  const rows = (grid || []).map(
    (row) => `<tr>${(row || []).map((cell) => `<td>${escapeHtml(cell instanceof Date ? cell.toLocaleDateString() : cell)}</td>`).join("")}</tr>`,
  );
  return `${PAGE_STYLE}<table>${rows.join("")}</table>`;
}

/**
 * Preview one document in place, with the reviewer's approve / do-not-approve
 * decision beside it. Approving files the document as `verified`; a rejection
 * must carry a reason — the same rule and the same endpoint as the review dialog.
 */
export default function DataRoomPreviewModal({ documentEntry, ventureId, t, canReview, onClose, onDone }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const kind = previewKind(documentEntry);
  const url = documentEntry?.file_url_signed ? inlineDocumentUrl(ventureId, documentEntry) : null;
  const status = documentEntry?.status || "uploaded";
  const decided =
    (status === "verified" || status === "rejected") &&
    Number(documentEntry?.reviewed_version || 0) === Number(documentEntry?.current_version || 1);
  const [office, setOffice] = useState({ html: null, failed: false });

  useEffect(() => {
    if (!url || (kind !== "docx" && kind !== "xlsx")) return undefined;
    let live = true;
    renderOfficeHtml(kind, url)
      .then((html) => live && setOffice({ html, failed: false }))
      .catch(() => live && setOffice({ html: null, failed: true }));
    return () => { live = false; };
  }, [kind, url]);

  const decide = async (decision) => {
    if (decision === "rejected" && !reason.trim()) {
      setError(t("dataRoom.reviewModal.rejectionRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/ventures/${ventureId}/data-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          document_id: documentEntry.id,
          decision,
          notes: decision === "rejected" ? reason.trim() : null,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(String(data.error || "").startsWith("dataRoom.") ? t(data.error) : data.error);
      onDone?.();
      onClose?.();
    } catch (caught) {
      setError(caught?.message || t("dataRoom.errors.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose} label={t("dataRoom.preview.title")}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-[var(--text-primary)] break-words">{documentTitle(documentEntry)}</h2>
            <span className={`uppercase tracking-wide !text-[10.5px] ${STATUS_CLASS[status] || STATUS_CLASS.uploaded}`}>
              {t(`dataRoom.status.${status}`)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="stf-btn sm">
                <ExternalLink size={12} /> {t("dataRoom.preview.openTab")}
              </a>
            ) : null}
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)]">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-primary)] bg-surface-2 overflow-hidden" style={{ height: "60vh" }}>
          {url && kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={documentTitle(documentEntry)} className="w-full h-full object-contain" />
          ) : url && kind === "frame" ? (
            <iframe src={url} title={documentTitle(documentEntry)} className="w-full h-full" />
          ) : url && office.html ? (
            // No scripts, no same-origin access: the page is only what the file said.
            <iframe sandbox="" srcDoc={office.html} title={documentTitle(documentEntry)} className="w-full h-full bg-white" />
          ) : (
            <div className="h-full flex items-center justify-center p-6 text-center text-xs text-[var(--text-secondary)]">
              {url && (kind === "docx" || kind === "xlsx") && !office.failed ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                t("dataRoom.preview.unavailable")
              )}
            </div>
          )}
        </div>

        {canReview ? (
          <div className="space-y-2">
            {rejecting ? (
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={4000}
                placeholder={t("dataRoom.reviewModal.rejectionReason")}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3 py-2 text-[11px] text-[var(--text-primary)] outline-none resize-none"
              />
            ) : null}
            {error ? <p className="text-[10px] text-rose-400 break-words">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {busy ? <Loader2 size={14} className="animate-spin text-[var(--text-secondary)]" /> : null}
              {rejecting ? (
                <>
                  <button type="button" disabled={busy} onClick={() => { setRejecting(false); setError(null); }} className="stf-btn sm">
                    {t("common.cancel")}
                  </button>
                  <button type="button" disabled={busy} onClick={() => decide("rejected")} className="stf-btn sm rj">
                    <XCircle size={12} /> {t("dataRoom.preview.confirmReject")}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" disabled={busy || decided} onClick={() => setRejecting(true)} className="stf-btn sm rj">
                    <XCircle size={12} /> {t("dataRoom.preview.reject")}
                  </button>
                  <button type="button" disabled={busy || decided} onClick={() => decide("verified")} className="stf-btn sm pr">
                    <CheckCircle2 size={12} /> {t("dataRoom.preview.approve")}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Overlay>
  );
}
