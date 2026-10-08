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
  moduleFilter,
  typeFilter,
  pmProgramIds,
  limit,
  offset,
) {
  let sql = "SELECT * FROM contact_timeline WHERE contact_cid = ?";
  const args = [cid];

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
