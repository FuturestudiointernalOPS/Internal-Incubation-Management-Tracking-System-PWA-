import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  hasProgramManagementAccess,
} from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";

import { v4 as uuidv4 } from "uuid";

import {
  getFamilyByRegistrationId,
  getAllFamilies,
  ensureFamilyDescriptionColumn,
  ensureFamilyFormIdColumn,
  ensureFamilyDefaultRoleColumn,
  createFamilyRegistrationForm,
  createFamilyFormSection,
  createFamilyFormField,
  createFamily,
  updateFamilyFields,
  updateFamilyArchiveStatus,
  ensureFamilyArchiveColumn,
  deleteFamily,
} from "@/models/contacts";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const regId = searchParams.get("registration_id");

    // Lookup by registration_id is public (used by join page)
    if (regId) {
      const result = await getFamilyByRegistrationId(regId);
      return NextResponse.json({ success: true, families: result.rows });
    }

    // All other queries require auth
    const authError = await requireAuth();
    if (authError) return authError;

    // Phase 1.3: the family/group directory is capability-governed. Only
    // management roles and programs.view-capability holders may list every
    // family. Participant-role sessions were previously trusted with a
    // platform-wide group read — no UI consumer exists for that; the
    // program-scoped group data participants need comes from their own
    // program endpoints.
    const session = await getSession();
    const capError = await requireAuthorization("programs", "view");
    const canList = !capError || hasProgramManagementAccess(session?.role);
    if (!canList) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    const result = await getAllFamilies();
    return NextResponse.json({ success: true, families: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const { name, type, program_id, description, default_role } = await req.json();

    try {
      await ensureFamilyDescriptionColumn();
      await ensureFamilyFormIdColumn();
      await ensureFamilyDefaultRoleColumn();
    } catch (e) {}

    if (!name)
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });

    const registration_id = "GRP-" + uuidv4().split("-")[0].toUpperCase() + Math.floor(Math.random() * 1000);

    // Auto-create a Platform form for this group
    let formId = null;
    try {
      const formRes = await createFamilyRegistrationForm(name);
      formId = formRes.rows[0]?.id;
      if (formId) {
        const secRes = await createFamilyFormSection(formId);
        const sectionId = secRes.rows[0]?.id;
        if (sectionId) {
          const defaultFields = [
            { label: 'Full Name', field_type: 'text', required: true, sort_order: 0 },
            { label: 'Email Address', field_type: 'email', required: true, sort_order: 1 },
            { label: 'Phone Number', field_type: 'phone', required: false, sort_order: 2 },
          ];
          for (const f of defaultFields) {
            await createFamilyFormField(formId, sectionId, f);
          }
        }
      }
    } catch (e) { console.warn("Auto-create form failed:", e.message); }

    const res = await createFamily({
      name,
      registration_id,
      program_id,
      type,
      description,
      form_id: formId,
      default_role,
    });

    const newId = res.lastInsertRowid;

    return NextResponse.json({
      success: true, id: newId, form_id: formId,
      group: { id: newId, name, registration_id, description, form_id: formId },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;
    const body = await req.json();
    if (!body.id)
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });

    const updates = [];
    const args = [];
    if (body.name !== undefined) { updates.push("name = ?"); args.push(body.name); }
    if (body.program_id !== undefined) { updates.push("program_id = ?"); args.push(body.program_id); }
    if (body.type !== undefined) { updates.push("type = ?"); args.push(body.type); }
    if (body.description !== undefined) { updates.push("description = ?"); args.push(body.description); }
    if (body.default_role !== undefined) { updates.push("default_role = ?"); args.push(body.default_role || null); }
    if (body.lead_facilitator_id !== undefined) { updates.push("lead_facilitator_id = ?"); args.push(body.lead_facilitator_id || null); }

    if (updates.length === 0)
      return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });

    args.push(body.id);
    await updateFamilyFields(updates, args);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const { id, is_archived } = await req.json();
    if (!id)
      return NextResponse.json(
        { success: false, error: "ID is required" },
        { status: 400 },
      );

    await updateFamilyArchiveStatus(id, is_archived).catch(async () => {
      // Column may not exist yet — try adding it
      await ensureFamilyArchiveColumn();
      await updateFamilyArchiveStatus(id, is_archived);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const { id } = await req.json();
    if (!id)
      return NextResponse.json(
        { success: false, error: "ID is required" },
        { status: 400 },
      );

    await deleteFamily(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
