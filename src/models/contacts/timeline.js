import db from "@/lib/db";

/**
 * Contact timeline store — the paginated event read plus the append helper.
 *
 * Split out of `src/models/contacts.js` (see docs/MVC_REFACTOR.md). SQL is
 * byte-identical to the statements that used to live there, so behavior is
 * unchanged; the barrel `@/models/contacts` re-exports every name.
 *
 * Model-layer rules:
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 */

// ── GET /api/contacts/[cid]/timeline ──────────────────────────────────────────

/**
 * Timeline events for a contact. Program managers additionally see their own
 * programs' events; pmProgramIds is undefined for every other role.
 */
export async function getContactTimelineEvents(
  cid,
  {
    moduleFilter,
    typeFilter,
    pmProgramIds,
    limit,
    offset,
    includeCrm = true,
    visibleModules = null,
  } = {},
) {
  let sql = "SELECT * FROM contact_timeline WHERE contact_cid = ?";
  const args = [cid];

  // CRM events share this timeline, but they belong to the CRM: a reader
  // without CRM access must never receive them. Legacy rows with no module at
  // all are not CRM events and stay visible.
  if (!includeCrm) {
    sql += " AND (context_module IS NULL OR context_module != 'crm')";
  }

  // Per-domain visibility: an event is only handed to a reader who holds the
  // right of the domain it came from. `null` means "no restriction" (a personal
  // identity reading its own record) and is deliberately distinct from an
  // empty list, which means "nothing from a named domain".
  if (Array.isArray(visibleModules)) {
    if (visibleModules.length > 0) {
      const placeholders = visibleModules.map(() => "?").join(",");
      sql += ` AND (context_module IS NULL OR context_module IN (${placeholders}))`;
      args.push(...visibleModules);
    } else {
      sql += " AND context_module IS NULL";
    }
  }

  if (moduleFilter) {
    sql += " AND context_module = ?";
    args.push(moduleFilter);
  }
  if (typeFilter) {
    sql += " AND event_type = ?";
    args.push(typeFilter);
  }

  if (pmProgramIds) {
    if (pmProgramIds.length > 0) {
      const placeholders = pmProgramIds.map(() => "?").join(",");
      sql += ` AND (context_module != 'programs' OR context_id IN (${placeholders}))`;
      args.push(...pmProgramIds);
    } else {
      sql += " AND context_module != 'programs'";
    }
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  args.push(limit, offset);

  return db.execute({ sql, args });
}

/** Minimal contact identity row for the timeline header. */
export async function getTimelineContactIdentity(cid) {
  return db.execute({
    sql: "SELECT cid, name, email, role FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Append an event to a contact's timeline. */
export async function createContactTimelineEvent(
  cid,
  eventType,
  description,
  actorCid,
  metadata,
) {
  return db.execute({
    sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
            VALUES (?, ?, ?, 'crm', ?, ?::jsonb) RETURNING id, created_at`,
    args: [cid, eventType, description, actorCid, JSON.stringify(metadata || {})],
  });
}
