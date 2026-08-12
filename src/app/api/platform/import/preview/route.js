import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/platform/import/preview
 * Accepts csv_text + form_id. Parses CSV, fetches form fields, fuzzy-matches
 * columns to field labels (case-insensitive, word overlap scoring).
 * Returns: form_fields, csv_columns, suggested_mapping, unmatched, preview_rows (first 5), total_rows.
 */

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.length === 0 || (cells.length === 1 && cells[0] === "")) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] !== undefined ? cells[idx] : "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function tokenize(str) {
  return (str || "")
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
  for (const t of labelTokens) {
    if (colTokens.has(t)) matches++;
  }
  return matches / labelTokens.length;
}

function fuzzyMatch(columns, fields) {
  const mapping = {};
  const usedFields = new Set();

  for (const col of columns) {
    let bestField = null;
    let bestScore = 0;

    for (const field of fields) {
      if (usedFields.has(field.id)) continue;
      const score = wordOverlapScore(col, field.label);
      if (score > bestScore) {
        bestScore = score;
        bestField = field;
      }
    }

    if (bestField && bestScore >= 0.4) {
      mapping[col] = bestField.id;
      usedFields.add(bestField.id);
    }
  }

  const unmatched = columns.filter((c) => !mapping[c]);
  return { mapping, unmatched };
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "admin"]);
    if (authError) return authError;

    const { csv_text, form_id } = await req.json();
    if (!csv_text || !form_id) {
      return NextResponse.json(
        { success: false, error: "csv_text and form_id are required" },
        { status: 400 }
      );
    }

    // Parse CSV
    let parsed;
    try {
      parsed = parseCSV(csv_text);
    } catch (e) {
      return NextResponse.json(
        { success: false, error: "Failed to parse CSV: " + e.message },
        { status: 400 }
      );
    }

    // Fetch form fields
    const fieldsResult = await db.execute({
      sql: "SELECT id, label, field_type FROM platform_form_fields WHERE form_id::text = ? ORDER BY sort_order",
      args: [String(form_id)],
    });

    const formFields = fieldsResult.rows;

    // Fuzzy match
    const { mapping, unmatched } = fuzzyMatch(parsed.headers, formFields);

    // Build suggested mapping array for response
    const suggestedMapping = parsed.headers.map((col) => ({
      csv_column: col,
      field_id: mapping[col] || null,
      field_label: mapping[col]
        ? formFields.find((f) => f.id === mapping[col])?.label || ""
        : "",
    }));

    // Preview rows (first 5)
    const previewRows = parsed.rows.slice(0, 5);

    return NextResponse.json({
      success: true,
      form_fields: formFields,
      csv_columns: parsed.headers,
      suggested_mapping: suggestedMapping,
      unmatched,
      preview_rows: previewRows,
      total_rows: parsed.rows.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
