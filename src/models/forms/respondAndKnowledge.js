import db from "@/lib/db";

// ── src/app/api/respond/route.js ────────────────────────────────────────────

/** Legacy forms table: group_name owning a form id (public respond). */
export async function getLegacyFormGroupName(formId) {
  return db.execute({
    sql: "SELECT group_name FROM forms WHERE form_id = ?",
    args: [formId],
  });
}

/** Contact cid matched by email (public respond identity resolution). */
export async function findContactCidByEmail(email) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?)",
    args: [email],
  });
}

/** Contact cid matched by phone (public respond identity resolution). */
export async function findContactCidByPhone(phone) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE phone = ?",
    args: [phone],
  });
}

/** Contact cid matched by fuzzy name (public respond identity resolution). */
export async function findContactCidByName(name) {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE LOWER(name) LIKE LOWER(?)",
    args: [`%${name}%`],
  });
}

/** Create the anonymous public-responder contact row. */
export async function createPublicResponseContact({ cid, name, email, phone, groupName }) {
  return db.execute({
    sql: "INSERT INTO contacts (cid, name, email, phone, group_name) VALUES (?, ?, ?, ?, ?)",
    args: [cid, name, email, phone, groupName],
  });
}

/** Record a form response from a public (or known) contact. */
export async function createFormResponse({
  formId,
  cid,
  answers,
  publicData,
  confidenceScore,
  matchStatus,
  groupName,
}) {
  return db.execute({
    sql: "INSERT INTO form_responses (form_id, cid, answers, confidence_score, match_status, group_name) VALUES (?, ?, ?, ?, ?, ?)",
    args: [formId, cid, JSON.stringify({ ...answers, ...publicData }), confidenceScore, matchStatus, groupName],
  });
}

/** Sync campaign_contact status after a public response. */
export async function updateCampaignContactResponseStatus({ status, cid, formId }) {
  return db.execute({
    sql: `UPDATE campaign_contacts
              SET status = ?
              WHERE contact_cid = ? AND campaign_id IN (SELECT id FROM campaigns WHERE form_id = ?)`,
    args: [status, cid, formId],
  });
}

// ── src/app/api/knowledge/route.js ──────────────────────────────────────────

/** Insert a knowledge note, returning its generated id. */
export async function createKnowledgeNote({ title, description, url }) {
  return db.execute({
    sql: "INSERT INTO v2_knowledge_bank (title, description, url) VALUES (?, ?, ?) RETURNING id",
    args: [title, description, url],
  });
}

/** Attach a file row to a knowledge note (create path). */
export async function createKnowledgeAttachment(noteId, name, url) {
  return db.execute({
    sql: "INSERT INTO v2_knowledge_attachments (note_id, name, url) VALUES (?, ?, ?)",
    args: [noteId, name, url],
  });
}

/** All knowledge notes, newest first. */
export async function listKnowledgeNotes() {
  return db.execute("SELECT * FROM v2_knowledge_bank ORDER BY created_at DESC");
}

/** All knowledge attachment rows. */
export async function listKnowledgeAttachments() {
  return db.execute("SELECT * FROM v2_knowledge_attachments");
}

/** Archive (or restore) a knowledge note. */
export async function archiveKnowledgeNote(id, is_archived) {
  return db.execute({
    sql: "UPDATE v2_knowledge_bank SET is_archived = ? WHERE id = ?",
    args: [is_archived ? 1 : 0, id],
  });
}

/** Edit a knowledge note's title/description. */
export async function updateKnowledgeNote(id, title, description) {
  return db.execute({
    sql: "UPDATE v2_knowledge_bank SET title = ?, description = ? WHERE id = ?",
    args: [title, description, id],
  });
}

/** Attach a file row to a knowledge note (edit path). */
export async function insertKnowledgeAttachment(noteId, name, url) {
  return db.execute({
    sql: "INSERT INTO v2_knowledge_attachments (note_id, name, url) VALUES (?, ?, ?)",
    args: [noteId, name, url],
  });
}

/** Delete a knowledge note by id. */
export async function deleteKnowledgeNote(id) {
  return db.execute({
    sql: "DELETE FROM v2_knowledge_bank WHERE id = ?",
    args: [id],
  });
}
