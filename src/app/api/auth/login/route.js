import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    await initDb();
    const { email, password, isTerminal } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "Credentials required." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Search Database for User
    const result = await db.execute({
      sql: "SELECT * FROM contacts WHERE (email = ? OR id = ?) AND deleted = 0 LIMIT 1",
      args: [cleanEmail, cleanEmail]
    });

    let user = result.rows[0];
    let isTeamLogin = false;

    if (!user) {
      // Check for Team Login
      const teamResult = await db.execute({
        sql: "SELECT * FROM v2_teams WHERE team_username = ? LIMIT 1",
        args: [cleanEmail]
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

    // --- STATUS VERIFICATION GATE ---
    if (!isTeamLogin) {
      if (user.status === 'inactive') {
        return NextResponse.json({ success: false, error: "Access Denied: Your account has been suspended." }, { status: 403 });
      }
      if (user.status === 'pending') {
        return NextResponse.json({ success: false, error: "Access Denied: Your account is currently pending verification." }, { status: 403 });
      }
    }

    // Check Assignments
    const pmLeadAssignment = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ? LIMIT 1",
      args: [user.id || user.cid]
    });

    const activeTeammateAssignment = await db.execute({
      sql: `SELECT id FROM v2_programs WHERE assigned_assistant_id = ? 
            UNION 
            SELECT id FROM v2_teams WHERE handler_id = ? 
            LIMIT 1`,
      args: [user.id || user.cid, user.id || user.cid]
    });

    // --- STRATEGIC ROLE RESOLUTION (SINGLE-ADMIN HIERARCHY) ---
    let finalRole = 'participant';

    if (isTeamLogin) {
      finalRole = 'team';
    } 
    else if (user.role === 'super_admin' || user.id === 'sa') {
      finalRole = 'super_admin';
    } 
    else if (pmLeadAssignment.rows.length > 0) {
      finalRole = 'program_manager'; // Project Manager (Head)
    } 
    else if (activeTeammateAssignment.rows.length > 0) {
      finalRole = 'teacher'; // Active Teammate
    }
    else if (user.role === 'project_manager' || user.group_name?.toUpperCase() === 'STAFF' || user.group_name?.toUpperCase() === 'FUTURE STUDIO') {
      finalRole = 'staff'; // Ordinary Teammate / Operations Staff (Unassigned)
    } 

    // --- ACCESS CONTROL GATE ---
    // If user is Staff/Admin and NOT logging in via Terminal, block them.
    if ((finalRole === 'super_admin' || finalRole === 'program_manager' || finalRole === 'staff' || finalRole === 'teacher') && !isTerminal) {
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
