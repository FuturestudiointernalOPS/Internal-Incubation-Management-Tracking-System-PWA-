/**
 * COMPATIBILITY FACADE — the Venture access facts moved to the service layer.
 *
 * This module resolved and cached a Venture's own facts and the viewer's
 * relationship to it while running the SQL in the same functions. The decisions
 * (the cache, the promise sharing, the failure is never remembered) now live in
 * `@/services/ventures/accessFacts`; every statement in
 * `@/models/ventureAccessStore`.
 *
 * Re-exported unchanged so existing importers keep working. New code imports the
 * decisions from the service. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

import {
  getVentureFacts,
  getViewerRelationship,
  ventureAccessFacts,
  invalidateVentureAccess,
  resetVentureAccessCache,
} from "@/services/ventures/accessFacts";

export { getVentureFacts, getViewerRelationship, ventureAccessFacts, invalidateVentureAccess, resetVentureAccessCache };

export default {
  getVentureFacts,
  getViewerRelationship,
  ventureAccessFacts,
  invalidateVentureAccess,
  resetVentureAccessCache,
};
