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
 * is not. Right now those are three legacy V2 route files that carry a project
 * banner reserving them for V1 pages and instructing agents to leave them
 * read-only, so their endpoints stay open until a human converts them.
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
      "api/v2/invites (legacy V2 route — project instruction: changes go in the V1 counterpart)",
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
