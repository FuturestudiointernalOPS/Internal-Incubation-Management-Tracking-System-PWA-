import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { parseCSVRows } from "@/lib/csv";
import {
  getFormRunByIdForPreview,
  getPlatformFormById,
  getFormFieldsForPreview,
} from "@/models/platformImport";

/**
 * POST /api/platform/import/preview
 * Accepts csv_text + form_id. Parses CSV, fetches form fields, fuzzy-matches
 * columns to field labels (case-insensitive, word overlap scoring).
 * Returns: form_fields, csv_columns, suggested_mapping, unmatched, preview_rows (first 5), total_rows.
 */

function parseCSV(text) {
  // RFC 4180-aware: quoted cells may contain commas and embedded newlines,
  // so logical rows are derived from the parser, never from physical lines.
  const grid = parseCSVRows(text);
  if (grid.length === 0) return { headers: [], rows: [] };
  const headers = (grid[0] || []).map((header) => header.trim());
  const rows = [];
  for (let rowIndex = 1; rowIndex < grid.length; rowIndex++) {
    const cells = grid[rowIndex];
    if (cells.length === 0 || (cells.length === 1 && cells[0] === "")) continue;
    const row = {};
    headers.forEach((header, columnIndex) => {
      row[header] = cells[columnIndex] !== undefined ? cells[columnIndex].trim() : "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Accept either legacy CSV text or normalized headers + rows (both CSV and
 * XLSX arrive from the client as the same row-object shape). Returns the
 * canonical { headers, rows } used by the rest of the preview flow.
 */
function normalizeInput({ csv_text, headers, rows }) {
  if (Array.isArray(rows) && rows.length > 0) {
    const headerList =
      Array.isArray(headers) && headers.length > 0
        ? headers
        : Object.keys(rows[0] || {});
    const normalizedRows = rows.map((sourceRow) => {
      const row = {};
      headerList.forEach((header) => {
        row[header] = sourceRow[header] != null ? String(sourceRow[header]).trim() : "";
      });
      return row;
    });
    return { headers: headerList, rows: normalizedRows };
  }
  return parseCSV(csv_text || "");
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function wordOverlapScore(colName, fieldLabel) {
  const colTokens = new Set(tokenize(colName));
  const labelTokens = tokenize(fieldLabel);
  if (labelTokens.length === 0) return 0;
  let matches = 0;
  for (const token of labelTokens) {
    if (colTokens.has(token)) matches++;
  }
  return matches / labelTokens.length;
}

function fuzzyMatch(columns, fields) {
  const mapping = {};
  const usedFields = new Set();

  for (const column of columns) {
    let bestField = null;
    let bestScore = 0;

    for (const field of fields) {
      if (usedFields.has(field.id)) continue;
      const score = wordOverlapScore(column, field.label);
      if (score > bestScore) {
        bestScore = score;
        bestField = field;
      }
    }

    if (bestField && bestScore >= 0.4) {
      mapping[column] = bestField.id;
      usedFields.add(bestField.id);
    }
  }

  const unmatched = columns.filter((column) => !mapping[column]);
  return { mapping, unmatched };
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { csv_text, headers: inputHeaders, rows: inputRows, form_id, run_id, total_rows } = await req.json();
    if (!csv_text || (!form_id && !run_id)) {
      return NextResponse.json(
        { success: false, error: "csv_text and form_id (or run_id) are required" },
        { status: 400 }
      );
    }

    // Parse the file payload — legacy CSV text or normalized headers+rows
    // (CSV and XLSX both arrive pre-parsed from the client in row form).
    let parsed;
    try {
      parsed = normalizeInput({ csv_text, headers: inputHeaders, rows: inputRows });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "Failed to parse file: " + error.message },
        { status: 400 }
      );
    }

    // ── Resolve the authoritative form by tracing Run → Form ──
    // When a run is selected, its form is the single source of truth — the
    // client-passed form_id is ignored so questions can never come from a
    // different form than the run being imported into.
    let effectiveFormId = form_id != null ? String(form_id) : null;
    let runInfo = null;
    let formInfo = null;

    if (run_id) {
      const runResult = await getFormRunByIdForPreview(run_id);
      if (runResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Selected run not found" },
          { status: 404 }
        );
      }
      runInfo = runResult.rows[0];
      effectiveFormId = String(runInfo.form_id);
    }

    if (!effectiveFormId) {
      return NextResponse.json(
        { success: false, error: "Could not determine the form" },
        { status: 400 }
      );
    }

    const formResult = await getPlatformFormById(effectiveFormId);
    if (formResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Form not found for the selected run" },
        { status: 404 }
      );
    }
    formInfo = formResult.rows[0];

    // ── Fetch THIS form's questions AND their configured answer options ──
    const fieldsResult = await getFormFieldsForPreview(effectiveFormId);

    const formFields = fieldsResult.rows.map((formField) => {
      let options = null;
      if (formField.options) {
        try {
          options = typeof formField.options === "string" ? JSON.parse(formField.options) : formField.options;
        } catch (_) {
          options = null;
        }
      }
      return {
        id: formField.id,
        label: formField.label,
        field_type: formField.field_type,
        options: Array.isArray(options) ? options : null,
        required: !!formField.required,
      };
    });

    // Fuzzy match
    const { mapping, unmatched } = fuzzyMatch(parsed.headers, formFields);

    // Build suggested mapping array for response
    const suggestedMapping = parsed.headers.map((column) => ({
      csv_column: column,
      field_id: mapping[column] || null,
      field_label: mapping[column]
        ? formFields.find((formField) => formField.id === mapping[column])?.label || ""
        : "",
    }));

    // Preview rows (first 5)
    const previewRows = parsed.rows.slice(0, 5);

    return NextResponse.json({
      success: true,
      form: { id: formInfo.id, name: formInfo.name },
      run: runInfo ? { id: runInfo.id, name: runInfo.name } : null,
      form_fields: formFields,
      form_field_count: formFields.length,
      csv_columns: parsed.headers,
      suggested_mapping: suggestedMapping,
      unmatched,
      preview_rows: previewRows,
      // Chunked clients send only a sample of the CSV but know the real count;
      // prefer their number so the UI shows the actual row total.
      total_rows:
        Number.isFinite(Number(total_rows)) && Number(total_rows) > parsed.rows.length
          ? Number(total_rows)
          : parsed.rows.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
