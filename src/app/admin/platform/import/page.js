"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  X,
  RefreshCw,
  Download,
} from "lucide-react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";
import * as XLSX from "xlsx";
import { parseCSVRows } from "@/lib/csv";

const STEPS = [
  { key: "upload", label: "adminMisc.platformImport.stepUpload" },
  { key: "preview", label: "adminMisc.platformImport.stepPreview" },
  { key: "importing", label: "adminMisc.platformImport.stepImport" },
  { key: "done", label: "adminMisc.platformImport.stepDone" },
];

// Chunk size for the execute endpoint. Vercel serverless functions reject
// request bodies over 4.5 MB with 413, so large CSVs are imported in batches
// that reuse one import batch record (batch_id continuation).
const EXECUTE_CHUNK_SIZE = 200;

// Stable string hash (cyrb53) so every chunk of the same file reports the
// same file_hash — duplicate-batch detection works across re-uploads.
function simpleHash(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// ── File parsing: CSV and XLSX both normalize to { headers, rows } ──

// RFC 4180-aware CSV → row objects keyed by trimmed header.
function parseTextToRows(text) {
  const grid = parseCSVRows(text);
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = grid[0].map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i];
    if (cells.length === 0 || (cells.length === 1 && cells[0] === "")) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] !== undefined ? cells[idx].trim() : "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

// XLSX (first sheet) → row objects keyed by header, same shape as CSV.
function parseXlsxToRows(buffer) {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { headers: [], rows: [] };
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = (grid[0] || []).map((h) => String(h).trim());
  const rows = [];
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i];
    if (!cells || cells.length === 0) continue;
    if (cells.length === 1 && String(cells[0]).trim() === "") continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] !== undefined && cells[idx] !== null ? String(cells[idx]).trim() : "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

