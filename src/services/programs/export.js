/**
 * Programs — program exports (SERVICE layer).
 *
 * The domain work behind `/api/pm/export`: which export types exist, each type's
 * filename, and the serialisation of the rows into their target format (CSV,
 * Excel, iCalendar or the client-side-PDF JSON). The CONTROLLER keeps the
 * capability/scope gates and turns the descriptor into an HTTP answer with the
 * right headers.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and shaping, no SQL, no HTTP. It
 * reads through `@/models/**` and returns a descriptor the controller renders.
 */

import writeXlsxFile from "write-excel-file/node";
import { objectsToAoa } from "@/lib/spreadsheet";
import { getProgramExportRows } from "@/models/programWorkspace";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The download filename for an export type, or null when the type is unknown. */
function exportFilename(type, programId) {
  switch (type) {
    case "participants":
      return `participants-${programId}.csv`;
    case "attendance":
      return `attendance-${programId}.csv`;
    case "submissions":
      return `submissions-${programId}.csv`;
    case "teams":
      return `teams-${programId}.csv`;
    case "ical":
      return `calendar-${programId}.ics`;
    default:
      return null;
  }
}

/** Rows as a CSV document (RFC-4180 quoting for commas, quotes and newlines). */
function jsonToCsv(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const csvRows = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((header) => {
      const cellValue = row[header];
      if (cellValue === null || cellValue === undefined) return "";
      const stringValue = String(cellValue);
      // Escape commas and quotes
      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(","));
  }
  return csvRows.join("\n");
}

/** Rows that carry a scheduled date, as an iCalendar document. */
function buildIcs(rows) {
  const icsLines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ImpactOS//Program Calendar//EN"];
  for (const row of rows) {
    if (!row.scheduled_date) continue;
    const dt = new Date(row.scheduled_date);
    const datePart = dt.toISOString().split("T")[0].replace(/-/g, "");
    const start = (row.start_time || "09:00").replace(/:/g, "") + "00";
    const end = (row.end_time || "12:00").replace(/:/g, "") + "00";
    const tz = row.timezone || "Europe/Paris";
    icsLines.push("BEGIN:VEVENT");
    icsLines.push(`DTSTART;TZID=${tz}:${datePart}T${start}`);
    icsLines.push(`DTEND;TZID=${tz}:${datePart}T${end}`);
    icsLines.push(`SUMMARY:${row.summary || "Session"}`);
    if (row.description) icsLines.push(`DESCRIPTION:${row.description.replace(/[,\n]/g, " ")}`);
    icsLines.push("END:VEVENT");
  }
  icsLines.push("END:VCALENDAR");
  return icsLines.join("\r\n");
}

/**
 * Build a program export.
 *
 * @returns {Promise<{status: number, json?: Object, contentType?: string,
 *   contentDisposition?: string, body?: any}>}
 *   `json` carries a JSON answer; otherwise `body` is the file bytes with the
 *   given content type and disposition.
 */
export async function buildProgramExport({ type, programId, format }) {
  const filename = exportFilename(type, programId);
  if (!filename) return { status: 400, json: { error: "Invalid type" } };

  const result = await getProgramExportRows(type, programId);
  const rows = result.rows;

  if (format === "xlsx" || format === "excel") {
    const buffer = await writeXlsxFile(objectsToAoa(rows), { sheet: type }).toBuffer();
    return {
      status: 200,
      contentType: XLSX_MIME,
      contentDisposition: `attachment; filename="${filename.replace(/\.csv$/, ".xlsx")}"`,
      body: buffer,
    };
  }

  if (format === "ical" || format === "ics") {
    return {
      status: 200,
      contentType: "text/calendar; charset=utf-8",
      contentDisposition: `attachment; filename="${filename}"`,
      body: buildIcs(rows),
    };
  }

  if (format === "pdf") {
    // Return JSON for client-side PDF generation via jspdf.
    return {
      status: 200,
      json: { success: true, rows, type, filename: filename.replace(/\.csv$/, ".pdf") },
    };
  }

  return {
    status: 200,
    contentType: "text/csv; charset=utf-8",
    contentDisposition: `attachment; filename="${filename}"`,
    body: jsonToCsv(rows),
  };
}
