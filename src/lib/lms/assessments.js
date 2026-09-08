/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/assessments" keep resolving unchanged.
 * New code should import from "@/models/lms/assessments".
 */
export * from "@/models/lms/assessments";
