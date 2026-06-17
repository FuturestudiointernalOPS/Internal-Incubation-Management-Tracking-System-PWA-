import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession, setSessionCookieOnResponse } from "@/lib/auth";

export async function POST(req) {
  try {
    await initDb();
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password required." },
        { status: 400 },
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // --- 1. SEARCH CONTACTS ---
    let user = null;
    let isTeamLogin = false;
    let isFamilyLogin = false;
    let permission = "edit";

    const contactResult = await db.execute({
      sql: "SELECT * FROM contacts WHERE (email = ? OR cid = ?) AND deleted = 0 LIMIT 1",
      args: [cleanEmail, cleanEmail],
    });

    if (contactResult.rows.length > 0) {
      user = contactResult.rows[0];
    }

    // --- 2. TEAM LOGIN (if not found in contacts) ---
    if (!user) {
      const teamResult = await db.execute({
        sql: "SELECT * FROM v2_teams WHERE team_username = ? LIMIT 1",
        args: [cleanEmail],
      });
      if (teamResult.rows.length > 0) {
        user = teamResult.rows[0];
        isTeamLogin = true;
      }
    }

    // --- 3. FAMILY LOGIN (if not found in contacts or teams) ---
    if (!user) {
      const familyResult = await db.execute({
        sql: "SELECT * FROM families WHERE shared_email = ? LIMIT 1",
        args: [cleanEmail],
      });
      if (familyResult.rows.length > 0) {
        const family = familyResult.rows[0];
        if (cleanPassword === family.shared_password_edit) {
          user = family;
          isFamilyLogin = true;
          permission = "edit";
        } else if (cleanPassword === family.shared_password_read) {
          user = family;
          isFamilyLogin = true;
          permission = "read";
        }
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials." },
        { status: 401 },
      );
    }

    // --- 4. PASSWORD VERIFICATION ---
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
          { success: false, error: "Invalid credentials." },
          { status: 401 },
        );
      }
    }

    // --- 5. STATUS CHECK (not for teams/families) ---
    if (!isTeamLogin && !isFamilyLogin) {
      if (user.status === "pending") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Your account is pending approval. Please wait for an administrator to approve your account.",
          },
          { status: 403 },
        );
      }
      if (user.status === "inactive" || user.status === "suspended") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Your account has been suspended. Contact your administrator.",
          },
          { status: 403 },
        );
      }
    }

    // --- 6. ROLE RESOLUTION ---
    let finalRole = "participant";
    const userCid = user.cid || user.id;

    if (isTeamLogin) {
      finalRole = "team";
    } else if (isFamilyLogin) {
      finalRole = "participant";
    } else {
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

      if (user.role === "super_admin" || user.id === "sa") {
        finalRole = "super_admin";
      } else if (pmLeadAssignment.rows.length > 0) {
        finalRole = "program_manager";
      } else if (activeTeammateAssignment.rows.length > 0) {
        finalRole = "teacher";
      } else if (user.role === "participant") {
        finalRole = "participant";
      } else if (
        user.role === "staff" ||
        user.role === "project_manager" ||
        user.role === "admin" ||
        (user.group_name || "").toUpperCase().includes("STAFF")
      ) {
        finalRole = "staff";
      } else if (
        (user.group_name || "").toUpperCase().includes("FUTURE STUDIO")
      ) {
        // Only fallback to group_name if role is not explicitly set
        finalRole = "staff";
      }
    }

    // Allow participants with group_name="unassigned" if they have valid program assignments
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
      if (!user.group_name || user.group_name === "unassigned") {
        if (!hasDirectProgram && !hasParticipantPrograms) {
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
    }

    // --- 7. BUILD RESPONSE USER ---
    let responseUser;
    if (isFamilyLogin) {
      responseUser = {
        cid: user.registration_id,
        name: user.name,
        email: user.shared_email,
        role: "participant",
        group_name: user.name,
        is_entity: true,
        permission: permission,
        language: "en",
      };
    } else if (isTeamLogin) {
      responseUser = {
        cid: userCid,
        name: user.name || user.team_name || user.team_username,
        email: user.team_username,
        role: "team",
        group_name: user.group_name || "",
        team_id: user.id,
        language: "en",
      };
    } else {
      responseUser = {
        cid: userCid,
        name: user.name,
        email: user.email,
        role: finalRole,
        group_name: user.group_name,
        language: user.language || "en",
        permission: "edit",
      };
    }

    // --- 8. CREATE SESSION & RETURN ---
    const { token, maxAge } = await createSession(
      responseUser.cid || responseUser.id,
      isTeamLogin ? "team" : isFamilyLogin ? "participant" : finalRole,
    );

    const response = NextResponse.json({
      success: true,
      user: responseUser,
    });

    return setSessionCookieOnResponse(response, token, maxAge);
  } catch (error) {
    console.error("Session login error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication system failure." },
      { status: 500 },
    );
  }
}
