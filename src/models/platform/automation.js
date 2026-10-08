/**
 * PLATFORM AUTOMATION ENGINE
 *
 * Event-driven automation layer. When Platform events occur
 * (submission received, review completed, deadline approaching),
 * the engine runs configured automation rules.
 *
 * Rules can be defined declaratively and are executed asynchronously
 * to avoid blocking the main request flow.
 */

export * from "./automation/crmHelpers";
export * from "./automation/submissionConfirmation";
export * from "./automation/automationCore";
export * from "./automation/engine";
