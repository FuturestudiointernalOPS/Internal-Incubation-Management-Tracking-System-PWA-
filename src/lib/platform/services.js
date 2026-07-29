/**
 * PLATFORM SERVICE REGISTRY
 *
 * Centralized metadata registry for Platform services.
 * Describes available services without importing them client-side.
 * Actual service loading happens in API routes / server components.
 *
 * To add a new service, add an entry to SERVICE_DEFINITIONS below.
 */

export const SERVICE_DEFINITIONS = {
  audit: {
    name: "Audit Logging",
    description: "Centralized audit trail for platform actions",
    type: "infrastructure",
    optional: false,
    methods: ["log", "query"],
  },
  notifications: {
    name: "Notification Service",
    description: "Send and manage notifications across the platform",
    type: "infrastructure",
    optional: true,
    methods: ["send", "broadcast", "schedule"],
  },
  crm: {
    name: "CRM Integration",
    description: "Contact records, timeline, and relationship management",
    type: "business",
    optional: false,
    methods: ["create", "update", "search", "merge"],
  },
  email: {
    name: "Email Service",
    description: "Transactional email delivery and template management",
    type: "infrastructure",
    optional: true,
    methods: ["send", "sendTemplate", "preview"],
  },
  ai: {
    name: "AI Providers",
    description: "LLM summarization, scoring, and generative capabilities",
    type: "infrastructure",
    optional: true,
    methods: ["summarize", "score", "generate", "evaluate"],
  },
  calendar: {
    name: "Calendar Sync",
    description: "Sync Platform deadlines to Microsoft Graph or Google Calendar",
    type: "integration",
    optional: true,
    methods: ["sync", "unsync", "syncAll"],
  },
  notion: {
    name: "Notion Sync",
    description: "Push submissions and runs to Notion databases",
    type: "integration",
    optional: true,
    methods: ["sync", "syncAll"],
  },
};

/**
 * List all available services with their metadata.
 */
export function listServices() {
  return Object.entries(SERVICE_DEFINITIONS).map(([key, def]) => ({
    id: key,
    ...def,
    // Non-optional services are always ready. Optional ones need env vars —
    // shown as "Ready" when non-optional, "Pending" when optional (client can't check env).
    loaded: !def.optional,
  }));
}

/**
 * Check if a service exists in the registry.
 */
export function hasService(name) {
  return !!SERVICE_DEFINITIONS[name];
}

/**
 * Get a single service definition by name.
 */
export function getServiceDefinition(name) {
  return SERVICE_DEFINITIONS[name] || null;
}
