/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/kpi-progress" keep resolving unchanged.
 * New code should import from "@/models/kpi-progress".
 */
export * from "@/models/kpi-progress";
