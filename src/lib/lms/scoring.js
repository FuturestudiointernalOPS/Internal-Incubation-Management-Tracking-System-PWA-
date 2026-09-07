/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/scoring" keep resolving unchanged.
 * New code should import from "@/models/lms/scoring".
 */
export * from "@/models/lms/scoring";
