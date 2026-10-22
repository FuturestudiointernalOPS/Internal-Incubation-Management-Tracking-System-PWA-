"use client";

/**
 * Shared presentation helpers for the Data Room. Kept out of the components so
 * the card and the modals cannot disagree about a badge or a byte count.
 */

export const STATUS_CLASS = {
  uploaded: "bg-blue-500/10 text-blue-400 border-blue-500/25",
  under_review: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  verified: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  rejected: "bg-rose-500/10 text-rose-400 border-rose-500/25",
  expired: "bg-slate-500/10 text-slate-400 border-slate-500/25",
};

export const STATUS_ORDER = ["uploaded", "under_review", "verified", "rejected", "expired"];

export const LEVEL_CLASS = {
  required: "text-[var(--brand-orange)]",
  recommended: "text-blue-400",
  conditional: "text-[var(--text-secondary)]",
  not_applicable: "text-[var(--text-secondary)] opacity-60",
};

export function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function documentTitle(documentEntry) {
  return documentEntry?.title || documentEntry?.name || documentEntry?.file_name || "document";
}

/** Save a (possibly cross-origin, signed) URL under its own name. */
export async function saveUrl(url, fileName) {
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

/** Download one document, falling back to opening it if the read is refused. */
export async function downloadDocument(documentEntry) {
  const href = documentEntry?.file_url_signed;
  if (!href) return;
  try {
    await saveUrl(href, documentEntry.file_name || documentTitle(documentEntry));
  } catch (_) {
    window.open(href, "_blank", "noopener,noreferrer");
  }
}
