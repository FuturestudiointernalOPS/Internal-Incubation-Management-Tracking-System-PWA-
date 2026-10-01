/**
 * COMPATIBILITY FACADE — finance ingestion moved to the service layer.
 *
 * This module parsed the finance sheets AND ran the sync's SQL. The parsing and
 * the orchestration now live in `@/services/finance/ingest`; every statement in
 * `@/models/finance/ingestStore`.
 *
 * Re-exported unchanged so existing importers keep working (the sync route via
 * `@/lib/finance/ingest`). New code imports from the service. Deleted once
 * `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

export * from "@/services/finance/ingest";
