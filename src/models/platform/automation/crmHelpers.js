import { resolveSubmissionEmail } from "@/lib/email";

// ─── CRM INTEGRATION HELPERS ───────────────────────────────────────

async function syncCrmContact(submission) {
  try {
    const { default: db, initDb } = await import("@/lib/db");
    await initDb();
    const submissionData = submission.data || {};

    // Resolve the real applicant email with the same label-aware, placeholder-safe
    // logic used everywhere else (Run view, evaluations, decision emails) instead
    // of grabbing the first value that happens to contain "@".
    let fieldLabels = {};
    try {
      const runRes = await db.execute({
        sql: "SELECT form_id FROM platform_form_runs WHERE id = ?",
        args: [submission.run_id],
      });
      if (runRes.rows.length > 0) {
        const fieldRes = await db.execute({
          sql: "SELECT id, label FROM platform_form_fields WHERE form_id = ?",
          args: [runRes.rows[0].form_id],
        });
        for (const field of fieldRes.rows) fieldLabels[String(field.id)] = field.label;
      }
    } catch (_) {}

    const email = resolveSubmissionEmail({ submissionData, fieldLabels, contactEmail: "" });
    if (!email) return null;
    const values = Object.values(submissionData);
    const name = values.find(value => typeof value === "string" && value.length > 1 && !value.includes("@") && !value.startsWith("{"));
    const phone = values.find(value => typeof value === "string" && /^[\d\s+\-()]{7,}$/.test(value));
    const cid = submission.submitter_id || "USR_" + Math.random().toString(36).substring(2, 10).toUpperCase();
    await db.execute({
      sql: `INSERT INTO contacts (cid, name, email, phone, role, status)
            VALUES (?, ?, ?, ?, 'applicant', 'active')
            ON CONFLICT(email) DO UPDATE SET
              name = COALESCE(NULLIF(EXCLUDED.name, ''), contacts.name),
              phone = COALESCE(EXCLUDED.phone, contacts.phone)`,
      args: [cid, name || "Applicant", email.toLowerCase().trim(), phone || null],
    });
    return cid;
  } catch { return null; }
}

async function writeCrmTimeline(cid, type, description, module, ctxId, actor, meta) {
  try {
    const { default: db, initDb } = await import("@/lib/db");
    await initDb();
    await db.execute({
      sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?::jsonb)`,
      args: [cid, type, description, module, String(ctxId), actor || "system", JSON.stringify(meta || {})],
    });
  } catch {}
}


export { syncCrmContact, writeCrmTimeline };
