import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
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

    let sql = "SELECT * FROM families";
    let args = [];
    let conditions = [];

    if (program_id) {
      conditions.push("program_id = ?");
      args.push(program_id);
    }
    if (search) {
      conditions.push("LOWER(name) LIKE LOWER(?)");
      args.push(`%${search}%`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY created_at DESC";

    const { rows } = await db.execute({ sql, args });
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
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const body = await req.json();
    const { program_id, name, type, description, default_role } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "name required" },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: `INSERT INTO families (program_id, name, type, description, default_role)
             VALUES (?, ?, ?, ?, ?) RETURNING id`,
      args: [program_id || null, name, type || "individual", description || null, body.default_role || null],
    });

    const id = result.rows?.[0]?.id ?? result.lastInsertRowid;

    return NextResponse.json({
      success: true,
      group: { id, program_id, name, type, description },
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
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { id, name, type, description, is_archived, default_role } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id required" },
        { status: 400 }
      );
    }

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
    await db.execute({
      sql: `UPDATE families SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

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
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id required" },
        { status: 400 }
      );
    }

    await db.execute({
      sql: "DELETE FROM families WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
