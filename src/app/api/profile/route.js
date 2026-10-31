import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { hashPassword } from "@/server/auth/password";
import { hashToken } from "@/lib/token-hashing";
import {
  getContactProfileFields,
  getContactSecondaryFields,
  getContactLoginActivity,
  updateContactCoreFields,
  updateContactSecondaryFields,
} from "@/models/workspace";
import { getContactWhatsappFields } from "@/models/contacts/whatsapp";
import {
  readWhatsappConsent,
  setWhatsappConsent,
  WHATSAPP_CONSENT_SOURCES,
} from "@/services/communications/whatsappConsent";
import { normalizeWhatsappPhone } from "@/lib/integrations/whatsapp/phone";
import { deleteUserSessionsExcept } from "@/models/authFlows";

/**
 * PROFILE COMPLETION API
 *
 * GET  /api/profile — read the current user's profile fields
 * PUT  /api/profile — update profile fields (first-login completion + optional secondary contact info)
 */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    }

    await initDb();
    const profileResult = await getContactProfileFields(session.cid);

    if (profileResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    const user = profileResult.rows[0];

    // Optional / recently-added columns. These may not exist yet in every
    // environment, so each read is best-effort and never fatal.
    //
    // IMPORTANT: login activity is read separately from secondary contact
    // fields. If they were bundled together, a single missing optional column
    // (e.g. alternative_email) would fail the whole query and incorrectly hide
    // last_login_at / login_count.
    let extras = {};
    try {
      const ext = await getContactSecondaryFields(session.cid);
      extras = ext.rows[0] || {};
    } catch (_) {
      extras = {};
    }

    let loginActivity = {};
    try {
      const ext = await getContactLoginActivity(session.cid);
      loginActivity = ext.rows[0] || {};
    } catch (_) {
      loginActivity = {};
    }

    // WhatsApp consent is its own record and must never break the profile read.
    let whatsappConsent = {
      opted_in: false,
      source: null,
      opted_in_at: null,
      opted_out_at: null,
    };
    try {
      whatsappConsent = await readWhatsappConsent(session.cid);
    } catch (_) {
      whatsappConsent = { opted_in: false, source: null, opted_in_at: null, opted_out_at: null };
    }

    // Determine if the required profile information is complete.
    const hasName = !!(user.name && user.name.trim().length > 0);
    const hasEmail = !!(user.email && user.email.trim().length > 0);
    const hasPhone = !!(user.phone && String(user.phone).trim().length > 0);
    const hasCountry = !!(extras.country_code || extras.country);
    const hasLanguage = !!(user.language && String(user.language).trim().length > 0);

    const mandatory = {
      name: !hasName,
      email: !hasEmail,
      phone: !hasPhone,
      country: !hasCountry,
      language: !hasLanguage,
    };
    const isComplete = !Object.values(mandatory).some(Boolean);

    return NextResponse.json({
      success: true,
      profile: {
        cid: session.cid,
        role: user.role,
        group_name: user.group_name,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        language: user.language,
        image: user.image || null,
        status: user.status || null,
        created_at: user.created_at || null,
        alternative_email: extras.alternative_email || null,
        alternative_phone: extras.alternative_phone || null,
        country: extras.country || null,
        country_code: extras.country_code || null,
        last_login_at: loginActivity.last_login_at || null,
        login_count: loginActivity.login_count || 0,
        whatsapp_opt_in: whatsappConsent.opted_in,
        whatsapp_opted_in_at: whatsappConsent.opted_in_at,
        whatsapp_consent_source: whatsappConsent.source,
      },
      mandatory,
      isComplete,
    });
  } catch (err) {
    console.error("[Profile] GET error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "errors.authRequired" },
        { status: 401 },
      );
    }

    await initDb();
    const body = await req.json();
    const {
      name,
      phone,
      address,
      language,
      password,
      image,
      alternative_email,
      alternative_phone,
      country,
      country_code,
      whatsapp_opt_in,
    } = body;

    // A person may agree to WhatsApp only on a number that actually resolves:
    // storing consent against an unusable number would make every later send
    // fail silently. Decided BEFORE any write, so a refusal changes nothing.
    let whatsappConsentChoice;
    if (whatsapp_opt_in !== undefined && whatsapp_opt_in !== null) {
      whatsappConsentChoice =
        whatsapp_opt_in === true || whatsapp_opt_in === 1 || whatsapp_opt_in === "1";

      if (whatsappConsentChoice) {
        let consentPhone = phone;
        let consentCountry = country_code;
        if (consentPhone === undefined || consentCountry === undefined) {
          const stored = await getContactWhatsappFields(session.cid);
          const row = stored.rows?.[0] || {};
          if (consentPhone === undefined) consentPhone = row.phone;
          if (consentCountry === undefined) consentCountry = row.country_code;
        }
        if (!normalizeWhatsappPhone(consentPhone, consentCountry)) {
          return NextResponse.json(
            {
              success: false,
              error: "adminMisc.profile.whatsappConsentNeedsPhone",
            },
            { status: 400 },
          );
        }
      }
    }

    // Build core update fields
    const updates = [];
    const args = [];

    if (name !== undefined) {
      updates.push("name = ?");
      args.push(name.trim());
    }
    if (phone !== undefined) {
      updates.push("phone = ?");
      args.push(phone || null);
    }
    if (address !== undefined) {
      updates.push("address = ?");
      args.push(address || null);
    }
    if (language !== undefined) {
      updates.push("language = ?");
      args.push(language);
    }
    if (image !== undefined) {
      updates.push("image = ?");
      args.push(image || null);
    }

    // Self-service password change (session-scoped — only the logged-in user)
    if (password !== undefined) {
      if (String(password).length < 6) {
        return NextResponse.json(
          { success: false, error: "Password must be at least 6 characters" },
          { status: 400 },
        );
      }
      updates.push("password = ?");
      args.push(await hashPassword(String(password)));
    }

    // Optional secondary contact fields. Kept separate so a missing column
    // never blocks the core profile save.
    const extUpdates = [];
    const extArgs = [];
    if (alternative_email !== undefined) {
      extUpdates.push("alternative_email = ?");
      extArgs.push(alternative_email || null);
    }
    if (alternative_phone !== undefined) {
      extUpdates.push("alternative_phone = ?");
      extArgs.push(alternative_phone || null);
    }
    if (country !== undefined) {
      extUpdates.push("country = ?");
      extArgs.push(country || null);
    }
    if (country_code !== undefined) {
      extUpdates.push("country_code = ?");
      extArgs.push(country_code || null);
    }

    if (updates.length === 0 && extUpdates.length === 0 && whatsappConsentChoice === undefined) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 },
      );
    }

    if (updates.length > 0) {
      await updateContactCoreFields(session.cid, updates, args);
      // Changing the password signs out every OTHER session; the one making the
      // change stays, so the user is not thrown out mid-action.
      if (password !== undefined) {
        await deleteUserSessionsExcept(session.cid, hashToken(session.token)).catch(() => {});
      }
    }

    if (extUpdates.length > 0) {
      try {
        await updateContactSecondaryFields(session.cid, extUpdates, extArgs);
      } catch (_) {
        // Column may not exist yet in this environment. The core fields above
        // have already been persisted, so this is non-fatal.
      }
    }

    if (whatsappConsentChoice !== undefined) {
      await setWhatsappConsent({
        cid: session.cid,
        accepted: whatsappConsentChoice,
        source: WHATSAPP_CONSENT_SOURCES.PROFILE,
        phone,
        countryCode: country_code,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated",
      profile_completed: name !== undefined && name.trim().length > 0,
      whatsapp_opt_in: whatsappConsentChoice,
    });
  } catch (err) {
    console.error("[Profile] PUT error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
