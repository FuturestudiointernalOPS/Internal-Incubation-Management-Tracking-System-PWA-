/**
 * ANIMATION RIGHTS — the single definition of the facilitator capability set.
 *
 * This file is the source. The general capability registry imports it as the
 * `programs.facilitator` module, so the permission centre, the profile editor,
 * eligibility, the resolver and the super-admin matrix keep seeing the same
 * labels, risks and descriptions.
 *
 * It lives here because the same vocabulary is ALSO the one written into a
 * program assignment (`v2_program_staff.permissions`) and read by the
 * facilitator guard. Declaring it once is what keeps "what the UI can tick",
 * "what the invite grants" and "what a route consults" from drifting apart.
 *
 * `FACILITATOR_CAPABILITY_KEYS` is DERIVED, never hand-written: a copy can
 * drift, a derivation cannot.
 *
 * Product decision D7 (Phase 7): the six rights whose level was never consulted
 * by any decision were retired rather than wired. `reviews.submit` is retained
 * because it IS consulted. See docs/permissions/phase-7-d7-animation-rights.md.
 *
 * Pure data and pure builders: no database, no session, no side effects.
 */

/**
 * The `facilitator` module, exactly as the capability registry expects it:
 * a display name, an overall risk, and one metadata entry per capability.
 */
export const FACILITATOR_MODULE = {
  name: "Program Facilitator",
  risk: "medium",
  capabilities: {
    "participants.view": {
      label: "View Participants",
      risk: "medium",
      description: "See program participants",
    },
    "attendance.view": {
      label: "View Attendance",
      risk: "low",
      description: "See attendance",
    },
    "attendance.record": {
      label: "Record Attendance",
      risk: "medium",
      description: "Record attendance",
    },
    "assignments.view": {
      label: "View Assignments",
      risk: "low",
      description: "See assignments",
    },
    "assignments.grade": {
      label: "Grade Assignments",
      risk: "high",
      description: "Grade submissions",
    },
    "sessions.conduct": {
      label: "Conduct Sessions",
      risk: "medium",
      description: "Run sessions",
    },
    "reviews.submit": {
      label: "Submit Reviews",
      risk: "medium",
      description: "Submit reviews",
    },
  },
};

/** Every facilitator capability, in declaration order. */
export const FACILITATOR_CAPABILITY_KEYS = Object.keys(
  FACILITATOR_MODULE.capabilities,
);
