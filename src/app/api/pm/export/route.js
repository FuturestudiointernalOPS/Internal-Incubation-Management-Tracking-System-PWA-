import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { buildProgramExport } from "@/services/programs/export";

export const dynamic = "force-dynamic";

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

    // Record scope: `reports.export` says WHAT may be read; the exported rows are
    // participant data, so a delegated holder must be staffed on that program.
    const scopeError = await requireProgramScope({ programId, wave: "content" });
    if (scopeError) return scopeError;

    const out = await buildProgramExport({ type, programId, format });
    if (out.json) return NextResponse.json(out.json, { status: out.status });

    return new NextResponse(out.body, {
      status: out.status,
      headers: {
        "Content-Type": out.contentType,
        "Content-Disposition": out.contentDisposition,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
