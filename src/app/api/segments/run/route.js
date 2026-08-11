import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const POST = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    const { filters } = await req.json();

    let sql = `SELECT c.* FROM contacts c`;
    let conditions = [];
    let args = [];

    if (filters.campaign_id || filters.status) {
      sql += ` JOIN campaign_contacts cc ON c.cid = cc.cid`;
      if (filters.campaign_id) {
        conditions.push(`cc.campaign_id = ?`);
        args.push(filters.campaign_id);
      }
      if (filters.status) {
        if (filters.status === "NOT_RESPONDED") {
          conditions.push(`cc.status IN ('sent', 'pending')`);
        } else {
          conditions.push(`cc.status = ?`);
          args.push(filters.status.toLowerCase());
        }
      }
    }
    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(" AND ");
    sql += ` GROUP BY c.id`;

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, contacts: result.rows });
  },
);
