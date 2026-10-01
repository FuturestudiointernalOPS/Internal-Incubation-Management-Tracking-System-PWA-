/**
 * COMPATIBILITY FACADE — the readiness report moved to the service layer.
 *
 * This module was a report (a decision) that also ran SQL and reached into the
 * authorization resolver. It now lives in
 * `@/services/authorization/contextGrantReadiness`, with its two statements in
 * `@/models/authorization/contextGrantReadinessReads`.
 *
 * Re-exported unchanged so existing importers keep working. New code imports
 * from the service. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

export * from "@/services/authorization/contextGrantReadiness";
