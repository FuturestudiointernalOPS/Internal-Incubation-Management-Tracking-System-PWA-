/**
 * VENTURE PIPELINE — the single official Venture creation path.
 *
 * Called by the platform automation rule "venture.create_on_approve" when a
 * Venture Application submission is approved. This is the ONLY code that may
 * create a `ventures` row for the pipeline (Phase 2 gateway).
 *
 * Everything is idempotent and additive:
 *  - one Venture per submission (guarded by venture_origins.submission_id)
 *  - duplicate company names are rejected
 *  - the submitter becomes the primary founder (lead_founder + is_owner)
 *  - co-founders / team members named in the form are resolved to portal
 *    contacts (created as pending identities when they have no account yet —
 *    invitations/activation land in the invitations phase)
 */

import db, { initDb } from "@/lib/db";
import {
  ensureVentureSchema,
  generateVentureId,
  createVentureNotification,
} from "@/lib/ventures";

function pickValues(submissionData, keyMap) {
  const out = {};
  for (const [fieldId, value] of Object.entries(submissionData || {})) {
    const key = keyMap[String(fieldId)];
    if (key) out[key] = value;
  }
  return out;
}

function parseEmailList(value) {
  if (!value) return [];
  return String(value)
    .split(/[\n,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}

async function resolveOrCreateContact(email, name, role) {
  const emailNorm = String(email || "").trim().toLowerCase();
  if (!emailNorm || !emailNorm.includes("@")) return null;
  const existing = await db.execute({
    sql: "SELECT cid FROM contacts WHERE LOWER(email) = ?",
    args: [emailNorm],
  });
  if (existing.rows.length > 0) return existing.rows[0].cid;
  const cid = "USR_" + Math.random().toString(36).substring(2, 10).toUpperCase();
  await db.execute({
    sql: `INSERT INTO contacts (cid, name, email, role, status)
          VALUES (?, ?, ?, ?, 'active')
          ON CONFLICT (email) DO UPDATE SET
            name = COALESCE(NULLIF(EXCLUDED.name, ''), contacts.name)`,
    args: [cid, name || "Venture Member", emailNorm, role || "member"],
  });
  return cid;
}

export async function createVentureFromSubmission({ submission, run, form, review }) {
  await initDb();
  if (!submission?.id || !run?.id || !form?.id) {
    return { skipped: true, reason: "missing context" };
  }

  await ensureVentureSchema();

  // ── 1. Idempotency: one Venture per submission ──
  const existing = await db.execute({
    sql: "SELECT venture_id FROM venture_origins WHERE submission_id = ?",
    args: [submission.id],
  });
  if (existing.rows.length > 0) {
    return { skipped: true, reason: "already created", venture_id: existing.rows[0].venture_id };
  }

  // ── 2. Map submission answers (fields carry settings.key set by the seed) ──
  const fieldRes = await db.execute({
    sql: "SELECT id, settings FROM platform_form_fields WHERE form_id = ?",
    args: [form.id],
  });
  const keyMap = {};
  for (const f of fieldRes.rows || []) {
    if (f.settings?.key) keyMap[String(f.id)] = f.settings.key;
  }
  const data = pickValues(submission.data || {}, keyMap);

  const companyName = String(data.company_name || run.name || "New Venture").trim();

  // ── 3. Duplicate company name ──
  const dup = await db.execute({
    sql: "SELECT venture_id FROM ventures WHERE LOWER(company_name) = LOWER(?)",
    args: [companyName],
  });
  if (dup.rows.length > 0) {
    return { skipped: true, reason: "duplicate company name", venture_id: dup.rows[0].venture_id };
  }

  // ── 4. Submitter = primary founder ──
  let submitterCid = String(submission.submitter_id || "");
  if (submitterCid.includes("@")) {
    submitterCid = (await resolveOrCreateContact(submitterCid, data.founder_name, "founder")) || "";
  }
  if (!submitterCid) return { skipped: true, reason: "no submitter identity" };

  // ── 5. Origin / source: run assignments + invitation (invitation wins) ──
  const assignRes = await db.execute({
    sql: "SELECT target_type, target_id FROM platform_form_run_assignments WHERE run_id = ?",
    args: [run.id],
  });
  const assignments = assignRes.rows || [];
  const progAssign = assignments.find((a) => a.target_type === "program");
  const groupAssign = assignments.find((a) => ["group", "cohort"].includes(a.target_type));
  const teamAssign = assignments.find((a) => a.target_type === "team");

  let invitationRow = null;
  if (submission.invitation_id) {
    try {
      const invRes = await db.execute({
        sql: "SELECT * FROM platform_form_run_invitations WHERE id = ?",
        args: [submission.invitation_id],
      });
      invitationRow = invRes.rows[0] || null;
    } catch (_) {}
  }

  const sourceType =
    invitationRow?.source_type || (teamAssign ? "team" : groupAssign ? "group" : progAssign ? "participant" : "external");
  const originProgram = invitationRow?.program_id || progAssign?.target_id || null;
  const originCohort = invitationRow?.cohort_id || groupAssign?.target_id || null;
  const originTeam = invitationRow?.team_id || teamAssign?.target_id || null;

  // ── 6. Create the Venture ──
  const ventureId = generateVentureId();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO ventures (venture_id, name, company_name, industry, business_stage, description, mission, vision, website, country, registration_status, status, program_id, origin_team_id, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
          ON CONFLICT (venture_id) DO NOTHING`,
    args: [
      ventureId, companyName, companyName,
      data.industry || null,
      data.business_stage || "idea",
      data.description || null,
      data.mission || null,
      data.vision || null,
      data.website || null,
      data.country || null,
      data.registration_status || null,
      originProgram,
      originTeam,
      submitterCid, now, now,
    ],
  });

  // ── 7. Provenance ──
  await db.execute({
    sql: `INSERT INTO venture_origins (venture_id, source_type, program_id, cohort_id, team_id, participant_cid, form_id, run_id, submission_id, invitation_id, approved_by_cid, approved_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (venture_id) DO NOTHING`,
    args: [
      ventureId, sourceType,
      originProgram,
      originCohort,
      originTeam,
      sourceType === "participant" ? submitterCid : null,
      form.id, run.id, submission.id,
      submission.invitation_id || null,
      review?.reviewer_name || "system", now, now,
    ],
  });

  // ── 8. Members: submitter = founder/lead ──
  await db.execute({
    sql: `INSERT INTO venture_members (venture_id, contact_id, user_cid, member_type, role, permissions, joined_at, lead_founder, is_owner)
          VALUES (?, ?, ?, 'founder', 'founder', 'edit', ?, TRUE, TRUE)
          ON CONFLICT DO NOTHING`,
    args: [ventureId, submitterCid, submitterCid, now],
  });
  try {
    await db.execute({
      sql: "UPDATE contacts SET role = 'founder' WHERE cid = ? AND role NOT IN ('super_admin', 'staff', 'admin', 'program_manager')",
      args: [submitterCid],
    });
  } catch (_) {}

  // ── 9. Co-founders / team members named in the form ──
  const coFounderEmails = parseEmailList(data.co_founder_emails);
  const teamEmails = parseEmailList(data.team_member_emails);
  const submitterEmail = String(data.founder_email || "").trim().toLowerCase();
  for (const email of new Set([...coFounderEmails, ...teamEmails])) {
    if (email === submitterEmail) continue;
    const isCoFounder = coFounderEmails.includes(email);
    const cid = await resolveOrCreateContact(email, null, isCoFounder ? "founder" : "member");
    if (!cid) continue;
    await db.execute({
      sql: `INSERT INTO venture_members (venture_id, contact_id, user_cid, member_type, role, permissions, joined_at, lead_founder, is_owner)
            VALUES (?, ?, ?, ?, ?, 'edit', ?, FALSE, FALSE)
            ON CONFLICT DO NOTHING`,
      args: [ventureId, cid, cid, isCoFounder ? "founder" : "team_member", isCoFounder ? "co-founder" : "member", now],
    });
  }

  // ── 9b. Team carry-over: promoted Program Teams keep their members ──
  if (sourceType === "team" && originTeam) {
    try {
      const { resolveTeamMembersForPromotion } = await import("@/lib/ventures");
      const teamMembers = await resolveTeamMembersForPromotion(originTeam);
      for (const m of teamMembers) {
        if (!m?.contact_id || String(m.contact_id) === submitterCid) continue;
        await db.execute({
          sql: `INSERT INTO venture_members (venture_id, contact_id, user_cid, member_type, role, permissions, joined_at, lead_founder, is_owner)
                VALUES (?, ?, ?, 'team_member', 'member', 'edit', ?, FALSE, FALSE)
                ON CONFLICT DO NOTHING`,
          args: [ventureId, String(m.contact_id), String(m.contact_id), now],
        });
      }
    } catch (_) {}
  }

  // ── 10. History + activity (audit) ──
  try {
    await db.execute({
      sql: `INSERT INTO venture_history (venture_id, event_type, description, metadata, created_at)
            VALUES (?, 'VENTURE_CREATED', ?, ?::jsonb, ?)`,
      args: [
        ventureId,
        `Venture created from approved submission #${submission.id}`,
        JSON.stringify({ form_id: form.id, run_id: run.id, submission_id: submission.id, source_type: sourceType }),
        now,
      ],
    });
  } catch (_) {}
  try {
    await db.execute({
      sql: `INSERT INTO venture_activity_log (venture_id, action, actor_cid, actor_name, details, created_at)
            VALUES (?, 'VENTURE_APPROVED', ?, ?, ?::jsonb, ?)`,
      args: [
        ventureId,
        review?.reviewer_name || "system",
        review?.reviewer_name || "System",
        JSON.stringify({ submission_id: submission.id }),
        now,
      ],
    });
  } catch (_) {}

  // ── 11. Notifications ──
  try {
    await createVentureNotification({
      recipient_id: submitterCid,
      title: "Venture Approved",
      message: `Your Venture "${companyName}" has been approved and created.`,
    });
    await createVentureNotification({
      recipient_id: "sa",
      title: `[${ventureId}] Venture Approved`,
      message: `Venture "${companyName}" created from submission #${submission.id}.`,
    });
  } catch (_) {}

  return { success: true, venture_id: ventureId, source_type: sourceType };
}

export default { createVentureFromSubmission };
