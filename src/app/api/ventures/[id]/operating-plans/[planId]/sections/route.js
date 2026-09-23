import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolvePlanAccess, allowsPlanAction } from "@/lib/ventureOperatingPlans";

/**
 * Sections + links of an operating plan.
 *
 * POST   /sections                     { title, objective?, instructions? }         (create)
 * PATCH  /sections                     { section_id, title?, objective?, instructions?, status?, sort_order? }
 * DELETE /sections                     { section_id }                                (manage)
 * POST   /sections/links               { section_id, ref_type, ref_id, label? }      (edit)
 * DELETE /sections/links               { link_id }                                   (edit)
 */
async function baseAccess(db, params, session) {
  const access = await resolvePlanAccess(db, params.id, session);
  if (!access.ok) return { error: NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 }) };
  const planResult = await db.execute({ sql: "SELECT id FROM venture_operating_plans WHERE id = ? AND venture_id = ? AND status <> 'archived'", args: [params.planId, access.code] });
  if (!planResult.rows?.[0]) return { error: NextResponse.json({ success: false, error: "Plan not found." }, { status: 404 }) };
  return { access };
}

export const POST = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    const accessGate = await baseAccess(db, params, session);
    if (accessGate.error) return accessGate.error;
    const body = await req.json();

    // { title,... } → create section; { section_id, ref_type, ... } → add link
    if (body.section_id && body.ref_type) {
      if (!(await allowsPlanAction(db, accessGate.access, "edit"))) {
        return NextResponse.json({ success: false, error: "Not allowed to edit this plan." }, { status: 403 });
      }
      const sectionResult = await db.execute({ sql: "SELECT id FROM venture_plan_sections WHERE id = ? AND plan_id = ?", args: [body.section_id, params.planId] });
      if (!sectionResult.rows?.[0]) return NextResponse.json({ success: false, error: "Section not found." }, { status: 404 });
      await db.execute({
        sql: "INSERT INTO venture_plan_links (section_id, ref_type, ref_id, label, created_by) VALUES (?,?,?,?,?) ON CONFLICT (section_id, ref_type, ref_id) DO NOTHING",
        args: [body.section_id, body.ref_type, String(body.ref_id), body.label ? String(body.label).slice(0, 200) : null, session.cid || null],
      });
      return NextResponse.json({ success: true });
    }

    // Create section
    if (!(await allowsPlanAction(db, accessGate.access, "edit"))) {
      return NextResponse.json({ success: false, error: "Not allowed to edit this plan." }, { status: 403 });
    }
    const title = String(body.title || "").trim();
    if (!title) return NextResponse.json({ success: false, error: "title is required." }, { status: 400 });
    const insertResult = await db.execute({
      sql: "INSERT INTO venture_plan_sections (plan_id, title, objective, instructions, sort_order) VALUES (?,?,?,?,?) RETURNING id",
      args: [params.planId, title, body.objective || null, body.instructions || null, Number(body.sort_order) || 0],
    });
    return NextResponse.json({ success: true, id: insertResult.rows?.[0]?.id ?? null });
  },
);

export const PATCH = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    const accessGate = await baseAccess(db, params, session);
    if (accessGate.error) return accessGate.error;
    const body = await req.json();
    const { section_id } = body;
    if (!section_id) return NextResponse.json({ success: false, error: "section_id is required." }, { status: 400 });

    const statusChange = body.status !== undefined;
    const requiredCapability = statusChange ? "manage" : "edit";
    if (!(await allowsPlanAction(db, accessGate.access, requiredCapability))) {
      return NextResponse.json({ success: false, error: "Not allowed to update this section." }, { status: 403 });
    }
    const updateResult = await db.execute({
      sql: `UPDATE venture_plan_sections SET
              title = COALESCE(?, title),
              objective = COALESCE(?, objective),
              instructions = COALESCE(?, instructions),
              status = COALESCE(?, status),
              sort_order = COALESCE(?, sort_order),
              updated_at = NOW()
            WHERE id = ? AND plan_id = ?`,
      args: [
        body.title ? String(body.title).trim() : null,
        body.objective !== undefined ? (body.objective || null) : null,
        body.instructions !== undefined ? (body.instructions || null) : null,
        body.status || null,
        body.sort_order !== undefined ? Number(body.sort_order) : null,
        section_id,
        params.planId,
      ],
    });
    if (!updateResult.rows?.length && updateResult.changes === 0) {
      const existingSection = await db.execute({ sql: "SELECT id FROM venture_plan_sections WHERE id = ? AND plan_id = ?", args: [section_id, params.planId] });
      if (!existingSection.rows?.length) return NextResponse.json({ success: false, error: "Section not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  },
);

export const DELETE = createHandler(
  async (req, { params }) => {
    await initDb();
    const session = await getSession();
    const accessGate = await baseAccess(db, params, session);
    if (accessGate.error) return accessGate.error;
    const body = await req.json();

    if (body.link_id) {
      if (!(await allowsPlanAction(db, accessGate.access, "edit"))) {
        return NextResponse.json({ success: false, error: "Not allowed to edit this plan." }, { status: 403 });
      }
      const linkResult = await db.execute({
        sql: "SELECT l.id FROM venture_plan_links l JOIN venture_plan_sections s ON s.id = l.section_id WHERE l.id = ? AND s.plan_id = ?",
        args: [body.link_id, params.planId],
      });
      if (!linkResult.rows?.[0]) return NextResponse.json({ success: false, error: "Link not found." }, { status: 404 });
      await db.execute({ sql: "DELETE FROM venture_plan_links WHERE id = ?", args: [body.link_id] });
      return NextResponse.json({ success: true });
    }

    if (!body.section_id) return NextResponse.json({ success: false, error: "section_id or link_id is required." }, { status: 400 });
    if (!(await allowsPlanAction(db, accessGate.access, "manage"))) {
      return NextResponse.json({ success: false, error: "Not allowed to delete sections." }, { status: 403 });
    }
    await db.execute({ sql: "DELETE FROM venture_plan_sections WHERE id = ? AND plan_id = ?", args: [body.section_id, params.planId] });
    return NextResponse.json({ success: true });
  },
);
