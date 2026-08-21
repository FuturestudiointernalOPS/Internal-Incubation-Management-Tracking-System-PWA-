import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export const dynamic = "force-dynamic";

/**
 * RUN RESPONSES EXPORT
 * GET /api/run-export?id=<runId>&format=xlsx|pdf
 *
 * Downloads the run's responses as a structured file the admin can share
 * manually (email, WhatsApp, Drive...). No share links, no tokens.
 * Admin roles only; read-only fetch.
 */

const ADMIN_ROLES = ["super_admin", "admin", "program_manager", "staff", "teacher"];

/** Flatten one submission's data JSONB into { label: displayValue }, skipping internal keys. */
function flattenData(data) {
  const out = {};
  if (!data || typeof data !== "object") return out;
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_")) continue; // internal keys (_scores etc.)
    if (value === null || value === undefined || value === "") continue;
    let display = value;
    if (typeof value === "object") {
      try { display = JSON.stringify(value); } catch { display = String(value); }
    }
    out[key] = String(display);
  }
  return out;
}

function slugify(name) {
  return String(name || "responses")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "responses";
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(ADMIN_ROLES);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("id");
    const format = (searchParams.get("format") || "xlsx").toLowerCase();

    if (!runId) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    if (!["xlsx", "pdf"].includes(format)) {
      return NextResponse.json({ success: false, error: "format must be xlsx or pdf" }, { status: 400 });
    }

    const runRes = await db.execute({
      sql: `SELECT r.id, r.name, r.status, f.name AS form_name
            FROM platform_form_runs r LEFT JOIN platform_forms f ON f.id = r.form_id
            WHERE r.id = ?`,
      args: [parseInt(runId)],
    });
    if (runRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
    }
    const run = runRes.rows[0];

    const subRes = await db.execute({
      sql: "SELECT id, submitter_name, status, submitted_at, data FROM platform_form_submissions WHERE run_id = ? ORDER BY submitted_at DESC NULLS LAST",
      args: [parseInt(runId)],
    });

    // Build structured rows: collect question labels in order of first appearance.
    const flattened = subRes.rows.map((s) => {
      let data = s.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { data = {}; }
      }
      return { meta: s, answers: flattenData(data) };
    });

    const labels = [];
    const seen = new Set();
    for (const f of flattened) {
      for (const key of Object.keys(f.answers)) {
        if (!seen.has(key)) { seen.add(key); labels.push(key); }
      }
    }

    const headers = ["Respondent", "Status", "Submitted At", ...labels];
    const rows = flattened.map((f) => {
      const m = f.meta;
      return [
        m.submitter_name || "—",
        m.status || "—",
        m.submitted_at ? new Date(m.submitted_at).toLocaleString() : "—",
        ...labels.map((l) => f.answers[l] ?? ""),
      ];
    });

    const filenameBase = `${slugify(run.name)}-responses`;

    if (format === "xlsx") {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = headers.map((h, i) => ({ wch: i < 3 ? 22 : Math.max(16, Math.min(40, (h || "").length + 4)) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Responses");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
        },
      });
    }

    // ─── PDF (report-style, readable without external fonts) ───
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    const contentW = pageW - margin * 2;
    let y = 56;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(20, 20, 20);
    doc.text(`Responses — ${run.name}`, margin, y);

    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    const meta = `${run.form_name || "Form"}  ·  Status: ${run.status || "—"}  ·  ${subRes.rows.length} response(s)  ·  Exported ${new Date().toLocaleString()}`;
    doc.text(meta, margin, y);
    y += 24;

    const addPageIfNeeded = (needed) => {
      if (y + needed > 792 - margin) {
        doc.addPage();
        y = 56;
      }
    };

    flattened.forEach((f, idx) => {
      const m = f.meta;
      addPageIfNeeded(60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.text(`Response ${idx + 1} — ${m.submitter_name || "Anonymous"}`, margin, y);
      y += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(130, 130, 130);
      doc.text(`${m.status || "—"}  ·  ${m.submitted_at ? new Date(m.submitted_at).toLocaleString() : "—"}`, margin, y);
      y += 16;

      const entries = Object.entries(f.answers);
      if (entries.length === 0) {
        doc.setTextColor(160, 160, 160);
        doc.text("No answers.", margin, y);
        y += 16;
      } else {
        entries.forEach(([label, value]) => {
          const lines = doc.splitTextToSize(`${label}: ${value}`, contentW);
          const blockH = lines.length * 12 + 4;
          addPageIfNeeded(blockH);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(30, 30, 30);
          doc.text(`${label}:`, margin, y);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(60, 60, 60);
          doc.text(lines, margin, y + 12);
          y += blockH + 2;
        });
      }
      y += 12;
    });

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Run export error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
