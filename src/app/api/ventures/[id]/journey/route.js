import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { notifyVentureFounders } from "@/lib/ventures";

const ROLES = ["participant","staff","program_manager","super_admin","teacher","developer"];
const PRIVILEGED = ["staff","program_manager","super_admin","developer"];

const STANDARD_STAGES = [
  { name: "Complete Venture Profile", order: 1, description: "Fill in all venture information, upload logo, add founders" },
  { name: "Define the Problem", order: 2, description: "Clearly articulate the problem you are solving" },
  { name: "Validate the Idea", order: 3, description: "Confirm the problem exists and people care" },
  { name: "Identify Target Customers", order: 4, description: "Define who your first customers will be" },
  { name: "Develop Business Model Canvas", order: 5, description: "Map out your business model" },
  { name: "Define Value Proposition", order: 6, description: "Articulate your unique value" },
  { name: "Conduct Market Research", order: 7, description: "Research competitors and market size" },
  { name: "Build Brand Identity", order: 8, description: "Create brand name, logo, visual identity" },
  { name: "Prepare Pitch Deck", order: 9, description: "Create investor-ready pitch deck" },
  { name: "Develop Go-to-Market Strategy", order: 10, description: "Plan your launch and customer acquisition" },
  { name: "Build MVP", order: 11, description: "Create minimum viable product" },
  { name: "Acquire First Customers", order: 12, description: "Get your first paying customers" },
  { name: "Validate Product-Market Fit", order: 13, description: "Confirm strong market pull" },
  { name: "Prepare Investment Readiness", order: 14, description: "Organize all required documents" },
  { name: "Become Investment Ready", order: 15, description: "All checks passed, ready for investors" },
  { name: "Investor Introductions", order: 16, description: "Get introduced to potential investors" },
  { name: "Fundraising Preparation", order: 17, description: "Prepare fundraising materials and strategy" },
  { name: "Seed Funding", order: 18, description: "Secure seed funding round" },
  { name: "Customer Growth", order: 19, description: "Scale customer acquisition and retention" },
  { name: "Revenue Growth", order: 20, description: "Achieve revenue milestones" },
  { name: "Product Expansion", order: 21, description: "Expand product features and offerings" },
  { name: "Series A Readiness", order: 22, description: "Prepare for Series A fundraising" },
  { name: "Series A", order: 23, description: "Close Series A funding round" },
  { name: "Regional Expansion", order: 24, description: "Expand into new geographic markets" },
  { name: "Series B Readiness", order: 25, description: "Prepare for Series B fundraising" },
  { name: "Scale Operations", order: 26, description: "Scale team, infrastructure, and operations" },
];

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    // Ensure table exists
    await db.execute({ sql: `CREATE TABLE IF NOT EXISTS venture_journey_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      stage_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'locked',
      completed_at TIMESTAMPTZ,
      approved_by TEXT REFERENCES contacts(cid),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(venture_id, stage_order)
    )` });

    // Seed stages for this venture if they don't exist
    const existing = await db.execute({ sql: "SELECT COUNT(*) as c FROM venture_journey_stages WHERE venture_id = ?", args: [dbId] });
    if (parseInt(existing.rows?.[0]?.c || 0) === 0) {
      for (const stage of STANDARD_STAGES) {
        await db.execute({
          sql: "INSERT INTO venture_journey_stages (venture_id, name, description, stage_order, status) VALUES (?, ?, ?, ?, ?)",
          args: [dbId, stage.name, stage.description, stage.order, stage.order === 1 ? "active" : "locked"],
        });
      }
    } else {
      // Add any missing growth stages for existing ventures
      const maxOrder = await db.execute({ sql: "SELECT MAX(stage_order) as max_order FROM venture_journey_stages WHERE venture_id = ?", args: [dbId] });
      const currentMax = parseInt(maxOrder.rows?.[0]?.max_order || 15);
      for (const stage of STANDARD_STAGES) {
        if (stage.order > currentMax) {
          await db.execute({
            sql: "INSERT INTO venture_journey_stages (venture_id, name, description, stage_order, status) VALUES (?, ?, ?, ?, 'locked') ON CONFLICT (venture_id, stage_order) DO NOTHING",
            args: [dbId, stage.name, stage.description, stage.order],
          });
        }
      }
    }

    const stages = await db.execute({
      sql: "SELECT * FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC",
      args: [dbId],
    });

    return NextResponse.json({ success: true, stages: stages.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    // Only privileged users (mentors) can unlock next stage
    if (!PRIVILEGED.includes(session.role)) {
      return NextResponse.json({ success: false, error: "Only mentors can approve stages" }, { status: 403 });
    }

    const { stage_id, action } = await req.json();
    if (!stage_id || !action) return NextResponse.json({ success: false, error: "stage_id and action required" }, { status: 400 });

    const stage = (await db.execute({ sql: "SELECT * FROM venture_journey_stages WHERE id = ? AND venture_id = ?", args: [stage_id, dbId] })).rows?.[0];
    if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });

    if (action === "complete") {
      await db.execute({ sql: "UPDATE venture_journey_stages SET status = 'completed', completed_at = NOW(), approved_by = ? WHERE id = ?", args: [session.cid, stage_id] });
      await db.execute({ sql: "UPDATE venture_journey_stages SET status = 'active' WHERE venture_id = ? AND stage_order = ? AND status = 'locked'", args: [dbId, stage.stage_order + 1] });
      notifyVentureFounders(dbId, 'Stage Completed', `"${stage.name}" has been marked as completed.`);
    } else if (action === "reset") {
      await db.execute({ sql: "UPDATE venture_journey_stages SET status = 'locked', completed_at = NULL, approved_by = NULL WHERE venture_id = ? AND stage_order >= ?", args: [dbId, stage.stage_order] });
      await db.execute({ sql: "UPDATE venture_journey_stages SET status = 'active' WHERE venture_id = ? AND stage_order = ?", args: [dbId, stage.stage_order] });
    }

    const stages = await db.execute({
      sql: "SELECT * FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC",
      args: [dbId],
    });

    return NextResponse.json({ success: true, stages: stages.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
