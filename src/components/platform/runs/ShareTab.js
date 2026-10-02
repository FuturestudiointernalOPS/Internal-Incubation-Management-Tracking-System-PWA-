import { useI18n } from "@/lib/i18n";

export default function ShareTab({ selectedRun, notify }) {
  const { t } = useI18n();
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const slug = selectedRun.public_slug;
  const submitUrl = slug ? `${baseUrl}/s/${slug}` : null;
  const embedCode = submitUrl ? `<iframe src="${submitUrl}" width="100%" height="600" frameborder="0" style="border-radius:12px;border:1px solid #334155;"></iframe>` : null;
  const isActive = selectedRun.status === "active";
  return (
    <div className="space-y-6 max-w-2xl">
      {!slug && (
        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <p className="text-[10px] font-bold text-amber-400">{t("platformMisc.runs.shareLinkWarning")}</p>
        </div>
      )}
      {slug && (
        <>
          {/* Direct Link (Submission) */}
          <div>
            <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.directLink")}</h3>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 mb-3">{t("platformMisc.runs.directLinkDesc")}</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={submitUrl}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(submitUrl); notify(t("platformMisc.runs.linkCopied")); }}
                className="px-4 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110"
              >
                {t("platformMisc.runs.copy")}
              </button>
            </div>
          </div>

          {/* Embed Code */}
          <div>
            <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.embedCode")}</h3>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 mb-3">{t("platformMisc.runs.embedCodeDesc")}</p>
            <div className="flex gap-2">
              <textarea
                readOnly
                rows={3}
                value={embedCode}
                className="flex-1 rounded-xl px-4 py-3 text-[10px] font-mono outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(embedCode); notify(t("platformMisc.runs.embedCodeCopied")); }}
                className="px-4 py-3 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110 self-start"
              >
                {t("platformMisc.runs.copy")}
              </button>
            </div>
          </div>

          {/* Export Responses — structured Excel / PDF download */}
          <div className="space-y-3 p-4 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-2)]">
            <div>
              <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.exportTitle")}</h3>
              <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                {t("platformMisc.runs.exportDesc")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/run-export?id=${selectedRun.id}&format=xlsx`}
                className="px-5 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
              >
                {t("platformMisc.runs.exportExcel")}
              </a>
              <a
                href={`/api/run-export?id=${selectedRun.id}&format=pdf`}
                className="px-5 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 text-[10px] font-bold uppercase tracking-wide hover:bg-rose-500/20 border border-rose-500/30 transition-all"
              >
                {t("platformMisc.runs.exportPdf")}
              </a>
            </div>
          </div>

        </>
      )}

      {/* Preview */}
      {isActive && slug && (
        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <p className="text-[10px] font-bold text-emerald-400">{t("platformMisc.runs.runActiveNotice")}</p>
        </div>
      )}
      {selectedRun.status === "draft" && (
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <p className="text-[10px] font-bold text-amber-400">{t("platformMisc.runs.launchFirstNotice")}</p>
        </div>
      )}
    </div>
  );
}
