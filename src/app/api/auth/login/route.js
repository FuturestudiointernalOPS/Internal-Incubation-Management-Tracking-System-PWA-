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
    const cleanPassword = password.trim();
    
    // Search Database for User
    const result = await db.execute({
      sql: "SELECT * FROM contacts WHERE (email = ? OR id = ?) AND deleted = 0 LIMIT 1",
      args: [cleanEmail, cleanEmail]
    });

    let user = result.rows[0];
    let isTeamLogin = false;
    let isFamilyLogin = false;
    let permission = 'edit'; // Default for individuals and teams

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
      // Check for Family/Company Login (Shared Entity Credentials)
      const familyResult = await db.execute({
        sql: "SELECT * FROM families WHERE shared_email = ? LIMIT 1",
        args: [cleanEmail]
      });
      
      if (familyResult.rows.length > 0) {
        const family = familyResult.rows[0];
        // Check dual passwords
        if (password === family.shared_password_edit) {
           user = family;
           isFamilyLogin = true;
           permission = 'edit';
        } else if (password === family.shared_password_read) {
           user = family;
           isFamilyLogin = true;
           permission = 'read';
        }
      }
    }

    if (!user) {
      return NextResponse.json({ success: false, error: "Invalid credentials or unauthorized access." }, { status: 401 });
    }

    // --- CRYPTOGRAPHIC VERIFICATION ---
    // If it was a Family login, password was already checked
    if (!isFamilyLogin) {
      const isHashed = user.password && user.password.startsWith('$2');
      let isMatch = false;

      if (isHashed) {
        isMatch = await bcrypt.compare(cleanPassword, user.password);
      } else {
        isMatch = (cleanPassword === user.password);
      }

      if (!isMatch) {
        return NextResponse.json({ success: false, error: "Invalid credentials node." }, { status: 401 });
      }
    }

    // --- STATUS VERIFICATION GATE ---
    if (!isTeamLogin && !isFamilyLogin) {
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
      sql: `SELECT id FROM v2_programs WHERE assigned_assistant_id LIKE ? 
            UNION 
            SELECT id FROM v2_teams WHERE handler_id = ? 
            LIMIT 1`,
      args: [`%${user.id || user.cid}%`, user.id || user.cid]
    });

    // --- STRATEGIC ROLE RESOLUTION (SINGLE-ADMIN HIERARCHY) ---
    let finalRole = 'participant';

    if (isTeamLogin) {
      finalRole = 'team';
    } 
    else if (isFamilyLogin) {
       finalRole = 'participant'; // Family entity acts like a participant but with group data
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
    if ((finalRole === 'super_admin' || finalRole === 'program_manager' || finalRole === 'staff' || finalRole === 'teacher') && !isTerminal) {
       return NextResponse.json({ 
         success: false, 
         error: "Staff account detected. Please use the secure Future Studio Terminal at /terminal to log in." 
       }, { status: 403 });
    }

    if (finalRole === 'participant' && !isFamilyLogin) {
      if (!user.group_name || user.group_name === 'unassigned') {
        return NextResponse.json({ 
          success: false, 
          error: "Access Denied: You must be assigned to an active Program to log in." 
        }, { status: 403 });
      }
    }

    // For Family login, we need to map some fields to match participant structure
    const responseUser = isFamilyLogin ? {
       ...user,
       cid: user.registration_id, // Map reg ID to CID for dashboard lookup
       name: user.name,
       group_name: user.name,
       role: 'participant',
       is_entity: true,
       permission: permission
    } : { ...user, role: finalRole, permission: 'edit' };

    if (isTeamLogin) {
       responseUser.team_id = user.id;
    }

    return NextResponse.json({ success: true, user: responseUser });


  } catch (err) {
    console.error("Auth V1 Error:", err);
    return NextResponse.json({ success: false, error: "Authentication system failure." }, { status: 500 });
  }
}
