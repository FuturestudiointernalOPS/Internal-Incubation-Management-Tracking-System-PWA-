/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/certificate-pdf" keep resolving unchanged.
 * New code should import from "@/models/lms/certificate-pdf".
 */
export * from "@/models/lms/certificate-pdf";
