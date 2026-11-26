"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  X,
  Download,
} from "lucide-react";
import ImportDoneStep from "./ImportView/ImportDoneStep";

const STEPS = [
  { key: "upload", label: "adminMisc.platformImport.stepUpload" },
  { key: "preview", label: "adminMisc.platformImport.stepPreview" },
  { key: "importing", label: "adminMisc.platformImport.stepImport" },
  { key: "done", label: "adminMisc.platformImport.stepDone" },
];

export default function ImportView({ ctx }) {
  const {
    csvFileName,
    error,
    fetchRuns,
    fileInputRef,
    forms,
    handleExecute,
    handleFileChange,
    handlePreview,
    handleReset,
    importResult,
    loading,
    mapping,
    parsedData,
    previewData,
    runs,
    selectedFormId,
    selectedRunId,
    setCsvFileName,
    setError,
    setMapping,
    setParsedData,
    setPreviewData,
    setSelectedFormId,
    setSelectedRunId,
    setStep,
    step,
    t,
    updateMapping,
  } = ctx;

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-8 pb-20">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
              {t("adminMisc.platformImport.eyebrow")}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
            {t("adminMisc.platformImport.title")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("adminMisc.platformImport.subtitle")}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {STEPS.map((stepItem, index) => (
            <React.Fragment key={stepItem.key}>
              <button
                onClick={() => index < step && setStep(index)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${
                  index === step
                    ? "bg-[var(--brand-orange)] text-white"
                    : index < step
                    ? "bg-emerald-500/10 text-emerald-500 cursor-pointer"
                    : "bg-[var(--border-primary)] text-[var(--text-secondary)]"
                }`}
              >
                {index < step ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">
                    {index + 1}
                  </span>
                )}
                {t(stepItem.label)}
              </button>
              {index < STEPS.length - 1 && (
                <ArrowRight className="w-3 h-3 text-[var(--text-secondary)]" />
              )}
            </React.Fragment>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
              <p className="text-[11px] font-bold text-rose-500 uppercase">
                {error}
              </p>
              <button onClick={() => setError("")} className="ml-auto">
                <X className="w-4 h-4 text-rose-500" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STEP 0: Upload */}
        {step === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-8 space-y-6"
          >
            {/* Form selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                {t("adminMisc.platformImport.selectForm")}
              </label>
              <select
                value={selectedFormId}
                onChange={(event) => {
                  setSelectedFormId(event.target.value);
                  setSelectedRunId("");
                  // Prevent stale questions from a previous selection
                  setPreviewData(null);
                  setMapping({});
                  setStep(0);
                  fetchRuns(event.target.value);
                }}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-sm font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="">{t("adminMisc.platformImport.chooseForm")}</option>
                {forms.map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.name} {form.status === "archived" ? `(${t("adminMisc.platformImport.archivedSuffix")})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Run selector */}
            {selectedFormId && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                  {t("adminMisc.platformImport.selectRun")}
                </label>
                <select
                  value={selectedRunId}
                  onChange={(event) => {
                    setSelectedRunId(event.target.value);
                    // Prevent stale questions from a previous selection
                    setPreviewData(null);
                    setMapping({});
                    setStep(0);
                  }}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-sm font-bold outline-none focus:border-[var(--brand-orange)]"
                >
                  <option value="">{t("adminMisc.platformImport.chooseRun")}</option>
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.name || `${t("adminMisc.platformImport.runFallback")} #${run.id}`} ({run.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* File upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border-primary)] rounded-2xl p-12 text-center cursor-pointer hover:border-[var(--brand-orange)] transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                className="hidden"
              />
              {csvFileName ? (
                <div className="space-y-3">
                  <FileText className="w-12 h-12 text-[var(--brand-orange)] mx-auto" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {csvFileName}
                  </p>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setCsvFileName("");
                      setParsedData(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-[10px] text-rose-500 font-bold uppercase hover:underline"
                  >
                    {t("adminMisc.platformImport.remove")}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <UploadCloud className="w-12 h-12 text-[var(--text-secondary)] mx-auto" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {t("adminMisc.platformImport.clickToSelect")}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {t("adminMisc.platformImport.csvHint")}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handlePreview}
              disabled={loading || !parsedData || parsedData.rows.length === 0 || !selectedFormId}
              className="btn btn-primary w-full py-4 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("adminMisc.platformImport.analyzing")}
                </>
              ) : (
                <>
                  {t("adminMisc.platformImport.previewMapping")}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* STEP 1: Preview Mapping */}
        {step === 1 && previewData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-8 space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {t("adminMisc.platformImport.columnMapping")}
                </h2>
                <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                  {t("adminMisc.platformImport.rowsDetected", { count: previewData.total_rows })}
                </p>
                <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                  Questions loaded from{" "}
                  <span className="text-[var(--brand-orange)] font-bold">{previewData.form?.name || "selected form"}</span>
                  {previewData.run?.name ? (
                    <> · Run: <span className="text-[var(--brand-orange)] font-bold">{previewData.run.name}</span></>
                  ) : null}
                  {previewData.form_field_count === 0 ? (
                    <span className="text-rose-500 font-bold"> — this form has no questions yet.</span>
                  ) : (
                    <> · {previewData.form_field_count} question{previewData.form_field_count === 1 ? "" : "s"}</>
                  )}
                </p>
              </div>
              <button
                onClick={() => setStep(0)}
                className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--brand-orange)] font-bold uppercase"
              >
                <ArrowLeft className="w-3 h-3" /> {t("adminMisc.platformImport.back")}
              </button>
            </div>

            {/* Empty state — form has no questions */}
            {(previewData.form_field_count || 0) === 0 && (
              <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                <p className="text-[11px] font-bold text-rose-400">
                  This form has no questions yet.
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                  Add questions in the form builder (Forms → this form) and
                  then return here to map and import your CSV.
                </p>
              </div>
            )}

            {/* Mapping table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("adminMisc.platformImport.csvColumn")}
                    </th>
                    <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("adminMisc.platformImport.mapsTo")}
                    </th>
                    <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("adminMisc.platformImport.sampleValue")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.csv_columns.map((col) => (
                    <tr
                      key={col}
                      className="border-b border-[var(--border-primary)]"
                    >
                      <td className="p-3 text-[11px] font-bold text-[var(--text-primary)]">
                        {col}
                      </td>
                      <td className="p-3">
                        <select
                          value={mapping[col] || ""}
                          onChange={(event) => updateMapping(col, event.target.value)}
                          className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg p-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
                        >
                          <option value="">{t("adminMisc.platformImport.skipOption")}</option>
                          <optgroup label={t("adminMisc.platformImport.specialFields")}>
                            <option value="_name">{t("adminMisc.platformImport.fieldName")}</option>
                            <option value="_email">{t("adminMisc.platformImport.fieldEmail")}</option>
                            <option value="_phone">{t("adminMisc.platformImport.fieldPhone")}</option>
                            <option value="_crm_id">{t("adminMisc.platformImport.fieldCrmId")}</option>
                          </optgroup>
                          <optgroup label={t("adminMisc.platformImport.formFields")}>
                            {previewData.form_fields.map((formField) => (
                              <option key={formField.id} value={formField.id}>
                                {formField.label} ({formField.field_type})
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        {(() => {
                          const mappedField = previewData.form_fields.find(
                            (formField) => String(formField.id) === String(mapping[col])
                          );
                          if (
                            mappedField &&
                            Array.isArray(mappedField.options) &&
                            mappedField.options.length > 0
                          ) {
                            const optionLabels = mappedField.options.map((option) =>
                              typeof option === "string" ? option : option?.label || option?.value || String(option)
                            );
                            return (
                              <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 break-words">
                                Allowed options: {optionLabels.join(" · ")}
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      <td className="p-3 text-[10px] text-[var(--text-secondary)] font-mono truncate max-w-[200px]">
                        {previewData.preview_rows[0]?.[col] || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Unmatched warning */}
            {previewData.unmatched.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-[10px] font-bold text-amber-500 uppercase">
                  {t("adminMisc.platformImport.unmatchedColumns", { columns: previewData.unmatched.join(", ") })}
                </p>
              </div>
            )}

            {/* Preview rows */}
            <div>
              <h3 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3">
                {t("adminMisc.platformImport.previewRows")}
              </h3>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b border-[var(--border-primary)]">
                      {previewData.csv_columns.map((col) => (
                        <th
                          key={col}
                          className="p-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] sticky top-0 bg-[var(--bg-card)]"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview_rows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-b border-[var(--border-primary)]"
                      >
                        {previewData.csv_columns.map((col) => (
                          <td
                            key={col}
                            className="p-2 text-[var(--text-secondary)] max-w-[150px] truncate"
                          >
                            {row[col] || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={handleExecute}
              disabled={!selectedRunId || (previewData.form_field_count || 0) === 0}
              className="btn btn-primary w-full py-4 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {t("adminMisc.platformImport.startImport", { count: previewData.total_rows })}
            </button>
          </motion.div>
        )}

        {/* STEP 2: Importing */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-12 text-center space-y-6"
          >
            <Loader2 className="w-12 h-12 text-[var(--brand-orange)] mx-auto animate-spin" />
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {t("adminMisc.platformImport.importingTitle")}
            </h2>
            <div className="w-full bg-[var(--border-primary)] rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-[var(--brand-orange)] rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2, ease: "easeInOut" }}
              />
            </div>
            <p className="text-[10px] font-medium text-[var(--text-secondary)]">
              {t("adminMisc.platformImport.importingSubtitle")}
            </p>
          </motion.div>
        )}

        {/* STEP 3: Done */}
        {step === 3 && importResult && (
          <ImportDoneStep
            importResult={importResult}
            handleReset={handleReset}
            t={t}
          />
        )}
      </div>
    </>
  );
}
