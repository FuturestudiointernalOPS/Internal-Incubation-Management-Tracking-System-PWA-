import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession, setSessionCookieOnResponse } from "@/lib/auth";

export async function POST(req) {
  try {
    await initDb();
    const { email, password, remember_me } = await req.json();

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
      sql: "SELECT * FROM contacts WHERE (email = ? OR cid = ?) AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
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
              "Your account is inactive. Contact your administrator.",
          },
          { status: 403 },
        );
      }
      // Any other status that getSession() will not accept (archived, unknown,
      // null, etc.) is rejected HERE so a session is never created that the
      // very next request would invalidate (login loop).
      if (!["active", "approved"].includes(user.status)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Your account is not active. Contact your administrator.",
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
      if (user.role === "super_admin" || user.id === "sa") {
        finalRole = "super_admin";
      } else if (user.role === "developer") {
        finalRole = "developer";
      } else if (user.role === "investor") {
        finalRole = "investor";
      } else if (user.role === "founder") {
        finalRole = "founder";
      } else if (user.role === "program_manager") {
        finalRole = "program_manager";
      } else if (
        user.role === "staff" ||
        user.role === "project_manager" ||
        user.role === "admin" ||
        user.group_name?.toUpperCase() === "FUTURE STUDIO"
      ) {
        // Internal Future Studio staff keep their identity — being assigned as
        // a program assistant / team handler must NOT turn them into a teacher.
        finalRole = "staff";
      } else if (user.role === "facilitator") {
        // Explicit facilitator role; program-scoped access is still resolved
        // per assignment by the facilitator workspace and its guards.
        finalRole = "facilitator";
      } else if (user.role === "teacher") {
        finalRole = "teacher";
      } else if (user.role === "investor") {
        finalRole = "investor";
      } else if (user.role === "member") {
        // Neutral "member" means a person exists on the platform but has no
        // global role yet. Preserve it — never collapse it into participant.
        finalRole = "member";
      } else if (user.role === "participant") {
        finalRole = "participant";
      }
    }

    // A participant with no real relationship (program, LMS course or venture
    // membership) is effectively an unassigned neutral member. Instead of
    // rejecting them, downgrade to member so they land on the empty workspace
    // hub (no assignment is a valid state). A plain group alone is NOT a
    // relationship — it cannot keep the participant designation.
    if (finalRole === "participant" && !isFamilyLogin) {
      const hasDirectProgram =
        user.program_id && String(user.program_id).trim();
      let hasParticipantPrograms = false;
      let hasLms = false;
      let hasVenture = false;
      if (!hasDirectProgram && user.cid) {
        try {
          const [ppRes, lmsRes, ventureRes] = await Promise.all([
            db.execute({
              sql: "SELECT 1 FROM participant_programs WHERE participant_id = ?",
              args: [user.cid],
            }),
            db.execute({
              sql: "SELECT 1 FROM lms_enrollments WHERE user_cid = ? LIMIT 1",
              args: [user.cid],
            }),
            db.execute({
              sql: "SELECT 1 FROM venture_members WHERE user_cid = ? LIMIT 1",
              args: [user.cid],
            }),
          ]);
          hasParticipantPrograms = ppRes.rows.length > 0;
          hasLms = lmsRes.rows.length > 0;
          hasVenture = ventureRes.rows.length > 0;
        } catch (_) {}
      }
      if (!hasDirectProgram && !hasParticipantPrograms && !hasLms && !hasVenture) {
        finalRole = "member";
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
      const isFirstLogin = !user.login_count || Number(user.login_count) === 0;
      responseUser = {
        cid: userCid,
        name: user.name,
        email: user.email,
        role: finalRole,
        group_name: user.group_name,
        language: user.language || "en",
        permission: "edit",
        is_first_login: isFirstLogin,
      };
    }

    // --- LOGIN ACTIVITY TRACKING (successful login only) ---
    if (!isTeamLogin && !isFamilyLogin && user.cid) {
      try {
        await db.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ");
        await db.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0");
        await db.execute({
          sql: "UPDATE contacts SET last_login_at = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE cid = ?",
          args: [user.cid],
        });
      } catch (_) {}
    }

    // --- 8. CREATE SESSION & RETURN ---
    const { token, maxAge } = await createSession(
      responseUser.cid || responseUser.id,
      isTeamLogin ? "team" : isFamilyLogin ? "participant" : finalRole,
      remember_me || false,
    );

    const response = NextResponse.json({
      success: true,
      user: responseUser,
    });

    return setSessionCookieOnResponse(
      response,
      token,
      maxAge,
      req.headers.get("host"),
    );
  } catch (error) {
    console.error("Session login error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication system failure." },
      { status: 500 },
    );
  }
}
