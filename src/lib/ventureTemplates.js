/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/ventureTemplates" keep resolving unchanged.
 * New code should import from "@/models/ventureTemplates".
 */
export * from "@/models/ventureTemplates";
export { default } from "@/models/ventureTemplates";
