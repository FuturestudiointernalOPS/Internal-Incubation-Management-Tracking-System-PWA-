/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/sections" keep resolving unchanged.
 * New code should import from "@/models/lms/sections".
 */
export * from "@/models/lms/sections";
