/**
 * COMPATIBILITY FACADE — finance reads moved to the service layer.
 *
 * This module resolved the data source, aggregated the figures and ran the SQL.
 * The resolution and aggregation now live in `@/services/finance/queries`; every
 * statement in `@/models/finance/queriesStore`.
 *
 * Re-exported unchanged so existing importers keep working (the finance routes
 * reach it via `@/lib/finance/queries`). New code imports from the service.
 * Deleted once `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

export * from "@/services/finance/queries";
