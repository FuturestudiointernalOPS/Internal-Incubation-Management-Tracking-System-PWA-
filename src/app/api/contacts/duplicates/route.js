import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const flags = await db.execute({
      sql: `SELECT df.*,
              ca.name AS contact_a_name, ca.email AS contact_a_email,
              cb.name AS contact_b_name, cb.email AS contact_b_email
            FROM contact_duplicate_flags df
            LEFT JOIN contacts ca ON ca.cid = df.contact_cid_a
            LEFT JOIN contacts cb ON cb.cid = df.contact_cid_b
            WHERE df.status = 'pending'
            ORDER BY df.created_at DESC`,
      args: [],
    });

    const result = flags.rows.map(r => ({
      ...r,
      contact_a: { name: r.contact_a_name, email: r.contact_a_email },
      contact_b: { name: r.contact_b_name, email: r.contact_b_email },
    }));

    return NextResponse.json({ success: true, flags: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });

    await db.execute({
      sql: "UPDATE contact_duplicate_flags SET status = 'dismissed', reviewed_at = NOW() WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
