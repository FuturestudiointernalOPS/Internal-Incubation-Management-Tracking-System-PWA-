import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    await initDb();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Credentials required." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Check Super Admin hardcoded (Gwyn is the only Master)
    if ((cleanEmail === 'superadmin@impactos.com' || cleanEmail === 'gwyn.ukoha@gmail.com') && password === 'access-2026') {
        return NextResponse.json({ 
            success: true, 
            user: { id: 'sa', name: 'Gwyn Ukoha', email: cleanEmail, role: 'super_admin' } 
        });
    }

    // Search Database for User
    const result = await db.execute({
      sql: "SELECT * FROM contacts WHERE email = ? AND deleted = 0 LIMIT 1",
      args: [cleanEmail]
    });

    let user = result.rows[0];
    let isTeamLogin = false;

    if (!user) {
      // Check for Team Login
      const teamResult = await db.execute({
        sql: "SELECT * FROM v2_teams WHERE team_username = ? LIMIT 1",
        args: [email] // Using the same input as "email" for username
      });
      
      if (teamResult.rows.length > 0) {
        user = teamResult.rows[0];
        isTeamLogin = true;
      }
    }

    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid credentials or unauthorized access." }, { status: 401 });
    }

    // --- CRYPTOGRAPHIC VERIFICATION ---
    // If the stored password is not hashed (legacy), we do a plain compare. 
    // If it is hashed, we use bcrypt.
    const isHashed = user.password && user.password.startsWith('$2');
    let isMatch = false;

    if (isHashed) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = (password === user.password);
    }

    if (!isMatch) {
      return NextResponse.json({ success: false, error: "Invalid credentials node." }, { status: 401 });
    }

    // Check Assignments
    const pmAssignment = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ? LIMIT 1",
      args: [user.id || user.cid]
    });

    const handlerAssignment = await db.execute({
      sql: "SELECT id FROM v2_teams WHERE handler_id = ? LIMIT 1",
      args: [user.id || user.cid]
    });

    // --- STRATEGIC ROLE RESOLUTION (SINGLE-ADMIN HIERARCHY) ---
    let finalRole = 'participant';

    if (isTeamLogin) {
      finalRole = 'team';
    } 
    // 1. Unique Super Admin Validation
    else if (user.email?.toLowerCase() === 'gwyn.ukoha@gmail.com') {
      finalRole = 'super_admin';
    } 
    // 2. Project Leadership Detection
    else if (pmAssignment.rows.length > 0 || user.role === 'project_manager' || user.group_name?.toUpperCase() === 'STAFF' || user.group_name?.toUpperCase() === 'FUTURE STUDIO') {
      // All other staff are manifest as Program Managers
      finalRole = 'program_manager';
    } 
    // 3. Tactical Handler Detection
    else if (handlerAssignment.rows.length > 0) {
      finalRole = 'teacher'; 
    }

    // --- ACCESS CONTROL GATE ---
    if (finalRole === 'super_admin' || finalRole === 'program_manager') {
       return NextResponse.json({ 
         success: false, 
         error: "Staff account detected. Please use the secure Future Studio Terminal at /terminal to log in." 
       }, { status: 403 });
    }

    if (finalRole === 'participant') {
      if (!user.group_name || user.group_name === 'unassigned') {
        return NextResponse.json({ 
          success: false, 
          error: "Access Denied: You must be assigned to an active Program to log in." 
        }, { status: 403 });
      }
    }

    if (finalRole === 'team') {
       // Teams are always authorized if they exist
       return NextResponse.json({ success: true, user: { ...user, role: finalRole, team_id: user.id } });
    }

    return NextResponse.json({ success: true, user: { ...user, role: finalRole } });

  } catch (err) {
    console.error("Auth V1 Error:", err);
    return NextResponse.json({ success: false, error: "Authentication system failure." }, { status: 500 });
  }
}
