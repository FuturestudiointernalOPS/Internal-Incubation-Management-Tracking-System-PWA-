/**
 * COMPATIBILITY FACADE — the Run report composer moved to the service layer.
 *
 * This module shaped the prompt, parsed and validated the model's answer and
 * read/wrote the stored report in the same functions. The decisions now live in
 * `@/services/platform/report`; every statement in
 * `@/models/platform/ai/reportStore`.
 *
 * Re-exported unchanged so existing importers keep working (the form-runs route
 * and the report suites). Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

export * from "@/services/platform/report";
