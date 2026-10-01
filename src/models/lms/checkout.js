/**
 * COMPATIBILITY FACADE — the LMS checkout moved to the service layer.
 *
 * This module resolved the price, captured the registration, granted the course
 * access and minted the access links while running the SQL in the same
 * functions. The decisions now live in `@/services/lms/checkout`; every
 * statement in `@/models/lms/checkoutStore`.
 *
 * Re-exported unchanged so existing importers keep working (the LMS routes and
 * the suites, which reach it via `@/lib/lms/checkout`). New code imports the
 * decisions from the service and the statements from the store. Deleted once
 * `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

export * from "@/services/lms/checkout";
