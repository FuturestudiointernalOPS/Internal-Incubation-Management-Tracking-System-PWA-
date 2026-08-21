import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await initDb();
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const email = (url.searchParams.get("email") || "").toLowerCase().trim();

    if (!token || !email) {
      return NextResponse.json({ success: false, error: "Token and email are required." }, { status: 400 });
    }

    let tokenRow;
    try {
      const tokenRes = await db.execute({
        sql: "SELECT * FROM run_view_tokens WHERE token = ? AND is_active = TRUE LIMIT 1",
        args: [token],
      });
      tokenRow = tokenRes.rows[0];
    } catch (_) {
      return NextResponse.json({ success: false, error: "Invalid or expired link." }, { status: 403 });
    }

    if (!tokenRow) {
      return NextResponse.json({ success: false, error: "Invalid or expired link." }, { status: 403 });
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: "This link has expired." }, { status: 403 });
    }

    let emailAllowed = false;
    try {
      const emailRes = await db.execute({
        sql: "SELECT 1 FROM run_view_token_emails WHERE token_id = ? AND LOWER(email) = ? LIMIT 1",
        args: [tokenRow.id, email],
      });
      emailAllowed = emailRes.rows.length > 0;
    } catch (_) {}

    if (!emailAllowed) {
      return NextResponse.json({ success: false, error: "Your email is not authorized to view this." }, { status: 403 });
    }

    const runRes = await db.execute({
      sql: "SELECT r.id, r.name, r.status, f.name AS form_name FROM platform_form_runs r LEFT JOIN platform_forms f ON f.id = r.form_id WHERE r.id = ?",
      args: [tokenRow.run_id],
    });
    const run = runRes.rows[0];
    if (!run) return NextResponse.json({ success: false, error: "Run not found." }, { status: 404 });

    const subRes = await db.execute({
      sql: "SELECT s.id, s.respondent_name, s.respondent_email, s.submitted_at, s.score, s.is_reviewed, s.review_status FROM platform_form_submissions s WHERE s.run_id = ? ORDER BY s.submitted_at DESC",
      args: [tokenRow.run_id],
    });

    const submissions = [];
    for (const sub of subRes.rows) {
      let answers = [];
      try {
        const ansRes = await db.execute({
          sql: "SELECT a.question_text, a.answer_text, a.score, a.field_type FROM platform_form_answers a WHERE a.submission_id = ? ORDER BY a.id ASC",
          args: [sub.id],
        });
        answers = ansRes.rows;
      } catch (_) {}
      submissions.push({ ...sub, answers });
    }

    return NextResponse.json({
      success: true,
      run: { id: run.id, name: run.name, status: run.status, formName: run.form_name },
      submissions,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
  }
}