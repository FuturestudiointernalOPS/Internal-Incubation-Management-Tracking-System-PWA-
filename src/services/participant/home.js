/**
 * Participant service — the participant home dashboard.
 *
 * Layer (see docs/LAYER_SPLIT.md): every DECISION of the home dashboard lives in
 * `./home/` — the per-program rates (`metrics`), the action centre (`actions`),
 * the calendar + announcements shaping (`calendar`) and the assembly (`build`),
 * on top of the shared unlock rules in `../rules`. This file re-exports the same
 * public surface, so importers and tests are unchanged.
 *
 * Every statement lives in `@/models/participantPortal` (and the Venture session
 * source in the workspace service). No SQL, no HTTP.
 */

export { isUnlockedSession, resolveDeliverableWeek } from "./rules";
export { computeProgramMetrics } from "./home/metrics";
export { buildActionCenter } from "./home/actions";
export { buildCalendarEvents, mapAnnouncements } from "./home/calendar";
export { buildParticipantHome } from "./home/build";