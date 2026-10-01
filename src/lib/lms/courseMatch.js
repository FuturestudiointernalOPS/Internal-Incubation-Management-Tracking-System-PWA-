/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/..." keep resolving unchanged.
 * New code should import from "@/models/lms/courseMatch".
 */
export * from "@/models/lms/courseMatch";
