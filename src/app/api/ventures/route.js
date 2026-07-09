import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "participant",
      "staff",
      "program_manager",
      "super_admin",
      "teacher",
      "developer",
    ]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const contactId = searchParams.get("contact_id");

    let sql, args;
    if (contactId) {
      sql = `
        SELECT v.*,
          (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.id AND vm.member_type = 'founder' AND vm.removed_at IS NULL) as founder_count,
          (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.id AND vm.removed_at IS NULL) as member_count
        FROM ventures v
        WHERE v.id IN (
          SELECT vm.venture_id FROM venture_members vm WHERE vm.contact_id = ? AND vm.removed_at IS NULL
        )
      `;
      args = [contactId];
      if (programId) {
        sql += " AND v.program_id = ?";
        args.push(programId);
      }
      sql += " ORDER BY v.created_at DESC";
    } else if (programId) {
      sql = `
        SELECT v.*,
          (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.id AND vm.member_type = 'founder' AND vm.removed_at IS NULL) as founder_count,
          (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.id AND vm.removed_at IS NULL) as member_count
        FROM ventures v
        WHERE v.program_id = ? AND v.is_archived = 0
        ORDER BY v.created_at DESC
      `;
      args = [programId];
    } else {
      sql = `
        SELECT v.*,
          (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.id AND vm.member_type = 'founder' AND vm.removed_at IS NULL) as founder_count,
          (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.id AND vm.removed_at IS NULL) as member_count
        FROM ventures v
        WHERE v.is_archived = 0
        ORDER BY v.created_at DESC
      `;
      args = [];
    }

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, ventures: result.rows });
  } catch (error) {
    console.error("GET /api/ventures error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "participant",
      "staff",
      "program_manager",
      "super_admin",
      "teacher",
    ]);
    if (authError) return authError;

    const body = await req.json();
    const {
      name,
      description,
      mission,
      vision,
      industry,
      sector,
      business_stage,
      website,
      social_media,
      program_id,
      origin_team_id,
      created_by,
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 },
      );
    }
    if (!created_by) {
      return NextResponse.json(
        { success: false, error: "created_by (contact_id) is required" },
        { status: 400 },
      );
    }

    const insertRes = await db.execute({
      sql: `INSERT INTO ventures (name, description, mission, vision, industry, sector, business_stage, website, social_media, program_id, origin_team_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        name,
        description || null,
        mission || null,
        vision || null,
        industry || null,
        sector || null,
        business_stage || "idea",
        website || null,
        social_media ? JSON.stringify(social_media) : null,
        program_id || null,
        origin_team_id || null,
      ],
    });

    const ventureId = insertRes.rows?.[0]?.id || insertRes.lastInsertRowid;

    // Insert creator as first founder
    await db.execute({
      sql: `INSERT INTO venture_members (venture_id, contact_id, member_type, permissions)
            VALUES (?, ?, 'founder', 'edit')`,
      args: [ventureId, created_by],
    });

    return NextResponse.json({ success: true, id: ventureId });
  } catch (error) {
    console.error("POST /api/ventures error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "participant",
      "staff",
      "program_manager",
      "super_admin",
      "teacher",
    ]);
    if (authError) return authError;

    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    const allowedFields = [
      "name", "description", "mission", "vision", "industry", "sector",
      "business_stage", "website", "social_media", "visibility", "status",
      "branding", "language",
    ];

    const setClauses = [];
    const updateArgs = [];

    for (const field of allowedFields) {
      if (fields[field] !== undefined) {
        let val = fields[field];
        if (field === "social_media" && typeof val === "object") {
          val = JSON.stringify(val);
        }
        if (field === "branding" && typeof val === "object") {
          val = JSON.stringify(val);
        }
        setClauses.push(`${field} = ?`);
        updateArgs.push(val);
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    setClauses.push("updated_at = NOW()");
    updateArgs.push(id);

    await db.execute({
      sql: `UPDATE ventures SET ${setClauses.join(", ")} WHERE id = ?`,
      args: updateArgs,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/ventures error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
