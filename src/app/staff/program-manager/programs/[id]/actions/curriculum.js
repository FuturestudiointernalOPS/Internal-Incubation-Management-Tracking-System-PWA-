/**
 * Curriculum actions: the barrel the program workspace imports.
 *
 * The bodies were split by concern into ./curriculumSessions (sessions and the
 * materials attached to them, plus the KPI toggle the session and requirement
 * modals share) and ./curriculumRequirements (requirements and their reminders),
 * so each module stays within the line guardrail. `curriculumActions` keeps its
 * name, its single `ctx` argument and its returned handler shape.
 */
import { curriculumSessionActions } from "./curriculumSessions";
import { curriculumRequirementActions } from "./curriculumRequirements";

export function curriculumActions(ctx) {
  return {
    ...curriculumSessionActions(ctx),
    ...curriculumRequirementActions(ctx),
  };
}
