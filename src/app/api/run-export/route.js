import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import { serverError } from "@/lib/apiError";
import writeXlsxFile from "write-excel-file/node";
import { jsPDF } from "jspdf";
import { getRunWithFormName, getRunSubmissions } from "@/models/workspace";

export const dynamic = "force-dynamic";

/**
 * RUN RESPONSES EXPORT
 * GET /api/run-export?id=<runId>&format=xlsx|pdf
 *
 * Downloads the run's responses as a structured file the admin can share
 * manually (email, WhatsApp, Drive...). No share links, no tokens.
 * Admin roles only; read-only fetch.
 */

/** Flatten one submission's data JSONB into { label: displayValue }, skipping internal keys. */
function flattenData(data) {
  const output = {};
  if (!data || typeof data !== "object") return output;
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_")) continue; // internal keys (_scores etc.)
    if (value === null || value === undefined || value === "") continue;
    let display = value;
    if (typeof value === "object") {
      try { display = JSON.stringify(value); } catch { display = String(value); }
    }
    output[key] = String(display);
  }
  return output;
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
    const capError = await requireAuthorization("reports", "export");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("id");
    const format = (searchParams.get("format") || "xlsx").toLowerCase();

    if (!runId) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    if (!["xlsx", "pdf"].includes(format)) {
      return NextResponse.json({ success: false, error: "format must be xlsx or pdf" }, { status: 400 });
    }

    const runResult = await getRunWithFormName(parseInt(runId));
    if (runResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
    }
    const run = runResult.rows[0];

    const submissionsResult = await getRunSubmissions(parseInt(runId));

    // Build structured rows: collect question labels in order of first appearance.
    const flattened = submissionsResult.rows.map((submission) => {
      let data = submission.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { data = {}; }
      }
      return { meta: submission, answers: flattenData(data) };
    });

    const labels = [];
    const seen = new Set();
    for (const entry of flattened) {
      for (const key of Object.keys(entry.answers)) {
        if (!seen.has(key)) { seen.add(key); labels.push(key); }
      }
    }

    const headers = ["Respondent", "Status", "Submitted At", ...labels];
    const rows = flattened.map((entry) => {
      const submissionRow = entry.meta;
      return [
        submissionRow.submitter_name || "—",
        submissionRow.status || "—",
        submissionRow.submitted_at ? new Date(submissionRow.submitted_at).toLocaleString() : "—",
        ...labels.map((label) => entry.answers[label] ?? ""),
      ];
    });

    const filenameBase = `${slugify(run.name)}-responses`;

    if (format === "xlsx") {
      const columns = headers.map((header, index) => ({
        width: index < 3 ? 22 : Math.max(16, Math.min(40, String(header || "").length + 4)),
      }));
      const buffer = await writeXlsxFile([headers, ...rows], {
        sheet: "Responses",
        columns,
      }).toBuffer();

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
        },
      });
    }

    // ─── PDF (report-style, readable without external fonts) ───
    const pdfDocument = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdfDocument.internal.pageSize.getWidth();
    const margin = 48;
    const contentWidth = pageWidth - margin * 2;
    let cursorY = 56;

    pdfDocument.setFont("helvetica", "bold");
    pdfDocument.setFontSize(16);
    pdfDocument.setTextColor(20, 20, 20);
    pdfDocument.text(`Responses — ${run.name}`, margin, cursorY);

    cursorY += 18;
    pdfDocument.setFont("helvetica", "normal");
    pdfDocument.setFontSize(10);
    pdfDocument.setTextColor(110, 110, 110);
    const meta = `${run.form_name || "Form"}  ·  Status: ${run.status || "—"}  ·  ${submissionsResult.rows.length} response(s)  ·  Exported ${new Date().toLocaleString()}`;
    pdfDocument.text(meta, margin, cursorY);
    cursorY += 24;

    const addPageIfNeeded = (needed) => {
      if (cursorY + needed > 792 - margin) {
        pdfDocument.addPage();
        cursorY = 56;
      }
    };

    flattened.forEach((entry, index) => {
      const submissionRow = entry.meta;
      addPageIfNeeded(60);
      pdfDocument.setFont("helvetica", "bold");
      pdfDocument.setFontSize(11);
      pdfDocument.setTextColor(20, 20, 20);
      pdfDocument.text(`Response ${index + 1} — ${submissionRow.submitter_name || "Anonymous"}`, margin, cursorY);
      cursorY += 14;

      pdfDocument.setFont("helvetica", "normal");
      pdfDocument.setFontSize(8.5);
      pdfDocument.setTextColor(130, 130, 130);
      pdfDocument.text(`${submissionRow.status || "—"}  ·  ${submissionRow.submitted_at ? new Date(submissionRow.submitted_at).toLocaleString() : "—"}`, margin, cursorY);
      cursorY += 16;

      const entries = Object.entries(entry.answers);
      if (entries.length === 0) {
        pdfDocument.setTextColor(160, 160, 160);
        pdfDocument.text("No answers.", margin, cursorY);
        cursorY += 16;
      } else {
        entries.forEach(([label, value]) => {
          const lines = pdfDocument.splitTextToSize(`${label}: ${value}`, contentWidth);
          const blockHeight = lines.length * 12 + 4;
          addPageIfNeeded(blockHeight);
          pdfDocument.setFont("helvetica", "bold");
          pdfDocument.setFontSize(9);
          pdfDocument.setTextColor(30, 30, 30);
          pdfDocument.text(`${label}:`, margin, cursorY);
          pdfDocument.setFont("helvetica", "normal");
          pdfDocument.setTextColor(60, 60, 60);
          pdfDocument.text(lines, margin, cursorY + 12);
          cursorY += blockHeight + 2;
        });
      }
      cursorY += 12;
    });

    const pdfBuffer = Buffer.from(pdfDocument.output("arraybuffer"));
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  } catch (error) {
    return serverError(error, { log: "Run export" });
  }
}
