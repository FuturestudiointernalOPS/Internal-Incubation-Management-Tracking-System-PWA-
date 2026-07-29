import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant","staff","program_manager","super_admin","teacher","developer"];

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const tasksRes = await db.execute({ sql: "SELECT COUNT(*) as total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done FROM venture_tasks WHERE venture_id = ?", args: [dbId] });
    const total = parseInt(tasksRes.rows?.[0]?.total||0);
    const done = parseInt(tasksRes.rows?.[0]?.done||0);

    const milestonesRes = await db.execute({ sql: "SELECT AVG(progress) as avg_progress FROM venture_milestones WHERE venture_id = ?", args: [dbId] });

    const standupsRes = await db.execute({ sql: "SELECT COUNT(*) as count FROM venture_standups WHERE venture_id = ?", args: [dbId] });
    const retrosRes = await db.execute({ sql: "SELECT COUNT(*) as count FROM venture_retros WHERE venture_id = ?", args: [dbId] });

    // Profile completion calculation (UAT weighted)
    const [venture, founders, docs, businessModel, discovery, validations, pmf] = await Promise.all([
      db.execute({ sql: "SELECT name, description, mission, vision, industry, sector, business_stage, website FROM ventures WHERE id = ?", args: [dbId] }),
      db.execute({ sql: "SELECT COUNT(*) as count FROM venture_members WHERE venture_id = ? AND member_type = 'founder' AND removed_at IS NULL", args: [dbId] }),
      db.execute({ sql: "SELECT COUNT(*) as count FROM venture_documents WHERE venture_id = ? AND is_deleted = false", args: [dbId] }),
      db.execute({ sql: "SELECT id FROM venture_business_models WHERE venture_id = ? LIMIT 1", args: [dbId] }),
      db.execute({ sql: "SELECT COUNT(*) as count FROM venture_customer_interviews WHERE venture_id = ?", args: [dbId] }),
      db.execute({ sql: "SELECT COUNT(*) as count FROM venture_validations WHERE venture_id = ?", args: [dbId] }),
      db.execute({ sql: "SELECT COUNT(*) as count FROM venture_pmf_assessments WHERE venture_id = ?", args: [dbId] }),
    ]);

    const v = venture.rows?.[0] || {};
    let profileScore = 0;
    if (v.name) profileScore += 10;
    if (v.description) profileScore += 10;
    if (v.mission) profileScore += 5;
    if (v.vision) profileScore += 5;
    if (v.industry) profileScore += 10;
    if (v.sector) profileScore += 5;
    if (v.business_stage) profileScore += 5;
    if (v.website) profileScore += 5;
    // Founders: 15%
    const founderCount = parseInt(founders.rows?.[0]?.count||0);
    if (founderCount >= 2) profileScore += 15;
    else if (founderCount === 1) profileScore += 8;
    // Documents: up to 15%
    const docCount = parseInt(docs.rows?.[0]?.count||0);
    profileScore += Math.min(docCount * 5, 15);
    // Business Model: 10%
    if (businessModel.rows?.length > 0) profileScore += 10;
    // Customer Discovery: 5%
    const discoveryCount = parseInt(discovery.rows?.[0]?.count||0);
    if (discoveryCount >= 2) profileScore += 5;
    else if (discoveryCount === 1) profileScore += 3;
    // Validation: 5%
    const validationCount = parseInt(validations.rows?.[0]?.count||0);
    if (validationCount >= 3) profileScore += 5;
    else if (validationCount > 0) profileScore += Math.round(validationCount * 5 / 3);
    // PMF: 5%
    if (parseInt(pmf.rows?.[0]?.count||0) > 0) profileScore += 5;
    const profileCompletion = Math.min(profileScore, 100);

    return NextResponse.json({
      success: true,
      progress: {
        task_completion: total > 0 ? Math.round((done/total)*100) : 0,
        total_tasks: total,
        completed_tasks: done,
        avg_milestone_progress: Math.round(parseFloat(milestonesRes.rows?.[0]?.avg_progress||0)),
        standups_count: parseInt(standupsRes.rows?.[0]?.count||0),
        retros_count: parseInt(retrosRes.rows?.[0]?.count||0),
        profile_completion: profileCompletion,
      }
    });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
