/**
 * Facade — kept during the MVC migration so existing importers of
 * "@/lib/contactIdentity" keep resolving unchanged.
 * New code should import from "@/models/contactIdentity".
 */
export * from "@/models/contactIdentity";
export { default } from "@/models/contactIdentity";
