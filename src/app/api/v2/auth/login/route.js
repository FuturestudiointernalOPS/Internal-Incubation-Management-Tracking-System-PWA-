import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * UNIFIED AUTH TERMINAL
 * Handles Super Admin & PM Authentication
 */
export async function POST(req) {
  try {
    await initDb();
    const { useID, accessCode } = await req.json();

    if (!useID || !accessCode) {
      return NextResponse.json({ success: false, error: "Missing identity credentials." }, { status: 400 });
    }

    const cleanID = useID.trim().toLowerCase();
    const cleanCode = accessCode.trim();

    // 1. Check Super Admin Hard-Coded (as per existing logic in terminal/page.js)
    if (cleanID === 'superadmin' && accessCode === '147369') {
      return NextResponse.json({
        success: true,
        role: 'super_admin',
        session: 'prime-2026-active',
        user: {
          id: 'sa-root-001',
          name: 'Super Admin',
          roleLabel: 'Internal Operations Director'
        }
      });
    }

    // 2. Check Database for PM (Contacts table)
    // PMs log in with Full Name (username) or Email and their assigned Password (as accessCode)
    const result = await db.execute({
      sql: "SELECT * FROM contacts WHERE (LOWER(name) = ? OR LOWER(email) = ? OR cid = ?) AND password = ? LIMIT 1",
      args: [cleanID, cleanID, cleanID.toUpperCase(), cleanCode]
    });

    if (result.rows.length > 0) {
      const pm = result.rows[0];
      return NextResponse.json({
        success: true,
        role: 'pm',
        session: `pm-session-${pm.cid}`,
        user: {
          id: pm.cid,
          name: pm.name,
          roleLabel: 'Program Manager',
          email: pm.email
        }
      });
    }

    return NextResponse.json({ success: false, error: "Authentication Failed: Identity or Access Code Mismatch." }, { status: 401 });

  } catch (error) {
    console.error("Auth Error:", error);
    return NextResponse.json({ success: false, error: "System Security Exception" }, { status: 500 });
  }
}
