/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/journey" keep resolving unchanged.
 * New code should import from "@/models/lms/journey".
 */
export * from "@/models/lms/journey";
