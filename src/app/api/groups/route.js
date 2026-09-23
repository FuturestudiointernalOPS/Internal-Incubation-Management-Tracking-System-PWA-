import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { requireAuthorization } from "@/lib/authorization";
import {
  getGroups,
  createGroup,
  createGroupAfterColumnSelfHeal,
  updateGroup,
  updateGroupAfterColumnSelfHeal,
  addFamilyDescriptionColumn,
  addFamilyDefaultRoleColumn,
  addFamilyIsArchivedColumn,
  addFamilyDescriptionColumnOnUpdate,
  addFamilyDefaultRoleColumnOnUpdate,
  addFamilyIsArchivedColumnOnUpdate,
  deleteGroup,
  getFamilyProgramId,
} from "@/models/groups";
export const dynamic = "force-dynamic";

/**
 * GROUPS API — Contact Group management.
 * Reads/writes the `families` table (contact groups created during program setup).
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "program_manager"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");
    const search = searchParams.get("search");

    const { rows } = await getGroups(program_id, search);
    return NextResponse.json({ success: true, groups: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const body = await req.json();
    const { program_id, name, type, description } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "name required" },
        { status: 400 }
      );
    }

    // Program scope (wave: groups). A group belongs to a program when the caller
    // supplies one; a group created with no program is not program-scoped, so the
    // guard is only consulted for the program-bound case. OFF by default.
    if (program_id) {
      const scopeError = await requireProgramScope({
        programId: program_id,
        wave: "groups",
      });
      if (scopeError) return scopeError;
    }

    // Generate a unique registration_id (matches families route pattern: GRP-XXXX123)
    const registration_id =
      "GRP-" +
      Math.random().toString(36).slice(2, 6).toUpperCase() +
      Math.floor(Math.random() * 1000);

    const insertArgs = [program_id || null, name, type || "individual", description || null, body.default_role || null, registration_id];

    let result;
    try {
      // Fast path: no extra queries when schema is healthy
      result = await createGroup(insertArgs);
    } catch (insertError) {
      // Self-heal only on failure: add missing columns once, then retry once
      if (!/does not exist/i.test(insertError.message || "")) throw insertError;
      await addFamilyDescriptionColumn();
      await addFamilyDefaultRoleColumn();
      await addFamilyIsArchivedColumn();
      result = await createGroupAfterColumnSelfHeal(insertArgs);
    }

    const row = result.rows?.[0];
    const id = row?.id ?? result.lastInsertRowid;
    const registrationId = row?.registration_id ?? registration_id;

    return NextResponse.json({
      success: true,
      group: { id, registration_id: registrationId, program_id, name, type, description },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const { id, name, type, description, is_archived, default_role } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id required" },
        { status: 400 }
      );
    }

    // Program scope (wave: groups). The handler receives only a group id, so the
    // owning program is read first — a write that cannot be attributed to a
    // program cannot be scope-checked, and the guard refuses in that case.
    // OFF by default (no-op until the wave is switched on).
    const groupProgram = await getFamilyProgramId(id);
    const scopeError = await requireProgramScope({
      programId: groupProgram.rows?.[0]?.program_id,
      wave: "groups",
    });
    if (scopeError) return scopeError;

    const updates = [];
    const args = [];

    if (name !== undefined) { updates.push("name = ?"); args.push(name); }
    if (type !== undefined) { updates.push("type = ?"); args.push(type); }
    if (description !== undefined) { updates.push("description = ?"); args.push(description); }
    if (is_archived !== undefined) { updates.push("is_archived = ?"); args.push(is_archived ? 1 : 0); }
    if (default_role !== undefined) { updates.push("default_role = ?"); args.push(default_role || null); }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
    }

    args.push(id);

    try {
      // Fast path: no extra queries when schema is healthy
      await updateGroup(updates, args);
    } catch (updateError) {
      // Self-heal only on failure: add missing columns once, then retry once
      if (!/does not exist/i.test(updateError.message || "")) throw updateError;
      await addFamilyDescriptionColumnOnUpdate();
      await addFamilyDefaultRoleColumnOnUpdate();
      await addFamilyIsArchivedColumnOnUpdate();
      await updateGroupAfterColumnSelfHeal(updates, args);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id required" },
        { status: 400 }
      );
    }

    // Program scope (wave: groups) — read the owning program first (see PUT).
    const groupProgram = await getFamilyProgramId(id);
    const scopeError = await requireProgramScope({
      programId: groupProgram.rows?.[0]?.program_id,
      wave: "groups",
    });
    if (scopeError) return scopeError;

    await deleteGroup(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
