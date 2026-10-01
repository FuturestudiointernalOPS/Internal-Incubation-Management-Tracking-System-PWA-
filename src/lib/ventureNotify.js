/**
 * COMPATIBILITY FACADE — the Venture notification helpers moved to the service.
 *
 * This module resolved the audience and ran its SQL in the same functions. The
 * decisions (the founder/coach/Lead-Manager audiences, the email rendering and
 * the per-recipient isolation) now live in `@/services/ventures/notify`; every
 * statement in `@/models/ventureNotifyStore`.
 *
 * Re-exported unchanged so existing importers keep working (the sessions and
 * submissions routes, and the suites). New code imports from the service.
 * Deleted once `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

export {
  notifyAndEmailVentureFounders,
  notifyVentureCoach,
  notifyVentureLeadManagers,
} from "@/services/ventures/notify";
