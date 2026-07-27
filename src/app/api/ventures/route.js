import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";

/**
 * GET /api/ventures
 *
 * List all ventures with summary counts.
 * Supports filtering by status and search query.
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

    if (status) {
      sql += " AND v.status = ?";
      args.push(status);
    }

    if (search) {
      sql += " AND (LOWER(v.company_name) LIKE ? OR LOWER(v.venture_id) LIKE ? OR LOWER(v.industry) LIKE ?)";
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
