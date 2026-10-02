/**
 * Groups model — public entry point.
 *
 * The data access used to live in this single 818-line file. It now lives in
 * `./groups/*`, one store per sub-domain (contact groups, user groups, program
 * enrollment, segments, invitations, org teams, v2 groups). This file only
 * re-exports them, so every existing importer of `@/models/groups` keeps
 * resolving — see docs/MVC_REFACTOR.md and docs/LAYER_SPLIT.md.
 */
export * from "./groups/contactGroups";
export * from "./groups/userGroups";
export * from "./groups/enrollment";
export * from "./groups/segments";
export * from "./groups/invitations";
export * from "./groups/orgTeams";
export * from "./groups/v2Groups";

/**
 * Sync a contact into v2_participants as Active.
 *
 * The fallback policy lives in `@/services/contacts/participantSync` (the
 * decision), with its two statements in `@/models/participantSyncStore`.
 * Re-exported here so existing importers keep working — see docs/LAYER_SPLIT.md.
 */
export { upsertV2ParticipantActiveWithFallback } from "@/services/contacts/participantSync";
