/**
 * CRM models — barrel export for all CRM domain models.
 *
 * Import from @/models/crm instead of deep-importing individual files.
 *
 * Phase 1 exports: organizations + relationships.
 * Phase 2+ will add: leads, opportunities, pipelines, activities.
 */

export * from "./organizations";
export * from "./relationships";
export * from "./leads";
export * from "./pipelines";
export * from "./opportunities";
export * from "./stageHistory";
export * from "./activities";
