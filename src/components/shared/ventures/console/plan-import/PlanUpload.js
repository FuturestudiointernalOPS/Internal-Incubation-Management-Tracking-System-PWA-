"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { planSheetKind, MAX_PLAN_UPLOAD_BYTES } from "@/lib/venturePlanSheetRules";

/** The reading itself: choose a tracker, optionally describe the business. */
export default function PlanUpload({ ventureId, onUploaded }) {
  const { t } = useI18n();
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Set only when the workbook holds several sheets and none is the tracker:
  // the route refuses to choose, and the choice is put to the person who made
  // the file. The file is kept, so answering costs one click, not a re-upload.
  const [sheetNames, setSheetNames] = useState(null);

  const pick = (chosen) => {
    setError(null);
    setSheetNames(null);
    if (!chosen) {
      setFile(null);
      return;
    }
    // The same rules the route applies — a file refused here would be refused there.
    if (!planSheetKind({ name: chosen.name, mime: chosen.type })) {
      setFile(null);
      setError(t("venture.planImport.badType"));
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (chosen.size > MAX_PLAN_UPLOAD_BYTES) {
      setFile(null);
      setError(t("venture.planImport.tooLarge"));
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setFile(chosen);
  };

  const analyse = async (sheetName = null) => {
    if (!file) {
      setError(t("venture.planImport.noFile"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (context.trim()) formData.append("context", context.trim());
      if (sheetName) formData.append("sheet", sheetName);

      const res = await fetch(`/api/ventures/${ventureId}/plan-import`, { method: "POST", body: formData });
      const payload = await res.json().catch(() => ({}));

      if (res.status === 403) {
        setError(t("venture.planImport.notAllowed"));
        return;
      }
      // "Which sheet?" is not a failure — it is the file asking a question. The
      // names become buttons and the same file is re-sent with the answer.
      if (payload.needsSheetChoice) {
        setSheetNames(Array.isArray(payload.sheets) ? payload.sheets : []);
        return;
      }
      if (!res.ok || !payload.success) {
        // A key the server names is translated here; anything else falls back to
        // the server's own words (or, failing that, the generic message).
        setError(
          payload.error_key
            ? t(payload.error_key, payload.error_params || {})
            : payload.error || t("venture.planImport.failed"),
        );
        return;
      }
      if (fileInput.current) fileInput.current.value = "";
      setFile(null);
      setContext("");
      setSheetNames(null);
      await onUploaded();
    } catch (_) {
      setError(t("venture.planImport.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-slate-400">{t("venture.planImport.intro")}</p>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {sheetNames && (
        <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {t("venture.planImport.chooseSheet")}
          </p>
          <p className="text-[10px] text-slate-400">{t("venture.planImport.chooseSheetHint")}</p>
          <div className="flex flex-wrap gap-2">
            {sheetNames.map((name) => (
              <button
                key={name}
                type="button"
                disabled={busy}
                onClick={() => analyse(name)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] text-[10px] font-bold text-[var(--text-primary)] hover:border-[var(--brand-orange)] disabled:opacity-50"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.planImport.file")}</label>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.csv,.tsv,.txt"
          onChange={(event) => pick(event.target.files?.[0] || null)}
          className="w-full text-[11px] text-slate-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-[var(--brand-orange)] file:text-black"
        />
        <p className="text-[9px] text-slate-500">{t("venture.planImport.fileHint")}</p>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.planImport.context")}</label>
        <textarea
          value={context}
          onChange={(event) => setContext(event.target.value)}
          rows={2}
          placeholder={t("venture.planImport.contextPlaceholder")}
          className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => analyse()}
          disabled={busy || !file}
          className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {t(busy ? "venture.planImport.analysing" : "venture.planImport.analyse")}
        </button>
      </div>
    </div>
  );
}
