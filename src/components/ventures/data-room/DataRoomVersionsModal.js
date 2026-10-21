"use client";

import { useEffect, useState } from "react";
import { Download, History, Loader2, X } from "lucide-react";
import { Overlay } from "./DataRoomUploadModal";
import { documentTitle, formatBytes, formatDateTime } from "./dataRoomUi";

/**
 * Version history for one document. Read through the same Venture-scoped
 * endpoint as the document itself, so a version of another Venture's document
 * can never be listed here.
 */
export default function DataRoomVersionsModal({ documentEntry, ventureId, t, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [versions, setVersions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/ventures/${ventureId}/data-room/${documentEntry.id}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (cancelled) return;
        if (!data.success) throw new Error(data.error);
        setVersions(data.document?.versions || []);
      } catch (caughtError) {
        if (!cancelled) setError(String(caughtError?.message || "dataRoom.errors.saveFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ventureId, documentEntry.id]);

  const message = (value) => (String(value || "").startsWith("dataRoom.") ? t(value) : value);
  const current = Number(documentEntry.current_version || versions[versions.length - 1]?.version_number || 1);

  return (
    <Overlay onClose={onClose} label={t("dataRoom.versionsModal.title")}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
              <History size={15} className="text-[var(--brand-orange)]" /> {t("dataRoom.versionsModal.title")}
            </h2>
            <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">{documentTitle(documentEntry)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-2)]">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center">
            <Loader2 size={18} className="animate-spin mx-auto text-[var(--brand-orange)]" />
          </div>
        ) : error ? (
          <p className="text-[10px] text-rose-400 break-words">{message(error)}</p>
        ) : versions.length === 0 ? (
          <p className="text-[10px] text-[var(--text-secondary)]">{t("dataRoom.versionsModal.noVersions")}</p>
        ) : (
          <div className="space-y-2">
            {versions.map((version) => {
              const number = version.version_number || version.version || 1;
              const isCurrent = Number(number) === current;
              return (
                <div key={version.id || number} className="rounded-xl border border-[var(--border-primary)] bg-surface-2 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wide text-[var(--text-primary)]">
                        v{number}
                      </span>
                      {isCurrent ? (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                          {t("dataRoom.versionsModal.current")}
                        </span>
                      ) : null}
                    </div>
                    {version.file_url_signed ? (
                      <a
                        href={version.file_url_signed}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded text-[var(--brand-orange)] hover:bg-[var(--brand-orange)]/10"
                        title={t("dataRoom.download")}
                      >
                        <Download size={12} />
                      </a>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">{version.file_name}</p>
                  <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">
                    {formatBytes(version.file_size) ? `${formatBytes(version.file_size)} · ` : ""}
                    {formatDateTime(version.uploaded_at || version.created_at) || ""}
                    {version.uploaded_by ? ` · ${version.uploaded_by}` : ""}
                  </p>
                  {version.version_notes || version.change_notes ? (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 break-words">
                      {t("dataRoom.versionsModal.notes")}: {version.version_notes || version.change_notes}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Overlay>
  );
}
