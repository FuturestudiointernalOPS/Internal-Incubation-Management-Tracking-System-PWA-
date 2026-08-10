/**
 * PLATFORM AUTOMATION ENGINE
 *
 * Event-driven automation layer. When Platform events occur
 * (submission received, review completed, deadline approaching),
 * the engine runs configured automation rules.
 *
 * Rules can be defined declaratively and are executed asynchronously
 * to avoid blocking the main request flow.
 */

import {
  audit,
  sendSubmissionConfirmation,
  sendReviewDecision,
  summarizeSubmission,
  notifyUser,
} from "@/lib/platform/integrations";

// ─── EVENT DEFINITIONS ─────────────────────────────────────────────

export const PLATFORM_EVENTS = {
  RUN_CREATED: "run.created",
  RUN_LAUNCHED: "run.launched",
  RUN_CLOSED: "run.closed",
  SUBMISSION_RECEIVED: "submission.received",
  SUBMISSION_DRAFT_SAVED: "submission.draft_saved",
  REVIEW_COMPLETED: "review.completed",
  ASSIGNMENT_ADDED: "assignment.added",
  DEADLINE_APPROACHING: "deadline.approaching",
};

// ─── CRM INTEGRATION HELPERS ───────────────────────────────────────

async function syncCrmContact(submission) {
  try {
    const { default: db, initDb } = await import("@/lib/db");
    await initDb();
    const subData = submission.data || {};
    const vals = Object.values(subData);
    const email = vals.find(v => typeof v === "string" && v.includes("@"));
    if (!email) return null;
    const name = vals.find(v => typeof v === "string" && v.length > 1 && !v.includes("@") && !v.startsWith("{"));
    const phone = vals.find(v => typeof v === "string" && /^[\d\s\+\-\(\)]{7,}$/.test(v));
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
  } catch (e) { return null; }
}

