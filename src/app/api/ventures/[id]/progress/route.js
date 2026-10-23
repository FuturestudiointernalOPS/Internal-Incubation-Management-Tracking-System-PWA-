import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { computeRoadmapReadiness } from "@/services/ventures/readiness";
import { reconcileMilestonesFromWork } from "@/services/ventures/milestoneEngine";
import {
  countVentureCustomerInterviews,
  countVentureDocumentsByVentureId,
  countVentureFoundersForVenture,
  countVenturePmfAssessments,
  countVentureRetrosByVentureId,
  countVentureStandupsByVentureId,
  countVentureValidations,
  countVentureMilestonesByStatus,
  getFirstVentureBusinessModelId,
  getVentureDbIdForProgress,
  getVentureProfileFields,
} from "@/models/ventureWorkspace";

const ROLES = ["member","staff","program_manager","super_admin"];

async function resolveVentureDbId(ventureId) {
  const ventureResult = await getVentureDbIdForProgress(ventureId);
  return ventureResult.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params;
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    // The roadmap engine owns the counting (an approved deliverable finishes the
    // task it belongs to), so this widget and the Investment Readiness screen
    // cannot disagree. Completion statuses stay defined once in lib/ventureStatuses.
    // Statuses follow the work first, so the milestone counts below are current.
    await reconcileMilestonesFromWork({ dbId });
    const roadmap = await computeRoadmapReadiness({ dbId, code: id });
    const total = roadmap.counts.tasks.total;
    const done = roadmap.counts.tasks.completed;

    // Milestones COMPLETED: the honest figure (a stored `progress` column is
    // only refreshed when a deliverable is reviewed, so it goes stale, and the
    // old average was retired from the dashboard in WS4).
    const milestoneCountsResult = await countVentureMilestonesByStatus(dbId);
    const milestoneCounts = milestoneCountsResult.rows?.[0] || { total: 0, done: 0 };

    const standupsResult = await countVentureStandupsByVentureId(dbId);
    const retrosResult = await countVentureRetrosByVentureId(dbId);

    // VENTURE SETUP — how much of the Venture's own record is filled in.
    //
    // This is deliberately NOT "profile completeness": the startup-profile
    // wizard was retired (WS4) because nothing wrote its table. Every input
    // below is a real Venture record, so the figure moves when the founder
    // actually sets the Venture up.
    // Each optional probe degrades to "nothing recorded" instead of taking the
    // whole score down. A missing table or a column-type mismatch used to turn
    // the entire read into an error, which the screen drew as « — » forever.
    const [venture, founders, docs, businessModel, discovery, validations, pmf] = await Promise.all([
      getVentureProfileFields(dbId).catch(() => ({ rows: [] })),
      countVentureFoundersForVenture(id, dbId).catch(() => ({ rows: [] })),
      countVentureDocumentsByVentureId(dbId).catch(() => ({ rows: [] })),
      getFirstVentureBusinessModelId(dbId).catch(() => ({ rows: [] })),
      countVentureCustomerInterviews(dbId).catch(() => ({ rows: [] })),
      countVentureValidations(dbId).catch(() => ({ rows: [] })),
      countVenturePmfAssessments(dbId).catch(() => ({ rows: [] })),
    ]);

    const ventureRow = venture.rows?.[0] || {};
    let profileScore = 0;
    if (ventureRow.name) profileScore += 10;
    if (ventureRow.description) profileScore += 10;
    if (ventureRow.mission) profileScore += 5;
    if (ventureRow.vision) profileScore += 5;
    if (ventureRow.industry) profileScore += 10;
    if (ventureRow.sector) profileScore += 5;
    if (ventureRow.business_stage) profileScore += 5;
    if (ventureRow.website) profileScore += 5;
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
    const ventureSetup = Math.min(profileScore, 100);

    return NextResponse.json({
      success: true,
      progress: {
        task_completion: total > 0 ? Math.round((done/total)*100) : 0,
        total_tasks: total,
        completed_tasks: done,
        milestones: {
          total: parseInt(milestoneCounts.total || 0),
          completed: parseInt(milestoneCounts.done || 0),
          // How much of the milestones' own work (approved deliverables) is done,
          // even before a milestone is signed off.
          progress_percent: roadmap.components.milestones,
        },
        standups_count: parseInt(standupsResult.rows?.[0]?.count||0),
        retros_count: parseInt(retrosResult.rows?.[0]?.count||0),
        venture_setup: ventureSetup,
      }
    });
  } catch(error) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}
