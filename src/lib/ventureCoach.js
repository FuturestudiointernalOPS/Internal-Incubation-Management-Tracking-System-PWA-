/**
 * COMPATIBILITY FACADE — the Venture coach layer moved to the service.
 *
 * This module resolved coach identities and invited coaches while running its
 * SQL in the same functions. The decisions now live in
 * `@/services/ventures/coach`; every statement in
 * `@/models/ventureCoachStore`.
 *
 * Re-exported unchanged so existing importers keep working (the sessions and
 * coach-invite routes, and the suites). New code imports from the service.
 * Deleted once `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

import { resolveCoachContact, inviteCoachByEmail } from "@/services/ventures/coach";

export { resolveCoachContact, inviteCoachByEmail };

export default { resolveCoachContact, inviteCoachByEmail };
