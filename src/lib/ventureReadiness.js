/**
 * COMPATIBILITY FACADE — the roadmap readiness engine moved to the service.
 *
 * This module scored the roadmap while running its four reads inline. The
 * weighting lives in `@/services/ventures/readiness`; every statement in
 * `@/models/ventureReadinessStore`.
 *
 * Re-exported unchanged so existing importers keep working (the
 * investment-readiness route and the suites). New code imports from the service.
 * Deleted once `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

import { READINESS_WEIGHTS, computeRoadmapReadiness } from "@/services/ventures/readiness";

export { READINESS_WEIGHTS, computeRoadmapReadiness };

export default { computeRoadmapReadiness };
