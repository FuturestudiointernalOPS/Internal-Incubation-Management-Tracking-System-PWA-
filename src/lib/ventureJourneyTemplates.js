/**
 * COMPATIBILITY FACADE — the Journey template library moved to the service.
 *
 * This module saved a Venture Journey as a reusable template and applied one
 * back into a Venture while running the SQL in the same functions. The decisions
 * now live in `@/services/ventures/journey`; every statement in
 * `@/models/ventureJourneyStore`.
 *
 * Re-exported unchanged so existing importers keep working (the template routes
 * and the suites). New code imports the decisions from the service. Deleted once
 * `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

import { listJourneyTemplates, saveJourneyAsTemplate, applyJourneyTemplate } from "@/services/ventures/journey";

export { listJourneyTemplates, saveJourneyAsTemplate, applyJourneyTemplate };

export default { listJourneyTemplates, saveJourneyAsTemplate, applyJourneyTemplate };
