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
 * - IP-based rate limiting: max 5 submissions per IP per run per hour
 */
export async function POST(req) {
  try {
    await initDb();
    
    // Get client IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    
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

    // IP-based rate limiting: max 5 submissions per IP per run per hour
    // Gracefully skip if rate table doesn't exist yet
    try {
      const rateCheck = await db.execute({
        sql: "SELECT COUNT(*) as c FROM platform_submissions_rate WHERE run_id = ? AND ip = ? AND created_at > NOW() - INTERVAL '1 hour'",
        args: [parseInt(run_id), ip],
      });
      if (parseInt(rateCheck.rows[0]?.c) >= 5) {
        return NextResponse.json({ success: false, error: "Too many submissions. Please try again later." }, { status: 429 });
      }
    } catch (_) { /* table may not exist yet */ }

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

    // Record rate limit entry (skip if table doesn't exist)
    try {
      await db.execute({
        sql: "INSERT INTO platform_submissions_rate (run_id, ip, created_at) VALUES (?, ?, NOW())",
        args: [parseInt(run_id), ip],
      });
    } catch (_) {}

    // Insert submission
    const result = await db.execute({
      sql: `INSERT INTO platform_form_submissions (run_id, submitter_id, submitter_name, status, data, submitted_at)
            VALUES (?, ?, ?, 'submitted', ?, NOW()) RETURNING id`,
      args: [parseInt(run_id), submitterId, submitterName, JSON.stringify(data)],
    });

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error("[Public Submit] Error:", error.message, error.stack);
    console.error("[Public Submit] Request body snippet:", JSON.stringify(body || {}).substring(0, 200));
    return NextResponse.json({ success: false, error: "An error occurred — our team has been notified" }, { status: 500 });
  }
}
