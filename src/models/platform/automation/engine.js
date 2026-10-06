import { AUTOMATION_RULES as RULES, PLATFORM_EVENTS } from "./automationCore";
import { sendTrackedEmail } from "@/lib/email";

// ─── ENGINE ────────────────────────────────────────────────────────

export function fireEvent(event, ctx = {}) {
  if (!event) return Promise.resolve();
  console.log(`[Automation] Firing event: ${event}`, Object.keys(ctx));

  const matching = RULES.filter((rule) => rule.event === event);

  // Run all matching rules in parallel and return a promise
  return Promise.all(matching.map((rule) =>
    Promise.resolve().then(async () => {
      if (rule.condition) {
        const ok = await rule.condition(ctx);
        if (!ok) return;
      }
      await rule.action(ctx);
    }).catch((error) => {
      console.error(`[Automation] Rule "${rule.description}" failed for event "${event}":`, error.message);
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

