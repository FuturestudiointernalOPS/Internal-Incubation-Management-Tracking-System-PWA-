import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";

/**
 * POST /api/s/public-submit
 * Public endpoint — accepts form submissions without auth.
 * Body: { run_id, data: { fieldLabel: value, ... } }
 */
export async function POST(req) {
  try {
    await initDb();
    const { run_id, data } = await req.json();
    if (!run_id || !data) {
      return NextResponse.json({ success: false, error: "run_id and data required" }, { status: 400 });
    }

    // Verify run exists and is active
    const run = await db.execute({
      sql: "SELECT * FROM platform_form_runs WHERE id = ? AND status = 'active'",
      args: [parseInt(run_id)],
    });
    if (run.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Run not found or not active" }, { status: 404 });
    }

    // Check deadline
    if (run.rows[0].closes_at && new Date(run.rows[0].closes_at) < new Date()) {
      return NextResponse.json({ success: false, error: "Submission deadline has passed" }, { status: 400 });
    }

    // Find submitter identity from form fields (name/email)
    let submitterName = "Anonymous";
    let submitterId = "public-" + Date.now();
    if (typeof data === "object") {
      for (const [key, value] of Object.entries(data)) {
        const k = String(key).toLowerCase();
        if ((k.includes("name") || k.includes("full")) && !submitterName) submitterName = String(value);
        if (k.includes("email") && submitterId.startsWith("public-")) submitterId = String(value);
      }
    }

    // Insert submission
    const result = await db.execute({
      sql: `INSERT INTO platform_form_submissions (run_id, submitter_id, submitter_name, status, data, submitted_at)
            VALUES (?, ?, ?, 'submitted', ?, NOW()) RETURNING *`,
      args: [parseInt(run_id), submitterId, submitterName, JSON.stringify(data)],
    });

    return NextResponse.json({ success: true, submission: { id: result.rows[0].id } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
