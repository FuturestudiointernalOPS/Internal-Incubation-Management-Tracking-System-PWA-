"use client";

import React, { useState, useRef, useEffect } from "react";
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
  RefreshCw,
  Download,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const STEPS = [
  { key: "upload", label: "Upload CSV" },
  { key: "preview", label: "Preview Mapping" },
  { key: "importing", label: "Import" },
  { key: "done", label: "Done" },
];

export default function ImportPage() {
  const [step, setStep] = useState(0);
  const [csvText, setCsvText] = useState("");
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
    if (!file.name.endsWith(".csv")) {
      setError("Only CSV files are accepted.");
      return;
    }
    setCsvFileName(file.name);
    setError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target.result);
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!csvText || !selectedFormId) {
      setError("Please select a form and upload a CSV file.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/platform/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csvText, form_id: selectedFormId }),
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
        setError(data.error || "Preview failed.");
      }
    } catch (err) {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedRunId) {
      setError("Please select a run.");
      return;
    }
    setStep(2);
    setImportProgress(0);
    setError("");

    try {
      const res = await fetch("/api/platform/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: selectedFormId,
          run_id: selectedRunId,
          mapping,
          csv_rows: previewData.preview_rows,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setImportResult(data);
        setImportProgress(100);
        setStep(3);
      } else {
        setError(data.error || "Import failed.");
        setStep(1);
      }
    } catch (err) {
      setError("Network error during import.");
      setStep(1);
    }
  };

  const handleReset = () => {
    setStep(0);
    setCsvText("");
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
              Platform
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Historical Import
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Import past submissions from CSV with intelligent field mapping and
            CRM contact resolution.
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
                {s.label}
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
                Select Form
              </label>
              <select
                value={selectedFormId}
                onChange={(e) => {
                  setSelectedFormId(e.target.value);
                  setSelectedRunId("");
                  fetchRuns(e.target.value);
                }}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="">Choose a form...</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} {f.status === "archived" ? "(archived)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Run selector */}
            {selectedFormId && (
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                  Select Run
                </label>
                <select
                  value={selectedRunId}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
                >
                  <option value="">Choose a run...</option>
                  {runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || `Run #${r.id}`} ({r.status})
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
                accept=".csv"
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
                      setCsvText("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-[10px] text-rose-500 font-bold uppercase hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <UploadCloud className="w-12 h-12 text-[var(--text-secondary)] mx-auto" />
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    Click to select CSV file
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    CSV with historical submission data
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handlePreview}
              disabled={loading || !csvText || !selectedFormId}
              className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Preview Mapping
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
                  Column Mapping
                </h2>
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                  {previewData.total_rows} rows detected. Map CSV columns to
                  form fields below.
                </p>
              </div>
              <button
                onClick={() => setStep(0)}
                className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--brand-orange)] font-bold uppercase"
              >
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
            </div>

            {/* Mapping table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border-primary)]">
                    <th className="p-3 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      CSV Column
                    </th>
                    <th className="p-3 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      Maps To
                    </th>
                    <th className="p-3 text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                      Sample Value
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
                          <option value="">-- Skip --</option>
                          <optgroup label="Special Fields">
                            <option value="_name">→ Name</option>
                            <option value="_email">→ Email</option>
                            <option value="_phone">→ Phone</option>
                            <option value="_crm_id">→ CRM ID</option>
                          </optgroup>
                          <optgroup label="Form Fields">
                            {previewData.form_fields.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.label} ({f.field_type})
                              </option>
                            ))}
                          </optgroup>
                        </select>
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
                  Unmatched columns: {previewData.unmatched.join(", ")}
                </p>
              </div>
            )}

            {/* Preview rows */}
            <div>
              <h3 className="text-xs font-bold text-[var(--text-primary)] mb-3">
                Preview Rows
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
              disabled={!selectedRunId}
              className="btn btn-primary w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Start Import ({previewData.total_rows} rows)
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
              Importing Submissions...
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
              Resolving contacts and creating submissions...
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
                Import Complete
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4 text-center border-l-4 border-emerald-500">
                <p className="text-2xl font-black text-emerald-500">
                  {importResult.imported}
                </p>
                <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                  Imported
                </p>
              </div>
              <div className="card p-4 text-center border-l-4 border-amber-500">
                <p className="text-2xl font-black text-amber-500">
                  {importResult.skipped}
                </p>
                <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                  Skipped
                </p>
              </div>
              <div className="card p-4 text-center border-l-4 border-rose-500">
                <p className="text-2xl font-black text-rose-500">
                  {importResult.errors?.length || 0}
                </p>
                <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                  Errors
                </p>
              </div>
            </div>

            {importResult.errors?.length > 0 && (
              <div className="card p-4">
                <p className="text-[10px] font-bold text-rose-500 uppercase mb-2">
                  Row Errors
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {importResult.errors.slice(0, 10).map((err, i) => (
                    <p
                      key={i}
                      className="text-[10px] text-[var(--text-secondary)] font-mono"
                    >
                      Row {err.row}: {err.error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleReset}
              className="btn w-full py-4 uppercase tracking-widest text-xs flex items-center justify-center gap-3"
            >
              <RefreshCw className="w-4 h-4" />
              New Import
            </button>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
