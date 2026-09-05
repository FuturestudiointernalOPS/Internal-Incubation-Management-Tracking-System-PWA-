/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/lessons" keep resolving unchanged.
 * New code should import from "@/models/lms/lessons".
 */
export * from "@/models/lms/lessons";
