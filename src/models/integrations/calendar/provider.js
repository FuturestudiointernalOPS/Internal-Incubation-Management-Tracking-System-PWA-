/**
 * Calendar Provider Abstraction Layer
 *
 * Defines the interface all calendar providers must implement.
 * Add new providers by extending this base class.
 *
 * Currently supported:
 *   - Microsoft Graph API (Outlook / Teams calendar)
 *   - Google Calendar API (stub — ready for future migration)
 */

export class CalendarProvider {
  /**
   * Create a new calendar event
   * @param {Object} event
   * @param {string} event.title
   * @param {string} event.description
   * @param {string} event.startTime - ISO 8601
   * @param {string} event.endTime - ISO 8601
   * @param {string} [event.location]
   * @param {string[]} [event.attendees] - email addresses
   * @returns {Promise<{ success: boolean, externalId: string, url: string }>}
   */
  async createEvent(event) {
    throw new Error("Not implemented");
  }

  /**
   * Update an existing event
   * @param {string} externalId - ID from the external calendar
   * @param {Object} updates - same shape as createEvent fields
   */
  async updateEvent(externalId, updates) {
    throw new Error("Not implemented");
  }

  /**
   * Delete an event
   * @param {string} externalId
   */
  async deleteEvent(externalId) {
    throw new Error("Not implemented");
  }

  /**
   * Check if the provider is properly configured
   */
  async healthCheck() {
    throw new Error("Not implemented");
  }
}

/**
 * Resolve the active calendar provider based on environment config.
 * Returns a singleton instance of the configured provider.
 */
let _instance = null;

export async function getCalendarProvider() {
  if (_instance) return _instance;

  const provider = process.env.CALENDAR_PROVIDER || "microsoft";

  if (provider === "microsoft") {
    const { MicrosoftCalendarProvider } = await import("./microsoft");
    _instance = new MicrosoftCalendarProvider();
  } else if (provider === "google") {
    const { GoogleCalendarProvider } = await import("./google");
    _instance = new GoogleCalendarProvider();
  } else {
    throw new Error(
      `Unknown calendar provider: "${provider}". Use "microsoft" or "google".`,
    );
  }

  return _instance;
}

/**
 * Environment variables required per provider:
 *
 * ── Microsoft Graph ────────────────────
 *   CALENDAR_PROVIDER=microsoft
 *   AZURE_TENANT_ID=your-tenant-id
 *   AZURE_CLIENT_ID=your-client-id
 *   AZURE_CLIENT_SECRET=your-client-secret
 *   CALENDAR_USER_EMAIL=calendar@company.com  (the shared/mailbox whose calendar to write to)
 *
 * ── Google Calendar ────────────────────
 *   CALENDAR_PROVIDER=google
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL=...
 *   GOOGLE_PRIVATE_KEY=...
 *   GOOGLE_CALENDAR_ID=...
 */