export default function ImportPage() {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [parsedData, setParsedData] = useState(null); // { headers, rows, fileName }
  const [csvFileName, setCsvFileName] = useState("");
  const [forms, setForms] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Preview state
  const [previewData, setPreviewData] = useState(null);
  const [mapping, setMapping] = useState({});

  // Import result state
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState(0);

  const fileInputRef = useRef(null);

  // Fetch forms on mount
  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      const res = await fetch("/api/platform/forms?status=all");
      const data = await res.json();
      if (data.success) setForms(data.forms || []);
    } catch (_) {}
  };

  const fetchRuns = async (formId) => {
    try {
      const res = await fetch(`/api/platform/form-runs?form_id=${formId}`);
      const data = await res.json();
      if (data.success) setRuns(data.runs || []);
    } catch (_) {}
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
    if (!isCsv && !isXlsx) {
      setError(t("adminMisc.platformImport.errorCsvOnly"));
      return;
    }
    setCsvFileName(file.name);
    setError("");

    const applyParsed = (parsed) => {
      setParsedData({ ...parsed, fileName: file.name });
      if (parsed.rows.length === 0) {
        setError(t("adminMisc.platformImport.errorEmptyRows"));
      }
    };

    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (ev) => applyParsed(parseTextToRows(ev.target.result));
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          applyParsed(parseXlsxToRows(ev.target.result));
        } catch (_) {
          setError(t("adminMisc.platformImport.errorParseFailed"));
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handlePreview = async () => {
    if (!parsedData || parsedData.rows.length === 0 || !selectedFormId) {
      setError(t("adminMisc.platformImport.errorSelectFormAndFile"));
      return;
    }
    setLoading(true);
    setError("");

    try {
      // Mapping only needs the headers + a few sample rows — never send the
      // full file to preview (large files would hit Vercel's 4.5 MB limit).
      const sample = parsedData.rows.slice(0, 50);
      const res = await fetch("/api/platform/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: parsedData.headers,
          rows: sample,
          form_id: selectedFormId,
          run_id: selectedRunId,
          total_rows: parsedData.rows.length,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData(data);
        // Build initial mapping from suggested
        const initialMapping = {};
        data.suggested_mapping.forEach((m) => {
          if (m.field_id) initialMapping[m.csv_column] = m.field_id;
        });
        setMapping(initialMapping);
        setStep(1);
      } else {
        setError(t((data.error || t("adminMisc.platformImport.errorPreviewFailed")) || "") || (data.error || t("adminMisc.platformImport.errorPreviewFailed")));
      }
    } catch (err) {
      setError(t("adminMisc.platformImport.errorNetwork"));
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedRunId) {
      setError(t("adminMisc.platformImport.errorSelectRun"));
      return;
    }
    setStep(2);
    setImportProgress(0);
    setError("");

    const allRows = parsedData ? parsedData.rows : [];
    if (allRows.length === 0) {
      setError(t("adminMisc.platformImport.errorEmptyRows"));
      setStep(1);
      return;
    }

    // Import in chunks: every request stays far below Vercel's 4.5 MB body
    // limit, and all chunks share one import batch record via batch_id.
    const fullHash = simpleHash(JSON.stringify(allRows));
    const agg = {
      success: true,
      imported: 0,
      skipped: 0,
      needs_review: 0,
      errors: [],
      review_rows: [],
      total: allRows.length,
      duplicate_batch: false,
      previous_batch: null,
    };
    let batchId = null;

    for (let start = 0; start < allRows.length; start += EXECUTE_CHUNK_SIZE) {
      const chunk = allRows.slice(start, start + EXECUTE_CHUNK_SIZE);
      let data;
      try {
        const res = await fetch("/api/platform/import/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            form_id: selectedFormId,
            run_id: selectedRunId,
            mapping,
            csv_rows: chunk,
            batch_id: batchId,
            file_hash: fullHash,
          }),
        });
        data = await res.json();
      } catch (err) {
        setError(
          t("adminMisc.platformImport.errorNetworkDuringImport") +
            " " +
            t("adminMisc.platformImport.errorPartialImport")
        );
        setStep(1);
        return;
      }
      if (!data.success) {
        setError(
          (data.error || t("adminMisc.platformImport.errorImportFailed")) +
            " " +
            t("adminMisc.platformImport.errorPartialImport")
        );
        setStep(1);
        return;
      }
      batchId = data.batch?.id || batchId;
      agg.imported += data.imported || 0;
      agg.skipped += data.skipped || 0;
      agg.needs_review += data.needs_review || 0;
      agg.errors.push(...(data.errors || []));
      agg.review_rows.push(...(data.review_rows || []));
      if (data.duplicate_batch) {
        agg.duplicate_batch = true;
        agg.previous_batch = data.previous_batch || null;
      }
      const done = Math.min(start + EXECUTE_CHUNK_SIZE, allRows.length);
      setImportProgress(Math.round((done / allRows.length) * 100));
    }

    setImportResult(agg);
    setImportProgress(100);
    setStep(3);
  };

  const handleReset = () => {
    setStep(0);
    setParsedData(null);
    setCsvFileName("");
    setPreviewData(null);
    setMapping({});
    setImportResult(null);
    setImportProgress(0);
    setError("");
    setSelectedRunId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateMapping = (csvColumn, fieldId) => {
    setMapping((prev) => ({ ...prev, [csvColumn]: fieldId }));
  };

  return (
    <DashboardLayout role="super_admin">
      <div className="max-w-4xl mx-auto space-y-8 pb-20">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[var(--brand-orange)]" />
            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.3em]">
              {t("adminMisc.platformImport.eyebrow")}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            {t("adminMisc.platformImport.title")}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {t("adminMisc.platformImport.subtitle")}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                  i === step
                    ? "bg-[var(--brand-orange)] text-white"
                    : i < step
                    ? "bg-emerald-500/10 text-emerald-500 cursor-pointer"
                    : "bg-[var(--border-primary)] text-[var(--text-secondary)]"
                }`}
              >
                {i < step ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center text-[7px]">
                    {i + 1}
                  </span>
                )}
                {t(s.label)}
              </button>
              {i < STEPS.length - 1 && (
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
              <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                {t("adminMisc.platformImport.selectForm")}
              </label>
              <select
                value={selectedFormId}
                onChange={(e) => {
                  setSelectedFormId(e.target.value);
                  setSelectedRunId("");
                  // Prevent stale questions from a previous selection
                  setPreviewData(null);
                  setMapping({});
                  setStep(0);
                  fetchRuns(e.target.value);
                }}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="">{t("adminMisc.platformImport.chooseForm")}</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.status === "archived" ? `(${t("adminMisc.platformImport.archivedSuffix")})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Run selector */}
            {selectedFormId && (
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                  {t("adminMisc.platformImport.selectRun")}
                </label>
                <select
                  value={selectedRunId}
                  onChange={(e) => {
                    setSelectedRunId(e.target.value);
                    // Prevent stale questions from a previous selection
                    setPreviewData(null);
                    setMapping({});
                    setStep(0);
                  }}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
                >
                  <option value="">{t("adminMisc.platformImport.chooseRun")}</option>
                  {runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || `${t("adminMisc.platformImport.runFallback")} #${r.id}`} ({r.status})
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
                    onClick={(e) => {
                      e.stopPropagation();
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
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {t("adminMisc.platformImport.csvHint")}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handlePreview}
              disabled={loading || !parsedData || parsedData.rows.length === 0 || !selectedFormId}
              className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-50"
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
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                  {t("adminMisc.platformImport.rowsDetected", { count: previewData.total_rows })}
                </p>
                <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">
                  Questions loaded from{" "}
                  <span className="text-[var(--brand-orange)] font-black">{previewData.form?.name || "selected form"}</span>
                  {previewData.run?.name ? (
                    <> · Run: <span className="text-[var(--brand-orange)] font-black">{previewData.run.name}</span></>
                  ) : null}
                  {previewData.form_field_count === 0 ? (
                    <span className="text-rose-500 font-black"> — this form has no questions yet.</span>
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
                    <th className="p-3 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      {t("adminMisc.platformImport.csvColumn")}
                    </th>
                    <th className="p-3 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      {t("adminMisc.platformImport.mapsTo")}
                    </th>
                    <th className="p-3 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
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
                          onChange={(e) => updateMapping(col, e.target.value)}
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
                            {previewData.form_fields.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.label} ({f.field_type})
                              </option>
                            ))}
                          </optgroup>
                        </select>
                        {(() => {
                          const mappedField = previewData.form_fields.find(
                            (f) => String(f.id) === String(mapping[col])
                          );
                          if (
                            mappedField &&
                            Array.isArray(mappedField.options) &&
                            mappedField.options.length > 0
                          ) {
                            const optionLabels = mappedField.options.map((o) =>
                              typeof o === "string" ? o : o?.label || o?.value || String(o)
                            );
                            return (
                              <p className="text-[8px] text-[var(--text-secondary)] mt-1 break-words">
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
              <h3 className="text-xs font-bold text-[var(--text-primary)] mb-3">
                {t("adminMisc.platformImport.previewRows")}
              </h3>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b border-[var(--border-primary)]">
                      {previewData.csv_columns.map((col) => (
                        <th
                          key={col}
                          className="p-2 text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-wider sticky top-0 bg-[var(--bg-card)]"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.preview_rows.map((row, i) => (
                      <tr
                        key={i}
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
              className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-50"
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
            <p className="text-[10px] text-[var(--text-secondary)]">
              {t("adminMisc.platformImport.importingSubtitle")}
            </p>
          </motion.div>
        )}

        {/* STEP 3: Done */}
        {step === 3 && importResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-8 space-y-6"
          >
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <p className="text-[11px] font-bold text-emerald-500 uppercase">
                {t("adminMisc.platformImport.importComplete")}
              </p>
            </div>

            {importResult.duplicate_batch && importResult.previous_batch && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-[10px] font-bold text-amber-500 uppercase">
                  {t("adminMisc.platformImport.duplicateWarning", { batchId: importResult.previous_batch.id, date: new Date(importResult.previous_batch.created_at).toLocaleDateString() })}
                </p>
                <p className="text-[9px] text-[var(--text-secondary)] mt-1">
                  {t("adminMisc.platformImport.duplicateSkipped")}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4 text-center border-l-4 border-emerald-500">
                <p className="text-2xl font-black text-emerald-500">
                  {importResult.imported}
                </p>
                <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                  {t("adminMisc.platformImport.statImported")}
                </p>
              </div>
              <div className="card p-4 text-center border-l-4 border-amber-500">
                <p className="text-2xl font-black text-amber-500">
                  {importResult.skipped}
                </p>
                <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                  {t("adminMisc.platformImport.statSkipped")}
                </p>
              </div>
              <div className="card p-4 text-center border-l-4 border-blue-500">
                <p className="text-2xl font-black text-blue-500">
                  {importResult.needs_review || 0}
                </p>
                <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                  {t("adminMisc.platformImport.statNeedsReview")}
                </p>
              </div>
              <div className="card p-4 text-center border-l-4 border-rose-500">
                <p className="text-2xl font-black text-rose-500">
                  {importResult.errors?.length || 0}
                </p>
                <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                  {t("adminMisc.platformImport.statErrors")}
                </p>
              </div>
            </div>

            {importResult.needs_review > 0 && importResult.review_rows?.length > 0 && (
              <div className="card p-4 border-l-4 border-blue-500">
                <p className="text-[10px] font-bold text-blue-500 uppercase mb-2">
                  {t("adminMisc.platformImport.identityReviewRequired")}
                </p>
                <p className="text-[9px] text-[var(--text-secondary)] mb-3">
                  {t("adminMisc.platformImport.identityReviewHint")}
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResult.review_rows.slice(0, 20).map((r, i) => (
                    <p key={i} className="text-[10px] text-[var(--text-secondary)]">
                      {t("adminMisc.platformImport.rowPrefix")} {r.row}: {r.name} {r.email ? `(${r.email})` : ""} — {r.reason}
                    </p>
                  ))}
                  {importResult.review_rows.length > 20 && (
                    <p className="text-[9px] text-[var(--text-secondary)] italic">
                      {t("adminMisc.platformImport.moreRows", { count: importResult.review_rows.length - 20 })}
                    </p>
                  )}
                </div>
              </div>
            )}

            {importResult.errors?.length > 0 && (
              <div className="card p-4">
                <p className="text-[10px] font-bold text-rose-500 uppercase mb-2">
                  {t("adminMisc.platformImport.rowErrors")}
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {importResult.errors.slice(0, 10).map((err, i) => (
                    <p
                      key={i}
                      className="text-[10px] text-[var(--text-secondary)] font-mono"
                    >
                      {t("adminMisc.platformImport.rowPrefix")} {err.row}: {t(err.error || "") || err.error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {importResult.needs_review > 0 && (
              <Link
                href="/admin/platform/import/review?status=pending"
                className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3"
              >
                <AlertTriangle className="w-4 h-4" />
                {importResult.needs_review === 1
                  ? t("adminMisc.platformImport.reviewFlaggedOne", { count: importResult.needs_review })
                  : t("adminMisc.platformImport.reviewFlaggedMany", { count: importResult.needs_review })}
              </Link>
            )}

            <button
              onClick={handleReset}
              className="btn w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              <RefreshCw className="w-4 h-4" />
              {t("adminMisc.platformImport.newImport")}
            </button>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
