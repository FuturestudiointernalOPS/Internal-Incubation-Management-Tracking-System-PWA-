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
      const isApproved = ctx.review.decision === "approved";
      const runName = ctx.run?.name || "form";
      const auto = ctx.form?.settings?.automation;

      // Write CRM timeline (guarded — CRM identity is NOT a prerequisite for
      // onboarding; it is only used when it already exists)
      if (ctx.submission?.submitter_id) {
        await writeCrmTimeline(ctx.submission.submitter_id,
          isApproved ? "application_approved" : "application_rejected",
          isApproved ? `Application approved for "${runName}"` : `Application not successful for "${runName}"`,
          "forms", ctx.submission.id, ctx.review.reviewer_id || "system",
          { decision: ctx.review.decision, run_id: ctx.submission.run_id });
      }

      if (!isApproved) return;

      // ── Program enrollment (respects automation config) ──
      const shouldEnroll = !auto || auto.on_approve?.enroll_in_program !== false;
      if (shouldEnroll && ctx.run?.form_id && ctx.submission?.submitter_id) {
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
      if (shouldAssignGroup && ctx.run?.id && ctx.submission?.submitter_id) {
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
              // Idempotent: only assign + log timeline if the contact has no group yet
              const existingGroup = await db.execute({
                sql: "SELECT group_name FROM contacts WHERE cid = ?",
                args: [ctx.submission.submitter_id],
              });
              const currentGroup =
                existingGroup.rows.length > 0 ? existingGroup.rows[0].group_name : "";
              const needsAssignment =
                !currentGroup ||
                currentGroup.trim() === "" ||
                currentGroup.toLowerCase() === "unassigned";

              if (needsAssignment) {
                // Update the contact's group_name
                await db.execute({
                  sql: "UPDATE contacts SET group_name = ? WHERE cid = ?",
                  args: [group.rows[0].name, ctx.submission.submitter_id],
                });
                // Timeline event only on actual assignment (not on re-runs)
                await writeCrmTimeline(ctx.submission.submitter_id, "assigned_to_group",
                  `Assigned to group "${group.rows[0].name}"`, "groups", group.rows[0].id, "system", { group_id: a.target_id });
              }
            }
          }
        } catch (e) {}
      }

      // ── Create platform user + send activation email (respects workflow settings) ──
      // CRM existence is NOT a prerequisite: the submission itself can onboard
      // a brand-new person as long as a valid email can be resolved.
      const shouldCreateUser = !auto || auto.on_approve?.create_platform_user !== false;
      const shouldSendActivation = !auto || auto.on_approve?.send_activation_email !== false;

      const { recordEmailStatus } = await import("@/lib/email");

      if (!shouldCreateUser) {
        console.warn("[Automation] Activation skipped: create platform user disabled", ctx.submission?.id);
        await recordEmailStatus({
          submission_id: ctx.submission?.id || null,
          contact_cid: ctx.submission?.submitter_id || null,
          email_type: "activation",
          status: "skipped",
          error: "Skipped — Create platform user disabled in the form's Workflow settings",
        });
        return;
      }

      try {
        console.log("[Automation] Activation: starting for submission", ctx.submission?.id);
        const { default: db, initDb } = await import("@/lib/db");
        await initDb();

        const submissionData = ctx.submission?.data || {};
        let contactName = ctx.submission?.submitter_name || "Participant";

        const {
          resolveRecipientEmail,
          sendInviteEmail,
          sendLoginEmail,
          getTemplate,
          sendTrackedEmail,
          getEmailLogRow,
        } = await import("@/lib/email");

        // 1. Resolve the recipient email with strict priority:
        //    existing valid contact email → valid email in form answers → fail.
        //    Placeholder/import-fallback addresses are never accepted.
        let contactEmail = null;
        if (ctx.submission?.submitter_id) {
          if (ctx.submission.submitter_id.includes("@")) {
            contactEmail = ctx.submission.submitter_id;
          } else {
            try {
              const cRes = await db.execute({
                sql: "SELECT cid, name, email FROM contacts WHERE cid = ?",
                args: [ctx.submission.submitter_id],
              });
              if (cRes.rows.length > 0) {
                contactName = cRes.rows[0].name || contactName;
                contactEmail = cRes.rows[0].email || null;
              }
            } catch (_) {}
          }
        }
        contactEmail = resolveRecipientEmail({ contactEmail, submissionData });

        if (!contactEmail) {
          console.warn("[Automation] Activation failed: no usable email", ctx.submission?.id);
          await recordEmailStatus({
            submission_id: ctx.submission?.id || null,
            contact_cid: ctx.submission?.submitter_id || null,
            email_type: "activation",
            status: "failed",
            error: "Failed — No usable email address found (placeholder or missing email)",
          });
          return;
        }

        // Determine target role and group from the run's group assignment
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

        // 2. Find or create the identity BY EMAIL (reuse existing, never duplicate)
        let contact = null;
        let accountAlreadyActive = false;
        const existingContact = await db.execute({
          sql: "SELECT cid, name, email, password FROM contacts WHERE LOWER(email) = LOWER(?) AND deleted = 0 LIMIT 1",
          args: [contactEmail],
        });

        if (existingContact.rows.length > 0) {
          contact = existingContact.rows[0];
          contactName = contact.name || contactName;
          // A non-empty password means the person already completed setup.
          accountAlreadyActive = !!(contact.password && String(contact.password).trim() !== "");
          if (!accountAlreadyActive) {
            await db.execute({
              sql: "UPDATE contacts SET role = ?, status = 'approved', group_name = CASE WHEN group_name IS NULL OR TRIM(group_name) = '' OR LOWER(group_name) = 'unassigned' THEN ? ELSE group_name END WHERE cid = ?",
              args: [targetRole, groupName || null, contact.cid],
            });
          }
        } else {
          const cid = "USR_" + Math.random().toString(36).substring(2, 14).toUpperCase();
          await db.execute({
            sql: `INSERT INTO contacts (cid, name, email, role, status, group_name, password) VALUES (?, ?, ?, ?, 'approved', ?, '')`,
            args: [cid, contactName, contactEmail, targetRole, groupName || ''],
          });
          contact = { cid, name: contactName, email: contactEmail };
        }

        // 3. Workflow toggle for the email itself
        if (!shouldSendActivation) {
          await recordEmailStatus({
            submission_id: ctx.submission?.id || null,
            contact_cid: contact.cid,
            email_type: "activation",
            status: "skipped",
            error: "Skipped — Send activation email disabled in the form's Workflow settings",
          });
          return;
        }

        // 4. Idempotency: never re-send automatically after a successful send.
        const priorSend = ctx.submission?.id
          ? await getEmailLogRow(ctx.submission.id, "activation")
          : null;
        if (priorSend && priorSend.status === "sent") {
          console.log("[Automation] Activation/access email already sent — skipped", contactEmail);
          return;
        }

        // 5. Send the RIGHT email for the account state:
        //    - no account yet  → activation email with password-setup link
        //    - account exists  → access email with the login URL (no new token)
        const activationTemplate = getTemplate(ctx.form?.settings, "activation", ctx.run?.settings);
        const existingUserTemplate = getTemplate(ctx.form?.settings, "existing_user", ctx.run?.settings);
        const templateVars = {
          organization: "ImpactOS",
          form_name: ctx.run?.name || "",
          group_name: groupName || "",
          name: contactName,
        };

        const tracked = await sendTrackedEmail({
          submission_id: ctx.submission?.id || null,
          contact_cid: contact.cid,
          email_type: "activation",
          note: accountAlreadyActive
            ? "Existing account login email"
            : "New account activation email",
          sendFn: async () => {
            if (accountAlreadyActive) {
              return sendLoginEmail({
                to: contactEmail,
                name: contactName,
                role: targetRole,
                template: existingUserTemplate,
                templateVars,
              });
            }
            // New account: generate the token INSIDE the send function so a
            // skipped send never produces an orphaned token
            const token = "act_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().replace("T", " ").replace("Z", "");
            await db.execute({
              sql: `INSERT INTO password_setup_tokens (contact_cid, token, expires_at, used) VALUES (?, ?, ?, 0)`,
              args: [contact.cid, token, expiresAt],
            });
            console.log("[Automation] Token stored for", contactEmail);
            return sendInviteEmail({
              to: contactEmail,
              name: contactName,
              role: targetRole,
              token,
              template: activationTemplate,
              templateVars,
            });
          },
        });

        if (tracked.success) {
          console.log(
            "[Automation]",
            accountAlreadyActive ? "Access email sent to" : "Activation email sent to",
            contactEmail
          );
          await writeCrmTimeline(contact.cid, "activation_sent",
            accountAlreadyActive
              ? "Access email sent with platform login link"
              : "Activation email sent with password setup link",
            "forms", ctx.submission?.id || null, "system", {});
        } else if (tracked.skipped) {
          console.log("[Automation] Activation email already sent — skipped", contactEmail);
        } else {
          console.error("[Automation] Activation email FAILED for", contactEmail);
          await writeCrmTimeline(contact.cid, "activation_email_failed",
            "Activation email failed to send", "forms", ctx.submission?.id || null, "system", {});
        }
      } catch (e) {
        console.error("[Automation] Activation email failed:", e.message);
        try {
          const { recordEmailFailure, getEmailLogRow } = await import("@/lib/email");
          const existing = ctx.submission?.id ? await getEmailLogRow(ctx.submission.id, "activation") : null;
          if (!existing) {
            await recordEmailFailure({
              submission_id: ctx.submission?.id || null,
              contact_cid: ctx.submission?.submitter_id || null,
              email_type: "activation",
              error: `Failed — Activation flow error: ${String(e?.message || "unknown").substring(0, 300)}`,
            });
          }
        } catch (_) {}
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
