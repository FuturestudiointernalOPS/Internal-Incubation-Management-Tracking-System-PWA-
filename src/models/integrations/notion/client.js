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
    const err = await res.text();
    throw new Error(`Notion API error: ${err}`);
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
 * Get database info (for health checks)
 */
export async function getDatabase(databaseId) {
  return notionFetch(`/databases/${databaseId}`);
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

/**
 * Query a database for existing pages (by title match)
 */
export async function queryDatabase(databaseId, filter) {
  return notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({ filter }),
  });
}

/**
 * Build Notion properties for a task
 *
 * Expected DB columns in Notion:
 *   - Title (title) → task title
 *   - Status (select) → task status
 *   - Project (select) → project name
 *   - Assignee (rich_text) → user name
 *   - Due Date (date) → end_date
 *   - Week (number) → created_week
 *   - Year (number) → created_year
 */
export function taskToProperties(task) {
  const props = {
    Title: { title: [{ text: { content: task.title || "Untitled Task" } }] },
  };

  if (task.status) {
    props.Status = { select: { name: task.status.replace(/_/g, " ") } };
  }

  if (task.project_name) {
    props.Project = { select: { name: task.project_name } };
  }

  if (task.user_name) {
    props.Assignee = { rich_text: [{ text: { content: task.user_name } }] };
  }

  if (task.end_date) {
    props["Due Date"] = { date: { start: task.end_date } };
  }

  if (task.created_week != null) {
    props.Week = { number: task.created_week };
  }

  if (task.created_year != null) {
    props.Year = { number: task.created_year };
  }

  return props;
}

/**
 * Build Notion properties for a project
 *
 * Expected DB columns in Notion:
 *   - Name (title) → project name
 *   - Status (select) → project status
 *   - Program (select) → program name
 *   - PM (rich_text) → PM name
 */
export function projectToProperties(project) {
  const props = {
    Name: {
      title: [{ text: { content: project.name || "Untitled Project" } }],
    },
  };

  if (project.status) {
    props.Status = { select: { name: project.status } };
  }

  if (project.program_name) {
    props.Program = { select: { name: project.program_name } };
  }

  if (project.pm_name) {
    props.PM = { rich_text: [{ text: { content: project.pm_name } }] };
  }

  return props;
}
