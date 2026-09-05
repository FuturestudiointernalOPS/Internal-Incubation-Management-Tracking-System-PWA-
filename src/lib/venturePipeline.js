/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/venturePipeline" keep resolving unchanged.
 * New code should import from "@/models/venturePipeline".
 */
export * from "@/models/venturePipeline";
export { default } from "@/models/venturePipeline";
