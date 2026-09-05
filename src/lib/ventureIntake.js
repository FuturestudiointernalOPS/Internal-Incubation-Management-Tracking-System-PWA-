/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/ventureIntake" keep resolving unchanged.
 * New code should import from "@/models/ventureIntake".
 */
export * from "@/models/ventureIntake";
export { default } from "@/models/ventureIntake";
