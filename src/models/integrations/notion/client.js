/**
 * Notion API Client
 *
 * Provides methods to interact with Notion databases for syncing
 * tasks and projects from ImpactOS to Notion.
 *
 * Prerequisites:
 *   1. Go to https://www.notion.so/my-integrations → Create integration
 *   2. Copy the "Internal Integration Secret" (token)
 *   3. Share your Notion databases with the integration
 *   4. Set env vars:
 *        NOTION_API_KEY=ntn_...
 *        NOTION_TASKS_DATABASE_ID=...
 *        NOTION_PROJECTS_DATABASE_ID=...
 */

const NOTION_API = "https://api.notion.com/v1";

/**
 * Call the Notion API
 */
async function notionFetch(path, options = {}) {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Notion not configured. Set NOTION_API_KEY environment variable.",
    );
  }

  const res = await fetch(`${NOTION_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Notion API error: ${errorText}`);
  }

  return res.json();
}

/**
 * Validate configuration without making API calls
 */
export function isConfigured() {
  return !!(
    process.env.NOTION_API_KEY &&
    process.env.NOTION_TASKS_DATABASE_ID
  );
}

/**
 * Create a page (row) in a Notion database
 */
export async function createPage(databaseId, properties) {
  return notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  });
}

/**
 * Update a page in a Notion database
 */
export async function updatePage(pageId, properties) {
  return notionFetch(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

