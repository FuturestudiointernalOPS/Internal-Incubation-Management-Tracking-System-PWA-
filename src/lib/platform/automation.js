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

  // ── CRM: Sync submission to contacts + timeline ──
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

  // ── CRM: Write review decision to timeline ──
  {
    event: PLATFORM_EVENTS.REVIEW_COMPLETED,
    description: "Write review decision to CRM contact timeline",
    condition: (ctx) => ctx.review?.decision && (ctx.review.decision === "approved" || ctx.review.decision === "rejected"),
    action: async (ctx) => {
      if (!ctx.submission?.submitter_id) return;
      const isApproved = ctx.review.decision === "approved";
      const runName = ctx.run?.name || "form";
      await writeCrmTimeline(ctx.submission.submitter_id,
        isApproved ? "application_approved" : "application_rejected",
        isApproved ? `Application approved for "${runName}"` : `Application not successful for "${runName}"`,
        "forms", ctx.submission.id, ctx.review.reviewer_id || "system",
        { decision: ctx.review.decision, run_id: ctx.submission.run_id });
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
  if (!event) return;
  console.log(`[Automation] Firing event: ${event}`, Object.keys(ctx));

  const matching = RULES.filter((r) => r.event === event);

  for (const rule of matching) {
    Promise.resolve()
      .then(async () => {
        if (rule.condition) {
          const ok = await rule.condition(ctx);
          if (!ok) return;
        }
        await rule.action(ctx);
      })
      .catch((err) => {
        console.error(`[Automation] Rule "${rule.description}" failed for event "${event}":`, err.message);
      });
  }
}

export function onSubmission(submission, run, form, session) {
  const event = submission.status === "draft"
    ? PLATFORM_EVENTS.SUBMISSION_DRAFT_SAVED
    : PLATFORM_EVENTS.SUBMISSION_RECEIVED;
  fireEvent(event, { submission, run, form, session });
}

export function onReview(review, submission, run, session) {
  fireEvent(PLATFORM_EVENTS.REVIEW_COMPLETED, { review, submission, run, session });
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
