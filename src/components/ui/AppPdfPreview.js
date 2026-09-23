"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * AppPdfPreview — read-only rendering of a PDF fetched on demand.
 *
 * The bytes come from the caller's async function and are handed to the
 * browser's own viewer, so the document can be read but never edited. Fetching
 * a preview has no side effects of its own — whatever the caller's function
 * does is all that happens.
 *
 * Loading and error states are DERIVED from which document the loaded result
 * belongs to, so switching documents shows the loading state immediately
 * without an extra render pass.
 *
 * @param {object} props
 * @param {string|number|null} props.requestKey  Identifies the document to show.
 *   A new value loads it and releases the previous one; null/"" shows nothing.
 * @param {() => Promise<Blob>} props.loadPdf  Fetches the PDF bytes. Rejecting
 *   with an Error whose message is meaningful surfaces that message.
 * @param {string} [props.title]         Accessible name of the viewer.
 * @param {string} [props.loadingLabel]
 * @param {string} [props.errorLabel]
 * @param {string} [props.emptyLabel]
 * @param {string} [props.heightClass="h-[50vh] min-h-[240px]"]
 * @param {string} [props.className=""]
 *
 * @example
 *   <AppPdfPreview
 *     requestKey={submissionId}
 *     loadPdf={() => fetchResultPdf(submissionId)}
 *     title="Result preview"
 *     loadingLabel="Building the preview…"
 *     errorLabel="Preview unavailable"
 *   />
 */
export default function AppPdfPreview({
  requestKey,
  loadPdf,
  title = "PDF",
  loadingLabel,
  errorLabel,
  emptyLabel,
  heightClass = "h-[50vh] min-h-[240px]",
  className = "",
}) {
  // { key, url, error } — keyed so stale results are never shown for a new document.
  const [settled, setSettled] = useState({ key: null, url: null, error: null });
  const loadRef = useRef(loadPdf);

  // Keep the latest loader available to the effect below without making it a
  // dependency — callers pass an inline function, which would reload forever.
  // Declared first so it is refreshed before the load effect runs.
  useEffect(() => {
    loadRef.current = loadPdf;
  });

  const active = requestKey !== null && requestKey !== undefined && requestKey !== "";

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let objectUrl = null;
    (async () => {
      try {
        const blob = await loadRef.current();
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setSettled({ key: requestKey, url: objectUrl, error: null });
      } catch (loadError) {
        if (!cancelled) setSettled({ key: requestKey, url: null, error: loadError?.message || "" });
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requestKey, active]);

  const ready = active && settled.key === requestKey;
  const loading = active && !ready;
  const url = ready ? settled.url : null;
  const error = ready ? settled.error : null;

  return (
    <div
      className={`rounded-xl border border-[var(--border-primary)] bg-primary/50 overflow-hidden ${className}`}
    >
      {loading ? (
        <div className={`flex flex-col items-center justify-center gap-2 ${heightClass}`}>
          <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
          {loadingLabel && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {loadingLabel}
            </p>
          )}
        </div>
      ) : error ? (
        <div className={`flex flex-col items-center justify-center gap-2 px-6 text-center ${heightClass}`}>
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          {errorLabel && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
              {errorLabel}
            </p>
          )}
          {error && (
            <p className="text-[10px] font-medium text-[var(--text-secondary)]">{error}</p>
          )}
        </div>
      ) : url ? (
        <iframe title={title} src={url} className={`w-full ${heightClass}`} />
      ) : (
        <div className={`flex items-center justify-center ${heightClass}`}>
          {emptyLabel && (
            <p className="text-[10px] font-medium text-[var(--text-tertiary)]">{emptyLabel}</p>
          )}
        </div>
      )}
    </div>
  );
}
