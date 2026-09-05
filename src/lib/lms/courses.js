/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/courses" keep resolving unchanged.
 * New code should import from "@/models/lms/courses".
 */
export * from "@/models/lms/courses";
