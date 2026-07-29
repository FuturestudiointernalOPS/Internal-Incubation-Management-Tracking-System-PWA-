import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth";

/**
 * GET /api/ventures
 * List all ventures with summary counts.
 */
export const GET = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    let sql = `
      SELECT v.*,
        (SELECT COUNT(*) FROM venture_founders vf WHERE vf.venture_id = v.venture_id) as founder_count,
        (SELECT COUNT(*) FROM venture_members vm WHERE vm.venture_id = v.venture_id) as member_count
      FROM ventures v
      WHERE 1=1
    `;
    const args = [];

    const contactId = searchParams.get("contact_id");

    if (contactId) {
      sql += " AND v.venture_id IN (SELECT vm.venture_id FROM venture_members vm WHERE vm.user_cid = ?)";
      args.push(contactId);
    }

    if (status) {
      sql += " AND v.status = ?";
      args.push(status);
    }

    if (search) {
      sql += " AND (LOWER(v.name) LIKE ? OR LOWER(v.venture_id) LIKE ? OR LOWER(v.industry) LIKE ?)";
      const searchPattern = `%${search.toLowerCase()}%`;
      args.push(searchPattern, searchPattern, searchPattern);
    }

    sql += " ORDER BY v.created_at DESC";

    const result = await db.execute({ sql, args });

    return NextResponse.json({
      success: true,
      ventures: result.rows,
    });
  },
);

/**
 * POST /api/ventures
 * Create a new venture.
 */
export const POST = createHandler(
  { roles: ["super_admin", "staff", "program_manager"] },
  async (req) => {
    const { name, description, industry, business_stage, website, mission, vision, sector, program_id, origin_team_id } = await req.json();
    if (!name) {
      return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
    }
    const venture_id = `VNT-${uuidv4().replace(/-/g, "").substring(0, 8).toUpperCase()}`;
    const result = await db.execute({
      sql: `INSERT INTO ventures (venture_id, name, description, industry, business_stage, website, mission, vision, sector, program_id, origin_team_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW()) RETURNING id`,
      args: [venture_id, name, description || null, industry || null, business_stage || "idea", website || null, mission || null, vision || null, sector || null, program_id || null, origin_team_id || null],
    });
    const id = result.rows[0]?.id;
    // Add creator as founder
    try {
      const session = await getSession();
      if (id && session.cid) {
        await db.execute({
          sql: `INSERT INTO venture_members (venture_id, user_cid, role) VALUES (?, ?, 'founder') ON CONFLICT DO NOTHING`,
          args: [venture_id, session.cid],
        });
      }
    } catch(_) {}
    return NextResponse.json({ success: true, id, venture_id });
  },
);
