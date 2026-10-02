/**
 * Facade — kept so existing importers of "@/lib/contact-group-sync"
 * (e.g. form-runs approval) keep resolving unchanged.
 * Decisions: `@/services/contacts/contactGroupSync`
 * SQL store: `@/models/contactGroupSyncStore`
 */
export {
  syncApprovedSubmissionToProgramGroup,
  reconcileProgramGroups,
  reconcileParticipantPrograms,
} from "@/services/contacts/contactGroupSync";
