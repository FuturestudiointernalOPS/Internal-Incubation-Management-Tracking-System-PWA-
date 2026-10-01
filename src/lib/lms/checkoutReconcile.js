/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/lms/checkoutReconcile" keep resolving unchanged.
 * New code should import from "@/services/lms/checkoutReconcile".
 */
export * from "@/services/lms/checkoutReconcile";
