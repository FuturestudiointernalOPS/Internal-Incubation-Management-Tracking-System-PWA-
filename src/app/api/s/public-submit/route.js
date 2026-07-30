import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";

/**
 * POST /api/s/public-submit
 * Public endpoint — accepts form submissions without auth.
 * 
 * Security:
 * - Only active runs accepted
 * - Deadline enforced
 * - Max 100KB payload
 * - Duplicate detection by email
 */
export async function POST(req) {
  try {
    await initDb();
    
    // Rate limit: check content-length
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > 100000) {
      return NextResponse.json({ success: false, error: "Payload too large" }, { status: 413 });
    }

    const body = await req.json();
    let { run_id, data, slug } = body;
    
    // Resolve slug to ID if provided
    if (slug && !run_id) {
      const runBySlug = await db.execute({
        sql: "SELECT id FROM platform_form_runs WHERE public_slug = ? AND status = 'active'",
        args: [slug],
      });
      if (runBySlug.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
      }
      run_id = runBySlug.rows[0].id;
    }
    if (!run_id || !data || typeof data !== "object") {
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

    // Find submitter identity from form fields
    let submitterName = "Anonymous";
    let submitterEmail = null;
    if (typeof data === "object") {
      for (const [key, value] of Object.entries(data)) {
        const k = String(key).toLowerCase();
        const v = String(value);
        if ((k.includes("name") || k.includes("full")) && submitterName === "Anonymous") submitterName = v.substring(0, 200);
        if (k.includes("email") && !submitterEmail) submitterEmail = v.substring(0, 200);
      }
    }
    const submitterId = submitterEmail || "public-" + Date.now();

    // Prevent duplicate submissions by same email
    if (submitterEmail) {
      const existing = await db.execute({
        sql: "SELECT id FROM platform_form_submissions WHERE run_id = ? AND submitter_id = ?",
        args: [parseInt(run_id), submitterEmail],
      });
      if (existing.rows.length > 0) {
        return NextResponse.json({ success: false, error: "You have already submitted this form" }, { status: 409 });
      }
    }

    // Insert submission
    const result = await db.execute({
      sql: `INSERT INTO platform_form_submissions (run_id, submitter_id, submitter_name, status, data, submitted_at)
            VALUES (?, ?, ?, 'submitted', ?, NOW()) RETURNING id`,
      args: [parseInt(run_id), submitterId, submitterName, JSON.stringify(data)],
    });

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    return NextResponse.json({ success: false, error: "An error occurred" }, { status: 500 });
  }
}
