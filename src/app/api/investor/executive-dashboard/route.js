import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const q = async (sql) => (await db.execute({ sql, args: [] })).rows;

    const [investors, ventures, fundraising, relationships, pipeline, topInvestors, sectorDemand, campaignPerf] = await Promise.all([
      q(`SELECT (SELECT COUNT(*) FROM investor_profiles WHERE approval_status='approved')::int as total_verified, (SELECT COUNT(*) FROM investor_profiles WHERE approval_status='pending_review')::int as total_pending, (SELECT COUNT(*) FROM investor_profiles)::int as total_registered`),
      q(`SELECT (SELECT COUNT(*) FROM v2_programs WHERE status='active' AND is_archived=0)::int as active_ventures, (SELECT COUNT(*) FROM fundraising_campaigns WHERE status='active')::int as active_campaigns`),
      q(`SELECT COALESCE(SUM(target_raise),0)::float as total_sought, COALESCE(SUM(current_raised),0)::float as total_raised, (SELECT COALESCE(SUM(investment_amount),0)::float FROM investment_decisions WHERE decision_type='invest') as total_committed FROM fundraising_campaigns`),
      q(`SELECT (SELECT COUNT(*) FROM relationship_workspaces WHERE status='active')::int as active_relationships, (SELECT COUNT(*) FROM relationship_meetings WHERE status='completed')::int as meetings_completed, (SELECT COUNT(*) FROM investment_pipeline WHERE stage='invested')::int as total_invested`),
      q(`SELECT stage, COUNT(*)::int as count FROM investment_pipeline GROUP BY stage ORDER BY count DESC`),
      q(`SELECT c.name, (SELECT COUNT(*) FROM investment_pipeline WHERE investor_id = ip.id)::int as pipeline_count, (SELECT COUNT(*) FROM investment_pipeline WHERE investor_id = ip.id AND stage='invested')::int as invested_count FROM investor_profiles ip JOIN contacts c ON ip.user_id = c.cid WHERE ip.approval_status='approved' ORDER BY pipeline_count DESC LIMIT 5`),
      q(`SELECT p.industry, COUNT(ip.id)::int as interest_count FROM v2_programs p LEFT JOIN investment_pipeline ip ON ip.venture_id = p.id WHERE p.status='active' AND p.is_archived=0 AND p.industry IS NOT NULL GROUP BY p.industry ORDER BY interest_count DESC LIMIT 6`),
      q(`SELECT p.name as venture_name, p.industry, fc.target_raise, fc.current_raised, CASE WHEN fc.target_raise > 0 THEN ROUND((fc.current_raised / fc.target_raise) * 100) ELSE 0 END as pct FROM fundraising_campaigns fc LEFT JOIN v2_programs p ON fc.venture_id = p.id WHERE fc.status = 'active' ORDER BY pct DESC LIMIT 10`),
    ]);

    return NextResponse.json({ success: true, investors: investors[0], ventures: ventures[0], fundraising: fundraising[0], relationships: relationships[0], pipeline, topInvestors, sectorDemand, campaignPerformance: campaignPerf });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
