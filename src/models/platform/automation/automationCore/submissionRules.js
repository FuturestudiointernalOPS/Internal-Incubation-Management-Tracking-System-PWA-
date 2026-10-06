/**
 * SUBMISSION_RECEIVED rules: acknowledge the submitter, sync the CRM contact,
 * and mirror the submission to Notion.
 */

import { audit, notifyUser } from "@/models/platform/integrations";
import { resolveAutomationFlag } from "@/lib/platform/automationSettings";
import { syncCrmContact, writeCrmTimeline } from "../crmHelpers";
import { sendAcknowledgementForSubmission } from "../submissionConfirmation";
import { PLATFORM_EVENTS } from "./events";

export const submissionRules = [
  // ── Submission received ──
  {
    event: PLATFORM_EVENTS.SUBMISSION_RECEIVED,
    description: "Log audit + notify submitter",
    condition: (ctx) => ctx.submission?.status === "submitted",
    action: async (ctx) => {
      const { submission, run } = ctx;

      // A PAID Execution sends NO email on submission. The submission only
      // CAPTURES a registration: the money is not confirmed yet, so an
      // acknowledgement would announce a course the person has not paid for.
      // The receipt and the access link go out from the payment confirmation
      // (the checkout webhook) — and only then. An unpaid registration sends
      // nothing at all. A free Execution (no course) is untouched.
      const sellsCourse = Boolean(run?.lms_course_id);

      // The confirmation message is a decision, so the RUN owns it and the form
      // supplies the default (run -> form -> on). Absent means ON, so nothing
      // changes for a form or run that has never configured this.
      const shouldAcknowledge = resolveAutomationFlag(
        ctx.form?.settings,
        ctx.run?.settings,
        "on_submit.send_acknowledgement",
      );

      await audit({
        entity_type: "submission",
        entity_id: submission.id,
        user_id: submission.submitter_id,
        user_name: submission.submitter_name,
        action: "submitted",
        details: `Submission received for run "${run?.name || run?.id}"`,
        meta: { run_id: submission.run_id, form_id: run?.form_id },
      });

      // The confirmation goes through the same tracked path as every other
      // workflow email (run → form → default template, shared transport, logged
      // under "acknowledgement") so a designed template actually reaches the
      // applicant and a failed send is visible and retryable.
      if (shouldAcknowledge && !sellsCourse && submission?.id) {
        try {
          const ack = await sendAcknowledgementForSubmission({ submission_id: submission.id });
          if (ack.status === "failed") {
            console.error("[Automation] Confirmation email failed:", ack.error);
          }
        } catch (error) {
          console.error("[Automation] Confirmation email failed:", error.message);
        }
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

  // ── Submission received → sync to Notion ──
  {
    event: PLATFORM_EVENTS.SUBMISSION_RECEIVED,
    description: "Sync submission to Notion database (if configured)",
    condition: (ctx) => ctx.submission?.status === "submitted",
    action: async (ctx) => {
      const { submission } = ctx;
      try {
        const { syncSubmission } = await import("@/models/integrations/notion/sync");
        await syncSubmission(submission.id);
      } catch (error) {
        console.error("[Automation] Notion sync failed:", error.message);
      }
    },
  },
];