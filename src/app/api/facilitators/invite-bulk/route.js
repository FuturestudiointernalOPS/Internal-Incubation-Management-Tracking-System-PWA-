import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { sendInviteEmail, sendLoginEmail } from "@/lib/email";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import {
  buildFullFacilitatorPermissions,
  parsePermissions,
} from "@/lib/facilitator-permissions";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function analyzeEmail(email, programId) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean || !EMAIL_RE.test(clean)) {
    return { email: clean, status: "invalid" };
  }

  const existing = await db.execute({
    sql: "SELECT cid, name, password FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [clean],
  });
  const row = existing.rows[0];
  const accountActivated = !!(row && String(row.password || "").trim());
  const contactCid = row?.cid || "";

  if (contactCid) {
    const dup = await db.execute({
      sql: "SELECT 1 FROM v2_program_staff WHERE program_id::text = ? AND staff_id::text = ? AND role = 'facilitator' LIMIT 1",
      args: [String(programId), String(contactCid)],
    });
    if (dup.rows.length > 0) {
      return {
        email: clean,
        status: "already_facilitator",
        contactCid,
        name: row.name || "",
      };
    }
  }

  const conflict = await db.execute({
    sql: `SELECT 1 FROM participant_programs WHERE participant_id::text = ? AND program_id::text = ?
          UNION
          SELECT 1 FROM v2_participants WHERE program_id::text = ? AND (email = ? OR user_id = ?)
          LIMIT 1`,
    args: [String(contactCid), String(programId), String(programId), clean, String(contactCid)],
  });
  if (conflict.rows.length > 0) {
    return {
      email: clean,
      status: "conflict",
      contactCid,
      name: row?.name || "",
    };
  }

  return {
    email: clean,
    status: contactCid ? "existing_contact" : "new_contact",
    contactCid,
    name: row?.name || "",
    accountActivated,
  };
}

export async function POST(req) {
  try {
    await initDb();
    await ensureTokenHashColumns();
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const { program_id, program_name, emails, preview } = body;

    if (!program_id || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { success: false, error: "program_id and emails are required" },
        { status: 400 },
      );
    }

    const programId = String(program_id);
    const progRes = await db.execute({
      sql: "SELECT name, facilitator_default_permissions FROM v2_programs WHERE id::text = ?",
      args: [programId],
    });
    const program = progRes.rows[0];
    const progName = program_name || program?.name || programId;

    let defaultPerms = parsePermissions(program?.facilitator_default_permissions);
    if (Object.keys(defaultPerms).length === 0) {
      defaultPerms = buildFullFacilitatorPermissions();
    }

    const seen = new Set();
    const results = [];

    for (const raw of emails) {
      const analysis = await analyzeEmail(raw, programId);
      if (seen.has(analysis.email)) continue;
      seen.add(analysis.email);

      // Preview mode only reports what would happen.
      if (preview) {
        results.push(analysis);
        continue;
      }

      if (analysis.status !== "existing_contact" && analysis.status !== "new_contact") {
        results.push(analysis);
        continue;
      }

      let contactCid = analysis.contactCid;
      if (!contactCid) {
        contactCid = "USR_" + uuidv4().toUpperCase().replace(/-/g, "").substring(0, 12);
        await db.execute({
          sql: "INSERT INTO contacts (cid, name, email, role, status) VALUES (?, ?, ?, 'facilitator', 'pending')",
          args: [contactCid, "", analysis.email],
        });
      }

      // Facilitator relationship inherits the program default permissions.
      await db.execute({
        sql: `INSERT INTO v2_program_staff (program_id, staff_id, role, permissions)
              VALUES (?, ?, 'facilitator', ?::jsonb)
              ON CONFLICT (program_id, staff_id)
              DO UPDATE SET role = EXCLUDED.role, permissions = EXCLUDED.permissions, updated_at = NOW()`,
        args: [programId, contactCid, JSON.stringify(defaultPerms)],
      });

      // Link the contact to this program (fill-only) and record the contextual
      // facilitator role without overwriting the person's global role.
      await db.execute({
        sql: "UPDATE contacts SET program_id = ? WHERE cid = ? AND (program_id IS NULL OR TRIM(program_id) = '')",
        args: [programId, contactCid],
      });
      try {
        await db.execute({
          sql: `INSERT INTO contact_roles
                  (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
                SELECT ?, 'facilitator', 'program', ?, true, 'facilitator', '{"type":"program"}'::jsonb, 'active', ?::jsonb, ?
                WHERE NOT EXISTS (
                  SELECT 1 FROM contact_roles cr
                  WHERE cr.contact_cid = ?
                    AND cr.role = 'facilitator'
                    AND cr.context_type = 'program'
                    AND cr.context_id = ?
                    AND cr.is_current = true
                )`,
          args: [contactCid, programId, JSON.stringify(defaultPerms), session?.cid || "system", contactCid, programId],
        });
      } catch (_) {}

      // Reuse the existing activation token flow; never duplicate a contact.
      await db.execute({
        sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?",
        args: [contactCid],
      });
      const token = uuidv4();
      const tokenHash = hashToken(token);
      await db.execute({
        sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
        args: [token, tokenHash, contactCid],
      });

      if (analysis.accountActivated) {
        await sendLoginEmail({
          to: analysis.email,
          name: analysis.name || "",
          role: "facilitator",
          programName: progName,
        });
      } else {
        await sendInviteEmail({
          to: analysis.email,
          name: analysis.name || "",
          role: "facilitator",
          token,
          programName: progName,
        });
      }

      // CRM history: assignment + invitation.
      const actorId = session?.cid || "system";
      try {
        await db.execute({
          sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                VALUES (?, 'facilitator_assigned', ?, 'programs', ?, ?, '{}'::jsonb)`,
          args: [contactCid, `Assigned as facilitator to ${progName}`, programId, actorId],
        });
      } catch (_) {}
      try {
        await db.execute({
          sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
                VALUES (?, 'invitation_sent', ?, 'programs', ?, ?, '{}'::jsonb)`,
          args: [contactCid, `Invited to facilitate ${progName}`, programId, actorId],
        });
      } catch (_) {}

      results.push({
        email: analysis.email,
        status: analysis.accountActivated ? "invited" : "activation_sent",
        cid: contactCid,
        name: analysis.name || "",
      });
    }

    return NextResponse.json({ success: true, results, count: results.length });
  } catch (error) {
    console.error("[Bulk facilitator invite] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
