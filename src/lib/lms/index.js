/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms" (the LMS barrel) keep resolving unchanged.
 * New code should import from "@/models/lms".
 */
export * from "@/models/lms";
