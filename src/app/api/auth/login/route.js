import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    await initDb();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Credentials required." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Check Super Admin hardcoded (as requested to keep a fallback/standard access)
    if (cleanEmail === 'superadmin@impactos.com' && password === 'access-2026') {
        return NextResponse.json({ 
            success: true, 
            user: { id: 'sa', name: 'Master Command', email: 'superadmin@impactos.com', role: 'super_admin' } 
        });
    }

    // Search Database
    const result = await db.execute({
      sql: "SELECT * FROM contacts WHERE email = ? AND password = ? AND deleted = 0 LIMIT 1",
      args: [cleanEmail, password]
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Invalid credentials or unauthorized access." }, { status: 401 });
    }

    const user = result.rows[0];

    // Check Assignments
    const pmAssignment = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ? LIMIT 1",
      args: [user.id || user.cid]
    });

    const handlerAssignment = await db.execute({
      sql: "SELECT id FROM v2_teams WHERE handler_id = ? LIMIT 1",
      args: [user.id || user.cid]
    });

    // Determine high-level role
    let finalRole = user.roleLabel || 'participant';
    if (pmAssignment.rows.length > 0) finalRole = 'program_manager';
    else if (handlerAssignment.rows.length > 0) finalRole = 'teacher'; // Handler acts as Teacher/Reviewer

    // Check if assigned to a group (Program) - Enforce entry criteria
    if (!user.group_name || user.group_name === 'unassigned') {
      if (finalRole === 'participant') {
        return NextResponse.json({ 
          success: false, 
          error: "Access Denied: You must be assigned to an active Program to log in." 
        }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, user: { ...user, role: finalRole } });

  } catch (err) {
    return NextResponse.json({ success: false, error: "Authentication system failure." }, { status: 500 });
  }
}
