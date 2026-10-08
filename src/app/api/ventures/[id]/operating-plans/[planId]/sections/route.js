import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { getSession } from "@/server/auth/session";
import { resolvePlanAccess, allowsPlanAction } from "@/services/ventures/operatingPlans";
import {
  liveVenturePlanExists,
  venturePlanSectionExists,
  insertVenturePlanLink,
  insertVenturePlanSection,
  updateVenturePlanSection,
  getVenturePlanLink,
  deleteVenturePlanLink,
  deleteVenturePlanSection,
} from "@/models/ventureWorkspace";

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
  const access = await resolvePlanAccess(params.id, session);
  if (!access.ok) return { error: NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 }) };
  const planResult = await liveVenturePlanExists(params.planId, access.code);
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
      if (!(await allowsPlanAction(accessGate.access, "edit"))) {
        return NextResponse.json({ success: false, error: "Not allowed to edit this plan." }, { status: 403 });
      }
      const sectionResult = await venturePlanSectionExists(body.section_id, params.planId);
      if (!sectionResult.rows?.[0]) return NextResponse.json({ success: false, error: "Section not found." }, { status: 404 });
      await insertVenturePlanLink({
        sectionId: body.section_id,
        refType: body.ref_type,
        refId: String(body.ref_id),
        label: body.label ? String(body.label).slice(0, 200) : null,
        createdBy: session.cid || null,
      });
      return NextResponse.json({ success: true });
    }

    // Create section
    if (!(await allowsPlanAction(accessGate.access, "edit"))) {
      return NextResponse.json({ success: false, error: "Not allowed to edit this plan." }, { status: 403 });
    }
    const title = String(body.title || "").trim();
    if (!title) return NextResponse.json({ success: false, error: "title is required." }, { status: 400 });
    const insertResult = await insertVenturePlanSection({
      planId: params.planId,
      title,
      objective: body.objective || null,
      instructions: body.instructions || null,
      sortOrder: Number(body.sort_order) || 0,
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
    if (!(await allowsPlanAction(accessGate.access, requiredCapability))) {
      return NextResponse.json({ success: false, error: "Not allowed to update this section." }, { status: 403 });
    }
    const updateResult = await updateVenturePlanSection({
      sectionId: section_id,
      planId: params.planId,
      title: body.title ? String(body.title).trim() : null,
      objective: body.objective !== undefined ? (body.objective || null) : null,
      instructions: body.instructions !== undefined ? (body.instructions || null) : null,
      status: body.status || null,
      sortOrder: body.sort_order !== undefined ? Number(body.sort_order) : null,
    });
    if (!updateResult.rows?.length && updateResult.changes === 0) {
      const existingSection = await venturePlanSectionExists(section_id, params.planId);
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
      if (!(await allowsPlanAction(accessGate.access, "edit"))) {
        return NextResponse.json({ success: false, error: "Not allowed to edit this plan." }, { status: 403 });
      }
      const linkResult = await getVenturePlanLink(body.link_id, params.planId);
      if (!linkResult.rows?.[0]) return NextResponse.json({ success: false, error: "Link not found." }, { status: 404 });
      await deleteVenturePlanLink(body.link_id);
      return NextResponse.json({ success: true });
    }

    if (!body.section_id) return NextResponse.json({ success: false, error: "section_id or link_id is required." }, { status: 400 });
    if (!(await allowsPlanAction(accessGate.access, "manage"))) {
      return NextResponse.json({ success: false, error: "Not allowed to delete sections." }, { status: 403 });
    }
    await deleteVenturePlanSection(body.section_id, params.planId);
    return NextResponse.json({ success: true });
  },
);
