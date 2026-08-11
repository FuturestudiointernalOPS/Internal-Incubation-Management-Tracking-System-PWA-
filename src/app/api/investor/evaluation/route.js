import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

/**
 * GET /api/investor/evaluation?pipeline_id=X
 * Returns founder evaluations + risk assessments for a pipeline.
 *
 * POST /api/investor/evaluation
 * Body: { pipeline_id, type: "founder"|"risk", ...fields }
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const pipelineId = searchParams.get("pipeline_id");
    if (!pipelineId) return NextResponse.json({ success: false, error: "pipeline_id required" }, { status: 400 });

    const [founders, risks] = await Promise.all([
      db.execute({ sql: "SELECT * FROM founder_evaluations WHERE pipeline_id = ? ORDER BY created_at DESC", args: [pipelineId] }),
      db.execute({ sql: "SELECT * FROM risk_assessments WHERE pipeline_id = ? ORDER BY severity DESC, created_at DESC", args: [pipelineId] }),
    ]);

    return NextResponse.json({
      success: true,
      founder_evaluations: founders.rows,
      risk_assessments: risks.rows,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const { pipeline_id, type, ...fields } = body;

    if (!pipeline_id || !type) {
      return NextResponse.json({ success: false, error: "pipeline_id and type required" }, { status: 400 });
    }

    if (type === "founder") {
      const { founder_name, role, experience_score, leadership_score, domain_expertise_score, overall_rating, notes } = fields;
      if (!founder_name) return NextResponse.json({ success: false, error: "founder_name required" }, { status: 400 });

      const result = await db.execute({
        sql: `INSERT INTO founder_evaluations (pipeline_id, founder_name, role, experience_score, leadership_score, domain_expertise_score, overall_rating, notes, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
        args: [pipeline_id, founder_name, role||null, experience_score||0, leadership_score||0, domain_expertise_score||0, overall_rating||0, notes||null, session.cid||session.id],
      });
      return NextResponse.json({ success: true, evaluation: result.rows[0] });
    }

    if (type === "risk") {
      const { risk_category, risk_description, severity, mitigation, status } = fields;
      if (!risk_category || !risk_description) return NextResponse.json({ success: false, error: "risk_category and risk_description required" }, { status: 400 });

      const result = await db.execute({
        sql: `INSERT INTO risk_assessments (pipeline_id, risk_category, risk_description, severity, mitigation, status, created_by)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT (pipeline_id, risk_category) DO UPDATE
              SET risk_description = EXCLUDED.risk_description, severity = EXCLUDED.severity,
                  mitigation = EXCLUDED.mitigation, status = EXCLUDED.status, updated_at = NOW()
              RETURNING *`,
        args: [pipeline_id, risk_category, risk_description, severity||"medium", mitigation||null, status||"open", session.cid||session.id],
      });
      return NextResponse.json({ success: true, evaluation: result.rows[0] });
    }

    return NextResponse.json({ success: false, error: "Invalid type. Use 'founder' or 'risk'" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
