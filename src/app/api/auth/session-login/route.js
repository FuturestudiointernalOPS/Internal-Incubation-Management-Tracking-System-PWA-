import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { verifyPassword } from "@/server/auth/password";
import { createSession, setSessionCookieOnResponse } from "@/lib/auth";
import { resolveLanding, landingNeedsRelationships } from "@/lib/platform/roles";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { getVentureMembershipsForContact } from "@/models/contacts";
import { getApprovedInvestorProfileIdByUserId } from "@/models/investor";
import {
  getContactByEmailOrCid,
  getTeamByUsernameForSessionLogin,
  getFamilyBySharedEmailForSessionLogin,
  getParticipantProgramRecordForSessionLogin,
  getLmsEnrollmentRecordForSessionLogin,
  ensureContactsLastLoginColumn,
  ensureContactsLoginCountColumn,
  recordContactLoginActivity,
} from "@/models/authFlows";

export async function POST(req) {
  try {
    await initDb();

    // Rate limit: 20 attempts per IP / 15 min, plus 10 per account below.
    const ipLimited = enforceRateLimit(req, `login:ip:${getClientIp(req)}`, {
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (ipLimited) return ipLimited;

    const { email, password, remember_me } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password required." },
        { status: 400 },
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    const accountLimited = enforceRateLimit(req, `login:account:${cleanEmail}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (accountLimited) return accountLimited;

    // --- 1. SEARCH CONTACTS ---
    let user = null;
    let isTeamLogin = false;
    let isFamilyLogin = false;
    let permission = "edit";

    const contactResult = await getContactByEmailOrCid(cleanEmail);

    if (contactResult.rows.length > 0) {
      user = contactResult.rows[0];
    }

    // --- 2. TEAM LOGIN (if not found in contacts) ---
    if (!user) {
      const teamResult = await getTeamByUsernameForSessionLogin(cleanEmail);
      if (teamResult.rows.length > 0) {
        user = teamResult.rows[0];
        isTeamLogin = true;
      }
    }

    // --- 3. FAMILY LOGIN (if not found in contacts or teams) ---
    if (!user) {
      const familyResult = await getFamilyBySharedEmailForSessionLogin(cleanEmail);
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
        isMatch = await verifyPassword(cleanPassword, user.password);
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
      } else if (user.role === "investor") {
        finalRole = "investor";
      } else if (user.role === "founder") {
        finalRole = "founder";
      } else if (user.role === "program_manager") {
        finalRole = "program_manager";
      } else if (
        user.role === "staff" ||
        user.role === "project_manager" ||
        user.group_name?.toUpperCase() === "FUTURE STUDIO"
      ) {
        // Internal Future Studio staff keep their identity — being assigned as
        // a program assistant / team handler must NOT change their identity.
        finalRole = "staff";
      } else if (user.role === "facilitator") {
        // Explicit facilitator role; program-scoped access is still resolved
        // per assignment by the facilitator workspace and its guards.
        finalRole = "facilitator";
      } else if (user.role === "member") {
        // Neutral "member" means a person exists on the platform but has no
        // global role yet. Preserve it — never collapse it into participant.
        finalRole = "member";
      } else if (user.role === "participant") {
        finalRole = "participant";
      }
    }

    // The person's Venture memberships are read ONCE here, because two rules in
    // this route need them: whether an unassigned participant is really neutral,
    // and where this person belongs (§7b). They replace a narrower probe that
    // looked in only ONE of the two identity columns and ignored removals — so
    // someone removed from a Venture, or recorded under the other column, was
    // judged to have no relationship at all and could lose the participant
    // identity on the spot.
    //
    // The approved investor context rides in the same wave: a baseline "member"
    // who has been made an investor belongs in the investor space, and that fact
    // lives in their investor profile, not in their badge.
    //
    // A global identity's landing never depends on these, so such a login pays
    // for no extra read.
    let ventureMemberships = [];
    let isInvestor = false;
    if (!isTeamLogin && !isFamilyLogin && landingNeedsRelationships(finalRole)) {
      try {
        const [ventureMembershipsResult, investorProfileResult] = await Promise.all([
          getVentureMembershipsForContact(userCid),
          getApprovedInvestorProfileIdByUserId(userCid),
        ]);
        ventureMemberships = ventureMembershipsResult.rows || [];
        isInvestor = (investorProfileResult.rows || []).length > 0;
      } catch (_) {}
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
      if (!hasDirectProgram && userCid) {
        try {
          const [participantProgramResult, lmsEnrollmentResult] = await Promise.all([
            getParticipantProgramRecordForSessionLogin(userCid),
            getLmsEnrollmentRecordForSessionLogin(userCid),
          ]);
          hasParticipantPrograms = participantProgramResult.rows.length > 0;
          hasLms = lmsEnrollmentResult.rows.length > 0;
        } catch (_) {}
      }
      if (
        !hasDirectProgram &&
        !hasParticipantPrograms &&
        !hasLms &&
        ventureMemberships.length === 0
      ) {
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

    // --- 7b. WHERE THIS PERSON BELONGS ---
    // Decided HERE, from the relationships just read, and returned WITH the
    // identity: every client surface that already holds the signed-in person
    // (the login redirect, the root bounce) then uses this same answer instead of
    // re-deriving a destination from a badge that cannot carry the context.
    // The rule itself lives in src/models/platform/roles.js.
    responseUser.home = resolveLanding({
      role: responseUser.role,
      teamId: responseUser.team_id || null,
      ventures: ventureMemberships,
      isInvestor,
    });

    // --- LOGIN ACTIVITY TRACKING (successful login only) ---
    if (!isTeamLogin && !isFamilyLogin && user.cid) {
      try {
        await ensureContactsLastLoginColumn();
        await ensureContactsLoginCountColumn();
        await recordContactLoginActivity(user.cid);
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
