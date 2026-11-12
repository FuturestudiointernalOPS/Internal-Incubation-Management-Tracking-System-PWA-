import { useI18n } from "@/lib/i18n";
import { ExternalLink, FileText, X } from "lucide-react";

export default function PdfViewerModal({ activePDF, onClearActivePDF }) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in"
      onClick={() => onClearActivePDF()}
    >
      <div
        className="card w-full max-w-5xl h-[90vh] flex flex-col space-y-4 shadow-2xl border-[var(--border-primary)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-orange/10 text-[var(--brand-orange)]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase text-[var(--text-primary)]">
                {activePDF.name}
              </h3>
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("pmMisc.workspace.documentPreview")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={activePDF.url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary !py-2 text-[10px] gap-2"
            >
              <ExternalLink className="w-4 h-4" />{" "}
              {t("pmMisc.workspace.openInNewTab")}
            </a>
            <button
              onClick={() => onClearActivePDF()}
              className="btn btn-secondary !py-2 hover:bg-rose-500/10 hover:text-rose-500 border-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-tertiary rounded-xl overflow-hidden border border-[var(--border-primary)] relative">
          {!activePDF.url || activePDF.url === "#" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 opacity-50">
              <FileText className="w-16 h-16 mb-4 text-[var(--text-secondary)] opacity-20" />
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.workspace.noDocumentUrl")}
              </h3>
              <p className="text-[10px] text-[var(--text-secondary)] mt-2 max-w-sm leading-relaxed">
                {t("pmMisc.workspace.noDocumentUrlDesc")}
              </p>
            </div>
          ) : (
            <iframe
              src={`${activePDF.url}#toolbar=0`}
              className="w-full h-full"
              title={t("pmMisc.workspace.pdfViewer")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
