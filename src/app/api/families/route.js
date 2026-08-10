import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

import { v4 as uuidv4 } from "uuid";

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const regId = searchParams.get("registration_id");

    // Lookup by registration_id is public (used by join page)
    if (regId) {
      const result = await db.execute({
        sql: "SELECT * FROM families WHERE registration_id = ?",
        args: [regId],
      });
      return NextResponse.json({ success: true, families: result.rows });
    }

    // All other queries require auth
    const authError = await requireAuth([
      "staff", "super_admin", "program_manager", "teacher", "participant",
    ]);
    if (authError) return authError;

    const result = await db.execute("SELECT * FROM families ORDER BY name ASC");
    return NextResponse.json({ success: true, families: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const { name, type, program_id, description, default_role } = await req.json();

    try {
      await db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS description TEXT");
      await db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS form_id UUID");
      await db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS default_role TEXT");
    } catch (e) {}

    if (!name)
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });

    const registration_id = "GRP-" + uuidv4().split("-")[0].toUpperCase() + Math.floor(Math.random() * 1000);

    // Auto-create a Platform form for this group
    let formId = null;
    try {
      const formRes = await db.execute({
        sql: "INSERT INTO platform_forms (name, description, target_group) VALUES (?, 'Auto-created for group: ' || ?, ?) RETURNING id",
        args: [name, name, registration_id],
      });
      formId = formRes.rows[0]?.id;
      if (formId) {
        const secRes = await db.execute({
          sql: "INSERT INTO platform_form_sections (form_id, title, sort_order) VALUES (?, 'Profile Information', 0) RETURNING id",
          args: [formId],
        });
        const sectionId = secRes.rows[0]?.id;
        if (sectionId) {
          const defaultFields = [
            { label: 'Full Name', field_type: 'text', required: true, sort_order: 0 },
            { label: 'Email Address', field_type: 'email', required: true, sort_order: 1 },
            { label: 'Phone Number', field_type: 'phone', required: false, sort_order: 2 },
          ];
          for (const f of defaultFields) {
            await db.execute({
              sql: "INSERT INTO platform_form_fields (form_id, section_id, label, field_type, required, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
              args: [formId, sectionId, f.label, f.field_type, f.required, f.sort_order],
            });
          }
        }
      }
    } catch (e) { console.warn("Auto-create form failed:", e.message); }

    const res = await db.execute({
      sql: "INSERT INTO families (name, registration_id, program_id, type, description, form_id, default_role) VALUES (?, ?, ?::uuid, ?, ?, ?::uuid, ?) RETURNING id",
      args: [name, registration_id, program_id || null, type || "individual", description || null, formId, default_role || null],
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
    const authError = await requireAuth(["staff", "super_admin"]);
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

    if (updates.length === 0)
      return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });

    args.push(body.id);
    await db.execute({ sql: `UPDATE families SET ${updates.join(", ")} WHERE id = ?`, args });
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

    await db.execute({
      sql: "UPDATE families SET is_archived = ? WHERE id = ?",
      args: [is_archived ? 1 : 0, id],
    }).catch(async () => {
      // Column may not exist yet — try adding it
      await db.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0");
      await db.execute({
        sql: "UPDATE families SET is_archived = ? WHERE id = ?",
        args: [is_archived ? 1 : 0, id],
      });
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

    await db.execute({
      sql: "DELETE FROM families WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
