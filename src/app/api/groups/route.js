import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getGroups,
  deleteGroup,
  getFamilyProgramId,
} from "@/models/groups/contactGroups";
import { createContactGroup, updateContactGroup } from "@/services/contacts/groups";
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

    const created = await createContactGroup({
      programId: program_id,
      name,
      type,
      description,
      defaultRole: body.default_role,
    });

    return NextResponse.json({
      success: true,
      group: { id: created.id, registration_id: created.registration_id, program_id, name, type, description },
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

    const result = await updateContactGroup({
      id,
      name,
      type,
      description,
      isArchived: is_archived,
      defaultRole: default_role,
    });

    if (!result.updated) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      );
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
