import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/** GET /api/investor/admin-overview — super admin DD/pipeline overview */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const [workspaces, pipelines, stats, requests] = await Promise.all([
      db.execute({ sql: `SELECT dw.*, ip.venture_id, ip.stage, ipr.organization_name, c.name as investor_name, c.email as investor_email, p.name as venture_name FROM due_diligence_workspaces dw JOIN investment_pipeline ip ON dw.pipeline_id = ip.id LEFT JOIN investor_profiles ipr ON ip.investor_id = ipr.id LEFT JOIN contacts c ON ipr.user_id = c.cid LEFT JOIN v2_programs p ON ip.venture_id = p.id ORDER BY dw.updated_at DESC`, args: [] }),
      db.execute({ sql: `SELECT ip.*, ipr.organization_name, c.name as investor_name, c.email, p.name as venture_name, d.decision_type, d.investment_amount, d.decision_date FROM investment_pipeline ip LEFT JOIN investor_profiles ipr ON ip.investor_id = ipr.id LEFT JOIN contacts c ON ipr.user_id = c.cid LEFT JOIN v2_programs p ON ip.venture_id = p.id LEFT JOIN investment_decisions d ON d.pipeline_id = ip.id WHERE ip.stage IN ('invested','negotiation','due_diligence','meeting_requested') ORDER BY ip.stage_changed_at DESC`, args: [] }),
      db.execute({ sql: `SELECT (SELECT COUNT(*) FROM investor_profiles WHERE approval_status='approved')::int as approved_investors, (SELECT COUNT(*) FROM investor_profiles WHERE approval_status='pending_review')::int as pending_investors, (SELECT COUNT(*) FROM due_diligence_workspaces WHERE status='active')::int as active_dd, (SELECT COUNT(*) FROM investment_pipeline WHERE stage='invested')::int as total_invested`, args: [] }),
      db.execute({ sql: `SELECT r.*, dw.pipeline_id, ip.venture_id, p.name as venture_name, ipr.organization_name, c.name as investor_name FROM dd_information_requests r JOIN due_diligence_workspaces dw ON r.workspace_id = dw.id JOIN investment_pipeline ip ON dw.pipeline_id = ip.id LEFT JOIN investor_profiles ipr ON ip.investor_id = ipr.id LEFT JOIN contacts c ON ipr.user_id = c.cid LEFT JOIN v2_programs p ON ip.venture_id = p.id ORDER BY r.created_at DESC LIMIT 50`, args: [] }),
    ]);

    return NextResponse.json({
      success: true,
      workspaces: workspaces.rows,
      pipelines: pipelines.rows,
      stats: stats.rows[0],
      requests: requests.rows,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
