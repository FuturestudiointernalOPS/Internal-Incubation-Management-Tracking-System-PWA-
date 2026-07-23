import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

/** GET /api/investor/organizations */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const session = await getSession();
    const user = session;
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("id");

    if (orgId) {
      const org = await db.execute({
        sql: "SELECT * FROM investor_organizations WHERE id = ?",
        args: [orgId],
      });
      const members = await db.execute({
        sql: `SELECT iom.*, ip.organization_name, c.name, c.email
              FROM investor_org_members iom
              JOIN investor_profiles ip ON iom.investor_id = ip.id
              JOIN contacts c ON ip.user_id = c.cid
              WHERE iom.organization_id = ?`,
        args: [orgId],
      });
      return NextResponse.json({
        success: true,
        organization: org.rows[0] || null,
        members: members.rows,
      });
    }

    // List orgs the current investor belongs to
    const profile = await db.execute({
      sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
      args: [user.cid || user.id],
    });

    if (profile.rows.length === 0) {
      return NextResponse.json({ success: true, organizations: [] });
    }

    const result = await db.execute({
      sql: `SELECT io.*, iom.role as member_role
            FROM investor_organizations io
            JOIN investor_org_members iom ON io.id = iom.organization_id
            WHERE iom.investor_id = ?
            ORDER BY io.name`,
      args: [profile.rows[0].id],
    });

    return NextResponse.json({ success: true, organizations: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/organizations — create org and add current investor as admin */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const session = await getSession();
    const user = session;
    const { name, description, website, logo_url } = await req.json();

    if (!name) {
      return NextResponse.json({ success: false, error: "Organization name required" }, { status: 400 });
    }

    const profile = await db.execute({
      sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
      args: [user.cid || user.id],
    });
    if (profile.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Investor profile not found" }, { status: 404 });
    }

    const investorId = profile.rows[0].id;

    // Create org
    const orgRes = await db.execute({
      sql: `INSERT INTO investor_organizations (name, description, website, logo_url)
            VALUES (?, ?, ?, ?) RETURNING *`,
      args: [name, description || null, website || null, logo_url || null],
    });

    const org = orgRes.rows[0];

    // Add creator as admin
    await db.execute({
      sql: `INSERT INTO investor_org_members (organization_id, investor_id, role)
            VALUES (?, ?, 'admin')`,
      args: [org.id, investorId],
    });

    return NextResponse.json({ success: true, organization: org });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** PUT /api/investor/organizations — add member to org */
export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const { organization_id, investor_profile_id, role } = await req.json();

    if (!organization_id || !investor_profile_id) {
      return NextResponse.json({ success: false, error: "organization_id and investor_profile_id required" }, { status: 400 });
    }

    await db.execute({
      sql: `INSERT INTO investor_org_members (organization_id, investor_id, role)
            VALUES (?, ?, ?)
            ON CONFLICT (organization_id, investor_id)
            DO UPDATE SET role = EXCLUDED.role`,
      args: [organization_id, investor_profile_id, role || "member"],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
