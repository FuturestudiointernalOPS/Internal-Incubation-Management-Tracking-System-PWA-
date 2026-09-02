/**
 * Facade — kept during the MVC migration so existing importers (and the
 * jest mocks in src/__tests__/tasks-api.test.js) keep resolving.
 * New code should import from "@/models/tasks".
 */
export * from "@/models/tasks";
