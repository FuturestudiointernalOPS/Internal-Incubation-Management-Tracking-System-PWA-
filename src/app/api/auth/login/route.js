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
      sql: "SELECT * FROM contacts WHERE (email = ? OR id = ?) AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
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
            error: "Access Denied: Your account is inactive.",
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
      if (user.status === "archived" || user.archived_at != null) {
        return NextResponse.json(
          {
            success: false,
            error: "Access Denied: Your account has been archived.",
          },
          { status: 403 },
        );
      }
      // Any other status that getSession() will not accept (unknown, null,
      // etc.) must be rejected HERE so a session is never created that the
      // very next request would invalidate (login loop).
      if (!["active", "approved"].includes(user.status)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Access Denied: Your account is not active. Contact your administrator.",
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
      sql: `SELECT id::text FROM v2_programs WHERE assigned_assistant_id LIKE ?
            UNION
            SELECT id::text FROM v2_teams WHERE handler_id = ?
            LIMIT 1`,
      args: [`%${userCid}%`, userCid],
    });

    // External facilitators are program-scoped: only resolved when they hold
    // a facilitator assignment (or carry the facilitator contact role).
    const hasFacilitatorAssignment = async (cid, email) => {
      try {
        const facRes = await db.execute({
          sql: "SELECT 1 FROM v2_program_staff WHERE role = 'facilitator' AND (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(TRIM(?))) LIMIT 1",
          args: [cid, email || ""],
        });
        return facRes.rows.length > 0;
      } catch (_) {
        return false;
      }
    };

    // --- STRATEGIC ROLE RESOLUTION (SINGLE-ADMIN HIERARCHY) ---
    let finalRole = "participant";

    if (isTeamLogin) {
      finalRole = "team";
    } else if (isFamilyLogin) {
      finalRole = "participant"; // Family entity acts like a participant but with group data
    } else if (user.role === "super_admin" || user.id === "sa") {
      finalRole = "super_admin";
    } else if (user.role === "developer") {
      finalRole = "developer";
    } else if (user.role === "investor") {
      finalRole = "investor";
    } else if (user.role === "founder") {
      finalRole = "founder";
    } else if (pmLeadAssignment.rows.length > 0) {
      finalRole = "program_manager"; // Project Manager (Head)
    } else if (
      user.role === "staff" ||
      user.role === "project_manager" ||
      user.role === "admin" ||
      user.group_name?.toUpperCase() === "FUTURE STUDIO"
    ) {
      // Internal Future Studio staff keep their identity — being assigned as
      // a program assistant / team handler must NOT turn them into a teacher.
      finalRole = "staff"; // internal Future Studio team
    } else if (user.role === "facilitator" || (await hasFacilitatorAssignment(userCid, user.email))) {
      finalRole = "facilitator"; // program-scoped external facilitator
    } else if (activeTeammateAssignment.rows.length > 0) {
      finalRole = "teacher"; // Active Teammate
    } else if (user.role === "teacher") {
      finalRole = "teacher";
    } else if (user.role === "member") {
      // Neutral "member" = a valid person with no global role yet.
      finalRole = "member";
    } else if (user.role === "participant") {
      finalRole = "participant";
    } else if (
      user.role === "project_manager" ||
      user.group_name?.toUpperCase() === "FUTURE STUDIO"
    ) {
      finalRole = "staff"; // internal Future Studio team
    }

    // Load user language preference from contact record (not families/teams)
    if (!isTeamLogin && !isFamilyLogin && user.language) {
      userLanguage = user.language;
    }

    // A participant with no group and no program is effectively an unassigned
    // neutral member. Downgrade instead of rejecting so they reach the empty
    // workspace hub rather than a broken participant dashboard.
    if (finalRole === "participant" && !isFamilyLogin) {
      const hasDirectProgram =
        user.program_id && String(user.program_id).trim();
      let hasParticipantPrograms = false;
      if (!hasDirectProgram && user.cid) {
        try {
          const ppRes = await db.execute({
            sql: "SELECT 1 FROM participant_programs WHERE participant_id = ?",
            args: [user.cid],
          });
          hasParticipantPrograms = ppRes.rows.length > 0;
        } catch (_) {}
      }
      const groupName = String(user.group_name || "").trim().toLowerCase();
      const hasGroup = !!groupName && groupName !== "unassigned";
      if (!hasGroup && !hasDirectProgram && !hasParticipantPrograms) {
        finalRole = "member";
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

    // --- LOGIN ACTIVITY TRACKING (successful login only) ---
    // Record the successful authentication AFTER all access gates have passed.
    // Failed logins, activation emails, approval emails, and password-reset
    // emails must never update these fields.
    if (!isTeamLogin && !isFamilyLogin && user.cid) {
      try {
        await db.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ");
        await db.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ");
        await db.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0");
        await db.execute({
          sql: "UPDATE contacts SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE cid = ?",
          args: [user.cid],
        });
      } catch (_) {}
    }

    // Create session (DB insert) and get token
    try {
      const { token, maxAge } = await createSession(
        responseUser.cid || responseUser.id,
        finalRole,
      );
      // Build response and set cookie directly on it
      const response = NextResponse.json({ success: true, user: responseUser });
      return setSessionCookieOnResponse(
        response,
        token,
        maxAge,
        req.headers.get("host"),
      );
    } catch (sessionErr) {
      console.error("Session creation failed:", sessionErr.message);
      // NEVER return success without a session cookie — that is what turns a
      // DB/schema failure into an endless login->redirect loop.
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not start a secure session. Please try again in a moment.",
        },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error("Auth V1 Error:", err);
    return NextResponse.json(
      { success: false, error: "Authentication system failure." },
      { status: 500 },
    );
  }
}