async function writeCrmTimeline(cid, type, desc, module, ctxId, actor, meta) {
  try {
    const { default: db, initDb } = await import("@/lib/db");
    await initDb();
    await db.execute({
      sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?::jsonb)`,
      args: [cid, type, desc, module, String(ctxId), actor || "system", JSON.stringify(meta || {})],
    });
  } catch (e) {}
}

// ─── AUTOMATION RULES ──────────────────────────────────────────────

const RULES = [
  // ── Submission received ──
  {
    event: PLATFORM_EVENTS.SUBMISSION_RECEIVED,
    description: "Log audit + notify submitter",
    condition: (ctx) => ctx.submission?.status === "submitted",
    action: async (ctx) => {
      const { submission, run, form, session } = ctx;

      await audit({
        entity_type: "submission",
        entity_id: submission.id,
        user_id: submission.submitter_id,
        user_name: submission.submitter_name,
        action: "submitted",
        details: `Submission received for run "${run?.name || run?.id}"`,
        meta: { run_id: submission.run_id, form_id: run?.form_id },
      });

      try {
        const { default: db, initDb } = await import("@/lib/db");
        await initDb();
        const contact = await db.execute({
          sql: "SELECT name, email FROM contacts WHERE cid = ?",
          args: [submission.submitter_id],
        });
        if (contact.rows.length > 0 && contact.rows[0].email) {
          await sendSubmissionConfirmation({
            to: contact.rows[0].email,
            participantName: contact.rows[0].name || submission.submitter_id,
            runName: run?.name || "Form Run",
            submittedAt: new Date(submission.submitted_at).toLocaleString(),
          });
        }
      } catch (e) {
        console.error("[Automation] Confirmation email failed:", e.message);
      }

      if (run?.owner_id) {
        await notifyUser({
          userId: run.owner_id,
          title: "New Submission Received",
          body: `${submission.submitter_name || submission.submitter_id} submitted to "${run.name}"`,
          actionUrl: `/platform/runs?id=${run.id}`,
          type: "submission",
        });
      }
    },
  },

  // ── CRM: Sync submission to contacts + timeline (always — system responsibility) ──
  {
    event: PLATFORM_EVENTS.SUBMISSION_RECEIVED,
    description: "Create/update CRM contact and write timeline event",
    condition: (ctx) => ctx.submission?.status === "submitted",
    action: async (ctx) => {
      const cid = await syncCrmContact(ctx.submission);
      if (cid) {
        const runName = ctx.run?.name || "form";
        await writeCrmTimeline(cid, "form_submitted",
          `Submitted "${runName}"`, "forms",
          ctx.submission.id, ctx.submission.submitter_id,
          { run_id: ctx.submission.run_id });
      }
    },
  },

  // ── Review completed ──
  {
    event: PLATFORM_EVENTS.REVIEW_COMPLETED,
    description: "Log audit + notify submitter of decision",
    condition: (ctx) => !!ctx.review?.decision,
    action: async (ctx) => {
      const { review, submission, run, session } = ctx;

      await audit({
        entity_type: "review",
        entity_id: review.id || submission.id,
        user_id: session?.cid,
        user_name: review.reviewer_name,
        action: review.decision,
        details: `Review ${review.decision} for submission #${submission.id} in "${run?.name || run?.id}"`,
        meta: { run_id: submission.run_id, comment: review.comment?.substring(0, 100) },
      });

      try {
        const { default: db, initDb } = await import("@/lib/db");
        await initDb();
        const contact = await db.execute({
          sql: "SELECT name, email FROM contacts WHERE cid = ?",
          args: [submission.submitter_id],
        });
        if (contact.rows.length > 0 && contact.rows[0].email) {
          await sendReviewDecision({
            to: contact.rows[0].email,
            participantName: contact.rows[0].name || submission.submitter_id,
            runName: run?.name || "Form Run",
            decision: review.decision,
            comment: review.comment,
            reviewerName: review.reviewer_name || "Reviewer",
          });
        }
      } catch (e) {
        console.error("[Automation] Decision email failed:", e.message);
      }

      const decisionLabel =
        review.decision === "approved" ? "approved" :
        review.decision === "rejected" ? "not accepted" :
        review.decision === "revision_requested" ? "returned for revision" :
        review.decision;
      await notifyUser({
        userId: submission.submitter_id,
        title: `Submission ${decisionLabel}`,
        body: `Your submission for "${run?.name || run?.id}" was ${decisionLabel} by ${review.reviewer_name || "a reviewer"}.`,
        actionUrl: `/platform/runs/submit/${run?.id}`,
        type: "review",
      });
    },
  },

  // ── CRM: Write review decision to timeline + auto-enroll ──
  {
    event: PLATFORM_EVENTS.REVIEW_COMPLETED,
    description: "Write review decision to CRM, auto-enroll into program/group, send activation email",
    condition: (ctx) => ctx.review?.decision && (ctx.review.decision === "approved" || ctx.review.decision === "rejected"),
    action: async (ctx) => {
      if (!ctx.submission?.submitter_id) return;
      const isApproved = ctx.review.decision === "approved";
      const runName = ctx.run?.name || "form";
      const auto = ctx.form?.settings?.automation;

      // Write CRM timeline
      await writeCrmTimeline(ctx.submission.submitter_id,
        isApproved ? "application_approved" : "application_rejected",
        isApproved ? `Application approved for "${runName}"` : `Application not successful for "${runName}"`,
        "forms", ctx.submission.id, ctx.review.reviewer_id || "system",
        { decision: ctx.review.decision, run_id: ctx.submission.run_id });

      if (!isApproved) return;

      // ── Program enrollment (respects automation config) ──
      const shouldEnroll = !auto || auto.on_approve?.enroll_in_program !== false;
      if (shouldEnroll && ctx.run?.form_id) {
        try {
          const { default: db, initDb } = await import("@/lib/db");
          await initDb();
          const prog = await db.execute({
            sql: "SELECT program_id FROM platform_forms WHERE id = ? AND program_id IS NOT NULL",
            args: [ctx.run.form_id],
          });
          if (prog.rows.length > 0) {
            const pid = prog.rows[0].program_id;
            await db.execute({
              sql: "INSERT INTO participant_programs (participant_id, program_id, status, accepted_at) VALUES (?, ?, 'active', NOW()) ON CONFLICT DO NOTHING",
              args: [ctx.submission.submitter_id, pid],
            });
            await writeCrmTimeline(ctx.submission.submitter_id, "participant_enrolled",
              "Enrolled in program", "programs", pid, "system", { program_id: pid });
          }
        } catch (e) {}
      }

      // ── Group assignment from form run (respects automation config) ──
      const shouldAssignGroup = !auto || auto.on_approve?.assign_to_group !== false;
      if (shouldAssignGroup && ctx.run?.id) {
        try {
          const { default: db, initDb } = await import("@/lib/db");
          await initDb();
          // Find group assignments for this form run
          const assignments = await db.execute({
            sql: "SELECT target_id FROM platform_form_run_assignments WHERE run_id = ? AND target_type = 'group'",
            args: [ctx.run.id],
          });
          for (const a of assignments.rows) {
            // Add participant to group via the families table
            const group = await db.execute({
              sql: "SELECT id, name FROM families WHERE registration_id = ? OR id = ?",
              args: [a.target_id, a.target_id],
            });
            if (group.rows.length > 0) {
              // Update the contact's group_name
              await db.execute({
                sql: "UPDATE contacts SET group_name = COALESCE(NULLIF(group_name, ''), ?) WHERE cid = ? AND (group_name IS NULL OR group_name = '' OR group_name = 'unassigned')",
                args: [group.rows[0].name, ctx.submission.submitter_id],
              });
              await writeCrmTimeline(ctx.submission.submitter_id, "assigned_to_group",
                `Assigned to group "${group.rows[0].name}"`, "groups", group.rows[0].id, "system", { group_id: a.target_id });
            }
          }
        } catch (e) {}
      }

      // ── Create platform user + send activation email (respects automation config) ──
      const shouldCreateUser = !auto || auto.on_approve?.create_platform_user !== false;
      const shouldSendActivation = !auto || auto.on_approve?.send_activation_email !== false;
      if (shouldCreateUser && shouldSendActivation) {
        try {
          console.log("[Automation] Activation: starting for submission", ctx.submission?.id);
          const { default: db, initDb } = await import("@/lib/db");
          await initDb();
          
          // Extract contact email and name from submission data
          const submissionData = ctx.submission?.data || {};
          let contactEmail = null;
          let contactName = ctx.submission?.submitter_name || "Participant";
          
          // Try to get email from submitter_id (may be email or CID)
          if (ctx.submission?.submitter_id) {
            if (ctx.submission.submitter_id.includes("@")) {
              contactEmail = ctx.submission.submitter_id;
            } else {
              // It's a CID, look up the contact
              try {
                const cRes = await db.execute({
                  sql: "SELECT cid, name, email FROM contacts WHERE cid = ?",
                  args: [ctx.submission.submitter_id],
                });
                if (cRes.rows.length > 0 && cRes.rows[0].email) {
                  contactEmail = cRes.rows[0].email;
                  contactName = cRes.rows[0].name || contactName;
                }
              } catch (_) {}
            }
          }
          
          // If still no email, search submission data values
          if (!contactEmail || !contactEmail.includes("@")) {
            const sData = typeof submissionData === "object" ? submissionData : {};
            for (const val of Object.values(sData)) {
              if (typeof val === "string" && val.includes("@")) {
                contactEmail = val;
                break;
              }
            }
          }
          
          if (!contactEmail || !contactEmail.includes("@")) return;
          
          // Determine target role and group from form run assignment
          let targetRole = null;
          let groupName = null;
          if (ctx.run?.id) {
            try {
              const grp = await db.execute({
                sql: `SELECT f.name, f.default_role FROM platform_form_run_assignments a JOIN families f ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT)) WHERE a.run_id = ? AND a.target_type = 'group' LIMIT 1`,
                args: [ctx.run.id],
              });
              if (grp.rows.length > 0) {
                targetRole = grp.rows[0].default_role || "staff";
                groupName = grp.rows[0].name;
              }
            } catch (_) {}
          }
          if (!targetRole) targetRole = "staff";
          
          // Find or create contact by email
          let contact = null;
          const existingContact = await db.execute({
            sql: "SELECT cid, name, email FROM contacts WHERE LOWER(email) = LOWER(?) AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
            args: [contactEmail],
          });
          
          if (existingContact.rows.length > 0) {
            contact = existingContact.rows[0];
            contactName = contact.name || contactName;
            // Update existing contact: set status to approved (NOT active — requires password setup)
            await db.execute({
              sql: "UPDATE contacts SET role = ?, status = 'approved', group_name = CASE WHEN group_name IS NULL OR TRIM(group_name) = '' OR LOWER(group_name) = 'unassigned' THEN ? ELSE group_name END WHERE cid = ?",
              args: [targetRole, groupName || null, contact.cid],
            });
          } else {
            // Create new contact
            const cid = "USR_" + Math.random().toString(36).substring(2, 14).toUpperCase();
            await db.execute({
              sql: `INSERT INTO contacts (cid, name, email, role, status, group_name) VALUES (?, ?, ?, ?, 'approved', ?)`,
              args: [cid, contactName, contactEmail, targetRole, groupName],
            });
            contact = { cid, name: contactName, email: contactEmail };
          }
          
          // Generate password setup token using the existing password_setup_tokens table
          const token = "act_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
          const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().replace("T", " ").replace("Z", "");
          await db.execute({
            sql: `INSERT INTO password_setup_tokens (contact_cid, token, expires_at, used) VALUES (?, ?, ?, 0)`,
            args: [contact.cid, token, expiresAt],
          });
          console.log("[Automation] Token stored for", contactEmail, "token:", token.substring(0, 16) + "...");
          
          // Send activation email using existing email infrastructure
          const { sendInviteEmail, getTemplate } = await import("@/lib/email");
          const activationTemplate = getTemplate(ctx.form?.settings, "activation");
          await sendInviteEmail({
            to: contactEmail,
            name: contactName,
            role: targetRole,
            token,
            template: activationTemplate,
            templateVars: {
              organization: "ImpactOS",
              form_name: ctx.run?.name || "",
              group_name: groupName || "",
              name: contactName,
            },
          });
          console.log("[Automation] Activation email sent to", contactEmail);
          
          await writeCrmTimeline(contact.cid, "activation_sent",
            "Activation email sent with password setup link", "forms", ctx.submission.id, "system", {});
        } catch (e) {
          console.error("[Automation] Activation email failed:", e.message);
        }
      }
    },
  },

  // ── Run launched ──
  {
    event: PLATFORM_EVENTS.RUN_LAUNCHED,
    description: "Log audit when a run is launched",
    action: async (ctx) => {
      const { run, session } = ctx;
      await audit({
        entity_type: "form_run",
        entity_id: run.id,
        user_id: session?.cid,
        user_name: null,
        action: "launched",
        details: `Form Run "${run.name}" launched`,
        meta: { form_id: run.form_id },
      });
    },
  },

  // ── Run created ──
  {
    event: PLATFORM_EVENTS.RUN_CREATED,
    description: "Log audit when a run is created",
    action: async (ctx) => {
      const { run, session } = ctx;
      await audit({
        entity_type: "form_run",
        entity_id: run.id,
        user_id: session?.cid,
        user_name: null,
        action: "created",
        details: `Form Run "${run.name}" created`,
        meta: { form_id: run.form_id },
      });
    },
  },

  // ── Assignment added ──
  {
    event: PLATFORM_EVENTS.ASSIGNMENT_ADDED,
    description: "Notify user when they are assigned to a run",
    action: async (ctx) => {
      const { assignment, run } = ctx;
      if (assignment?.target_type === "user" && assignment?.target_id) {
        await notifyUser({
          userId: assignment.target_id,
          title: "New Form Assigned",
          body: `You have been assigned to "${run?.name || "a form run"}". Please complete your submission.`,
          actionUrl: `/platform/runs/submit/${run?.id}`,
          type: "assignment",
        });
      }
    },
  },

  // ── Run launched → sync deadlines to calendar ──
  {
    event: PLATFORM_EVENTS.RUN_LAUNCHED,
    description: "Sync run deadlines to external calendar (if configured)",
    action: async (ctx) => {
      const { run } = ctx;
      try {
        const { syncRunDeadlines } = await import("@/lib/integrations/calendar/sync");
        await syncRunDeadlines(run.id);
      } catch (e) {
        console.error("[Automation] Calendar sync failed:", e.message);
      }
    },
  },

  // ── Submission received → sync to Notion ──
  {
    event: PLATFORM_EVENTS.SUBMISSION_RECEIVED,
    description: "Sync submission to Notion database (if configured)",
    condition: (ctx) => ctx.submission?.status === "submitted",
    action: async (ctx) => {
      const { submission } = ctx;
      try {
        const { syncSubmission } = await import("@/lib/integrations/notion/sync");
        await syncSubmission(submission.id);
      } catch (e) {
        console.error("[Automation] Notion sync failed:", e.message);
      }
    },
  },
];

