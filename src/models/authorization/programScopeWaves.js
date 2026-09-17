/**
 * ImpactOS — PROGRAM SCOPE WAVES (pure catalogue)
 *
 * The PROGRAM WRITE domains, grouped so the census, the readiness report and the
 * UI all describe the same three things. A wave is a GROUPING, not a gate: the
 * record-scope rule is enforced on every wired surface, unconditionally — there
 * is no switch, because a rule that only applies when somebody remembers to
 * enable it does not protect anything.
 *
 * `partial` / `exempt` are the honest part. Some surfaces inside a domain are NOT
 * scope-enforced, and an administrator must never read a domain as closed when it
 * is not. They fall into two kinds:
 *
 *   - INTENTIONALLY outside the rule: accepting an invitation (the token is the
 *     authorisation, and the invitee is not staff), and enrolments created as a
 *     side effect of another operation;
 *   - NOT YET converted: the two legacy V2 routes that carry a project banner
 *     reserving them for V1 pages and instructing agents to leave them
 *     read-only. Those are the ones a human still has to deal with.
 *
 * No db import, no side effects: this is vocabulary shared by the guard, the
 * report, the census test and the screens.
 */

export const PROGRAM_SCOPE_WAVES = ["content", "enrollment", "groups"];

export const PROGRAM_SCOPE_WAVE_INFO = {
  content: {
    key: "content",
    label: "Program content",
    covers: "Editing and archiving a program's own content",
    // Every write surface of this domain consults the rule.
    partial: false,
    exempt: [],
  },
  enrollment: {
    key: "enrollment",
    label: "Invitations and enrollment",
    covers: "Program invitations, adding and removing participants",
    partial: true,
    exempt: [
      // Two DIFFERENT legitimate gaps, and neither is a bypass waiting on a
      // conversion:
      //   * accepting an invitation — the token IS the authorisation, and the
      //     invitee is not staff, so the rule deliberately does not apply;
      //   * enrolments created as a SIDE EFFECT of another operation (contact
      //     and group sync). They are not program-write surfaces, so wiring them
      //     here would be the wrong place.
      "api/invites/[token] (accepting an invitation — the token is the authorisation)",
      "enrollment created as a side effect by contact and group sync (not a program-write surface)",
    ],
  },
  groups: {
    key: "groups",
    label: "Groups and targets",
    covers: "Cohorts/groups and KPI weights",
    partial: true,
    exempt: [
      "api/v2/groups (legacy V2 route — project instruction: changes go in the V1 counterpart)",
      "api/v2/kpis (legacy V2 route — project instruction: changes go in the V1 counterpart)",
    ],
  },
};

export function isProgramScopeWave(wave) {
  return PROGRAM_SCOPE_WAVES.includes(wave);
}
