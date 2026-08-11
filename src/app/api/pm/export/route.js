import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as XLSX from "xlsx";

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
    const authError = await requireAuth(["staff", "super_admin", "program_manager", "teacher"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "participants";
    const programId = searchParams.get("program_id");
    const format = searchParams.get("format") || "csv";

    if (!programId) {
      return NextResponse.json({ error: "program_id required" }, { status: 400 });
    }

    let sql;
    let filename;

    switch (type) {
      case "participants":
        sql = `SELECT name, email, phone, status, created_at FROM v2_participants WHERE program_id = $1 ORDER BY name`;
        filename = `participants-${programId}.csv`;
        break;
      case "attendance":
        sql = `SELECT vp.name, vp.email, va.status as attendance_status, va.date as session_date, va.week_number
               FROM v2_attendance va
               JOIN v2_participants vp ON va.participant_id = vp.user_id
               WHERE va.program_id = $1
               ORDER BY va.date, vp.name`;
        filename = `attendance-${programId}.csv`;
        break;
      case "submissions":
        sql = `SELECT vp.name, vp.email, vdr.title as requirement, vsb.submission_url, vsb.status, vsb.submitted_at
               FROM v2_submissions vsb
               JOIN v2_participants vp ON vsb.participant_id = vp.user_id
               JOIN v2_document_requirements vdr ON vsb.requirement_id = vdr.id
               WHERE vdr.program_id = $1
               ORDER BY vp.name, vsb.submitted_at DESC`;
        filename = `submissions-${programId}.csv`;
        break;
      case "teams":
        sql = `SELECT vt.name as team_name, COUNT(vp.id) as member_count, vt.handler_name
               FROM v2_teams vt
               LEFT JOIN v2_participants vp ON vp.v2_team_id = vt.id
               WHERE vt.program_id = $1
               GROUP BY vt.id, vt.name, vt.handler_name
               ORDER BY vt.name`;
        filename = `teams-${programId}.csv`;
        break;
      case "ical":
        sql = `SELECT vs.title as summary, vs.description, vs.scheduled_date, vs.start_time, vs.end_time, vs.timezone
               FROM v2_sessions vs
               WHERE vs.program_id = $1 AND vs.scheduled_date IS NOT NULL
               ORDER BY vs.scheduled_date`;
        filename = `calendar-${programId}.ics`;
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const result = await db.execute({ sql, args: [programId] });
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
