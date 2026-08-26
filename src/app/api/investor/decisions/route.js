import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";

/** GET /api/investor/decisions — all decisions for current investor */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "view");
    if (capError) return capError;

    const session = await getSession();
    const prof = await db.execute({
      sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
      args: [session.cid || session.id],
    });
    if (prof.rows.length === 0) {
      return NextResponse.json({ success: true, decisions: [], history: [] });
    }

    // All decisions with venture info
    const decisions = await db.execute({
      sql: `SELECT d.*, ip.venture_id, p.name as venture_name, p.industry,
                   ip.stage as pipeline_stage, ip.created_at as pipeline_created
            FROM investment_decisions d
            JOIN investment_pipeline ip ON d.pipeline_id = ip.id
            LEFT JOIN v2_programs p ON ip.venture_id = p.id
            WHERE ip.investor_id = ?
            ORDER BY d.decision_date DESC`,
      args: [prof.rows[0].id],
    });

    // Investment history timeline (all pipeline activity)
    const history = await db.execute({
      sql: `SELECT ip.id, ip.venture_id, p.name as venture_name, ip.stage,
                   ip.stage_changed_at, ip.notes, ip.created_at,
                   d.decision_type, d.investment_amount, d.decision_date
            FROM investment_pipeline ip
            LEFT JOIN v2_programs p ON ip.venture_id = p.id
            LEFT JOIN investment_decisions d ON d.pipeline_id = ip.id
            WHERE ip.investor_id = ?
            ORDER BY ip.stage_changed_at DESC NULLS LAST`,
      args: [prof.rows[0].id],
    });

    // Stats
    const stats = await db.execute({
      sql: `SELECT
              COUNT(*) FILTER (WHERE d.decision_type = 'invest') as total_invested,
              COALESCE(SUM(d.investment_amount) FILTER (WHERE d.decision_type = 'invest'), 0) as total_capital,
              COUNT(*) FILTER (WHERE d.decision_type = 'decline') as total_declined,
              COUNT(*) as total_decisions
            FROM investment_decisions d
            JOIN investment_pipeline ip ON d.pipeline_id = ip.id
            WHERE ip.investor_id = ?`,
      args: [prof.rows[0].id],
    });

    return NextResponse.json({
      success: true,
      decisions: decisions.rows,
      history: history.rows,
      stats: stats.rows[0] || { total_invested: 0, total_capital: 0, total_declined: 0, total_decisions: 0 },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/decisions — record a decision */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "create");
    if (capError) return capError;

    const { pipeline_id, decision_type, investment_amount, decision_notes } = await req.json();

    if (!pipeline_id || !decision_type) {
      return NextResponse.json({ success: false, error: "pipeline_id and decision_type required" }, { status: 400 });
    }

    const valid = ["invest", "decline", "continue_discussions", "revisit_later"];
    if (!valid.includes(decision_type)) {
      return NextResponse.json({ success: false, error: "Invalid decision_type" }, { status: 400 });
    }

    // Record decision
    await db.execute({
      sql: `INSERT INTO investment_decisions (pipeline_id, decision_type, investment_amount, decision_notes)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (pipeline_id) DO UPDATE
            SET decision_type = EXCLUDED.decision_type, investment_amount = EXCLUDED.investment_amount,
                decision_notes = EXCLUDED.decision_notes, decision_date = CURRENT_DATE`,
      args: [pipeline_id, decision_type, investment_amount || null, decision_notes || null],
    });

    // Update pipeline stage
    const stageMap = {
      invest: "invested",
      decline: "declined",
      continue_discussions: "negotiation",
      revisit_later: "watching",
    };

    await db.execute({
      sql: "UPDATE investment_pipeline SET stage = ?, stage_changed_at = NOW(), updated_at = NOW() WHERE id = ?",
      args: [stageMap[decision_type], pipeline_id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
