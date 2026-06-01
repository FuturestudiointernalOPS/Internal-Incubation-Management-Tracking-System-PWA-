import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { createSession, setSessionCookieOnResponse } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    await initDb();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Credentials required." },
        { status: 400 },
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Fetch user language preference
    let userLanguage = "en";

    // Search Database for User
    const result = await db.execute({
      sql: "SELECT * FROM contacts WHERE (email = ? OR id = ?) AND deleted = 0 LIMIT 1",
      args: [cleanEmail, cleanEmail],
    });

    let user = result.rows[0];
    let isTeamLogin = false;
    let isFamilyLogin = false;
    let permission = "edit"; // Default for individuals and teams

    if (!user) {
      // Check for Team Login
      const teamResult = await db.execute({
        sql: "SELECT * FROM v2_teams WHERE team_username = ? LIMIT 1",
        args: [cleanEmail],
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
        args: [cleanEmail],
      });

      if (familyResult.rows.length > 0) {
        const family = familyResult.rows[0];
        // Check dual passwords
        if (password === family.shared_password_edit) {
          user = family;
          isFamilyLogin = true;
          permission = "edit";
        } else if (password === family.shared_password_read) {
          user = family;
          isFamilyLogin = true;
          permission = "read";
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid credentials or unauthorized access.",
        },
        { status: 401 },
      );
    }

    // --- CRYPTOGRAPHIC VERIFICATION ---
    // If it was a Family login, password was already checked
    if (!isFamilyLogin) {
      const isHashed = user.password && user.password.startsWith("$2");
      let isMatch = false;

      if (isHashed) {
        isMatch = await bcrypt.compare(cleanPassword, user.password);
      } else {
        isMatch = cleanPassword === user.password;
      }

      if (!isMatch) {
        return NextResponse.json(
          { success: false, error: "Invalid credentials node." },
          { status: 401 },
        );
      }
    }

    // --- STATUS VERIFICATION GATE ---
    if (!isTeamLogin && !isFamilyLogin) {
      if (user.status === "inactive") {
        return NextResponse.json(
          {
            success: false,
            error: "Access Denied: Your account has been suspended.",
          },
          { status: 403 },
        );
      }
      if (user.status === "pending") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Access Denied: Your account is currently pending verification.",
          },
          { status: 403 },
        );
      }
    }

    // Check Assignments using CID
    const userCid = user.cid || user.id; // Fallback for legacy

    const pmLeadAssignment = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE assigned_pm_id = ? LIMIT 1",
      args: [userCid],
    });

    const activeTeammateAssignment = await db.execute({
      sql: `SELECT id FROM v2_programs WHERE assigned_assistant_id LIKE ?
            UNION
            SELECT id FROM v2_teams WHERE handler_id = ?
            LIMIT 1`,
      args: [`%${userCid}%`, userCid],
    });

    // --- STRATEGIC ROLE RESOLUTION (SINGLE-ADMIN HIERARCHY) ---
    let finalRole = "participant";

    if (isTeamLogin) {
      finalRole = "team";
    } else if (isFamilyLogin) {
      finalRole = "participant"; // Family entity acts like a participant but with group data
    } else if (user.role === "super_admin" || user.id === "sa") {
      finalRole = "super_admin";
    } else if (pmLeadAssignment.rows.length > 0) {
      finalRole = "program_manager"; // Project Manager (Head)
    } else if (activeTeammateAssignment.rows.length > 0) {
      finalRole = "teacher"; // Active Teammate
    } else if (
      user.role === "project_manager" ||
      user.group_name?.toUpperCase() === "STAFF" ||
      user.group_name?.toUpperCase() === "FUTURE STUDIO"
    ) {
      finalRole = "staff"; // Ordinary Teammate / Operations Staff (Unassigned)
    }

    // Load user language preference from contact record (not families/teams)
    if (!isTeamLogin && !isFamilyLogin && user.language) {
      userLanguage = user.language;
    }

    if (finalRole === "participant" && !isFamilyLogin) {
      if (!user.group_name || user.group_name === "unassigned") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Access Denied: You must be assigned to an active Program to log in.",
          },
          { status: 403 },
        );
      }
    }

    // For Family login, we need to map some fields to match participant structure
    const responseUser = isFamilyLogin
      ? {
          ...user,
          cid: user.registration_id, // Map reg ID to CID for dashboard lookup
          name: user.name,
          group_name: user.name,
          role: "participant",
          is_entity: true,
          permission: permission,
        }
      : {
          ...user,
          role: finalRole,
          permission: "edit",
          language: userLanguage,
        };

    if (isTeamLogin) {
      responseUser.team_id = user.id;
    }

    // Create session (DB insert) and get token
    try {
      const { token, maxAge } = await createSession(
        responseUser.cid || responseUser.id,
        finalRole,
      );
      // Build response and set cookie directly on it
      const response = NextResponse.json({ success: true, user: responseUser });
      return setSessionCookieOnResponse(response, token, maxAge);
    } catch (sessionErr) {
      console.error("Session creation failed:", sessionErr.message);
      // Still return success so user can proceed (degraded UX)
      return NextResponse.json({ success: true, user: responseUser });
    }
  } catch (err) {
    console.error("Auth V1 Error:", err);
    return NextResponse.json(
      { success: false, error: "Authentication system failure." },
      { status: 500 },
    );
  }
}