// ─── ENGINE ────────────────────────────────────────────────────────

export function fireEvent(event, ctx = {}) {
  if (!event) return Promise.resolve();
  console.log(`[Automation] Firing event: ${event}`, Object.keys(ctx));

  const matching = RULES.filter((r) => r.event === event);

  // Run all matching rules in parallel and return a promise
  return Promise.all(matching.map((rule) =>
    Promise.resolve().then(async () => {
      if (rule.condition) {
        const ok = await rule.condition(ctx);
        if (!ok) return;
      }
      await rule.action(ctx);
    }).catch((err) => {
      console.error(`[Automation] Rule "${rule.description}" failed for event "${event}":`, err.message);
    })
  ));
}

export function onSubmission(submission, run, form, session) {
  const event = submission.status === "draft"
    ? PLATFORM_EVENTS.SUBMISSION_DRAFT_SAVED
    : PLATFORM_EVENTS.SUBMISSION_RECEIVED;
  fireEvent(event, { submission, run, form, session });
}

export function onReview(review, submission, run, session, form = null) {
  // Return promise so caller can await critical rules (activation email)
  return fireEvent(PLATFORM_EVENTS.REVIEW_COMPLETED, { review, submission, run, form, session });
}

export function onRunCreated(run, session) {
  fireEvent(PLATFORM_EVENTS.RUN_CREATED, { run, session });
}

export function onRunLaunched(run, session) {
  fireEvent(PLATFORM_EVENTS.RUN_LAUNCHED, { run, session });
}

export function onAssignmentAdded(assignment, run) {
  fireEvent(PLATFORM_EVENTS.ASSIGNMENT_ADDED, { assignment, run });
}

export default {
  PLATFORM_EVENTS,
  fireEvent,
  onSubmission,
  onReview,
  onRunCreated,
  onRunLaunched,
  onAssignmentAdded,
};
