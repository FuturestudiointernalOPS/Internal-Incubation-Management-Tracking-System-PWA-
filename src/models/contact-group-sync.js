/**
 * Compatibility re-export (one-release bridge).
 * Decisions: `@/services/contacts/contactGroupSync`
 * SQL store: `@/models/contactGroupSyncStore`
 * Preferred public import: `@/lib/contact-group-sync` or the service.
 *
 * Prefer not to grow new importers here — models normally must not depend on
 * services; this file exists only so stray `@/models/contact-group-sync`
 * imports keep resolving during the corridor-5 cutover.
 */
export {
  syncApprovedSubmissionToProgramGroup,
  reconcileProgramGroups,
  reconcileParticipantPrograms,
} from "@/services/contacts/contactGroupSync";
