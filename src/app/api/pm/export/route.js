import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import * as XLSX from "xlsx";
import { getProgramExportRows } from "@/models/programWorkspace";

export const dynamic = "force-dynamic";

function jsonToCsv(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const csvRows = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = String(val);
      // Escape commas and quotes
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(values.join(","));
  }
  return csvRows.join("\n");
}

export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("reports", "export");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "participants";
    const programId = searchParams.get("program_id");
    const format = searchParams.get("format") || "csv";

    if (!programId) {
      return NextResponse.json({ error: "program_id required" }, { status: 400 });
    }

    let filename;

    switch (type) {
      case "participants":
        filename = `participants-${programId}.csv`;
        break;
      case "attendance":
        filename = `attendance-${programId}.csv`;
        break;
      case "submissions":
        filename = `submissions-${programId}.csv`;
        break;
      case "teams":
        filename = `teams-${programId}.csv`;
        break;
      case "ical":
        filename = `calendar-${programId}.ics`;
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const result = await getProgramExportRows(type, programId);
    const rows = result.rows;

    if (format === "xlsx" || format === "excel") {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, type);
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const xlsxFilename = filename.replace(/\.csv$/, ".xlsx");
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${xlsxFilename}"`,
          "Cache-Control": "no-cache",
        },
      });
    }

    if (format === "ical" || format === "ics") {
      const icsLines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ImpactOS//Program Calendar//EN"];
      for (const row of rows) {
        if (!row.scheduled_date) continue;
        const dt = new Date(row.scheduled_date);
        const d = dt.toISOString().split("T")[0].replace(/-/g, "");
        const start = (row.start_time || "09:00").replace(/:/g, "") + "00";
        const end = (row.end_time || "12:00").replace(/:/g, "") + "00";
        const tz = row.timezone || "Europe/Paris";
        icsLines.push("BEGIN:VEVENT");
        icsLines.push(`DTSTART;TZID=${tz}:${d}T${start}`);
        icsLines.push(`DTEND;TZID=${tz}:${d}T${end}`);
        icsLines.push(`SUMMARY:${row.summary || "Session"}`);
        if (row.description) icsLines.push(`DESCRIPTION:${row.description.replace(/[,\n]/g, " ")}`);
        icsLines.push("END:VEVENT");
      }
      icsLines.push("END:VCALENDAR");
      const ics = icsLines.join("\r\n");
      return new NextResponse(ics, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-cache",
        },
      });
    }

    if (format === "pdf") {
      // Return JSON for client-side PDF generation via jspdf
      return NextResponse.json({ success: true, rows, type, filename: filename.replace(/\.csv$/, ".pdf") });
    }

    // Default: CSV
    const csv = jsonToCsv(rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("Export error:", e);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
