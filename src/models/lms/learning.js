/**
 * COMPATIBILITY FACADE — the LMS learner experience moved to the service layer.
 *
 * This module computed progress/access/completion and ran the SQL in the same
 * functions. The decisions now live in `@/services/lms/learning`; every
 * statement in `@/models/lms/learningStore`.
 *
 * Re-exported unchanged so existing importers keep working (the LMS routes and
 * the suites, which reach it via `@/lib/lms/learning`). New code imports the
 * decisions from the service and the statements from the store. Deleted once
 * `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

export * from "@/services/lms/learning";
