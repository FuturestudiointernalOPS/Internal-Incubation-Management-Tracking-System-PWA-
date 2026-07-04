import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const dynamic = "force-dynamic";

/**
 * RETROSPECTIVE API — SUSPENDED
 * This endpoint is intentionally disabled from the participant UI.
 * Do not re-enable without explicit approval from the product owner.
 */

export const GET = createHandler(async (req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  	const cid = session.cid;
  	const { searchParams } = new URL(req.url);
  	const weekNum = searchParams.get("week_number");

  	let sql = "SELECT * FROM v2_retros WHERE user_id = ?";
  	const args = [cid];
  	if (weekNum) {
  		sql += " AND week_number = ?";
  		args.push(parseInt(weekNum));
  	}
  	sql += " ORDER BY created_at DESC";

  	const res = await db.execute({ sql, args });
  	return NextResponse.json({ success: true, retros: res.rows });
});

export const POST = createHandler(async (req) => {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  	const cid = session.cid;
  	const userName = session.name || "";
  	const currentYear = new Date().getFullYear();
  	const { week_number } = await req.json();

  	await db.execute({
  		sql: "INSERT INTO v2_retros (user_id, user_name, week_number, year) VALUES (?, ?, ?, ?)",
  		args: [cid, userName, week_number || 1, currentYear],
  	});
  	return NextResponse.json({ success: true });
});
