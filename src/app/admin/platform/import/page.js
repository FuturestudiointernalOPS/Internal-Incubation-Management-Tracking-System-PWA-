"use client";

import { useState, useRef, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { readSheet } from "read-excel-file/browser";
import { gridToRows } from "@/lib/spreadsheet";
import { parseCSVRows } from "@/lib/csv";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import ImportView from "@/components/admin/platform/import/ImportView";


// Chunk size for the execute endpoint. Vercel serverless functions reject
// request bodies over 4.5 MB with 413, so large CSVs are imported in batches
// that reuse one import batch record (batch_id continuation).
const EXECUTE_CHUNK_SIZE = 200;

// Stable string hash (cyrb53) so every chunk of the same file reports the
// same file_hash — duplicate-batch detection works across re-uploads.
function simpleHash(text) {
  let hash1 = 0xdeadbeef;
  let hash2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index++) {
    const charCode = text.charCodeAt(index);
    hash1 = Math.imul(hash1 ^ charCode, 2654435761);
    hash2 = Math.imul(hash2 ^ charCode, 1597334677);
  }
  hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507) ^ Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
  hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507) ^ Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & hash2) + (hash1 >>> 0)).toString(36);
}

// ── File parsing: CSV and XLSX both normalize to { headers, rows } ──

// RFC 4180-aware CSV → row objects keyed by trimmed header.
function parseTextToRows(text) {
  const grid = parseCSVRows(text);
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = grid[0].map((header) => header.trim());
  const rows = [];
  for (let rowIndex = 1; rowIndex < grid.length; rowIndex++) {
    const cells = grid[rowIndex];
    if (cells.length === 0 || (cells.length === 1 && cells[0] === "")) continue;
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] !== undefined ? cells[index].trim() : "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

// XLSX (first sheet) → row objects keyed by header, same shape as CSV.
async function parseXlsxToRows(file) {
  const grid = gridToRows(await readSheet(file, 1, { trim: false }));
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = (grid[0] || []).map((header) => String(header).trim());
  const rows = [];
  for (let rowIndex = 1; rowIndex < grid.length; rowIndex++) {
    const cells = grid[rowIndex];
    if (!cells || cells.length === 0) continue;
    if (cells.length === 1 && String(cells[0]).trim() === "") continue;
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] !== undefined && cells[index] !== null ? String(cells[index]).trim() : "";
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
  const [, setImportProgress] = useState(0);

  const fileInputRef = useRef(null);

  const fetchForms = async (bypassCache = false) => {
    const url = "/api/platform/forms?status=all";
    const apply = (data) => {
      if (data.success) setForms(data.forms || []);
    };
    try {
      // Cache-first paint: the form dropdown renders instantly from a fresh
      // snapshot; the network refresh keeps it current in the background.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) apply(cached);
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {}
  };

  // Fetch forms on mount
  useEffect(() => {
    fetchForms();
  }, []);

  const fetchRuns = async (formId) => {
    try {
      const response = await fetch(`/api/platform/form-runs?form_id=${formId}`);
      const data = await response.json();
      if (data.success) setRuns(data.runs || []);
    } catch (_) {}
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
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
      try {
        applyParsed(await parseXlsxToRows(file));
      } catch (_) {
        setError(t("adminMisc.platformImport.errorParseFailed"));
      }
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
      const response = await fetch("/api/platform/import/preview", {
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
      const data = await response.json();
      if (data.success) {
        setPreviewData(data);
        // Build initial mapping from suggested
        const initialMapping = {};
        data.suggested_mapping.forEach((suggestion) => {
          if (suggestion.field_id) initialMapping[suggestion.csv_column] = suggestion.field_id;
        });
        setMapping(initialMapping);
        setStep(1);
      } else {
        setError(t((data.error || t("adminMisc.platformImport.errorPreviewFailed")) || "") || (data.error || t("adminMisc.platformImport.errorPreviewFailed")));
      }
    } catch {
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
        const response = await fetch("/api/platform/import/execute", {
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
        data = await response.json();
      } catch {
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

  const ctx = {
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
  };

  return <ImportView ctx={ctx} />;
}
