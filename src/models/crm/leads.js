import db from "@/lib/db";

/**
 * CRM Leads model — data access for CRM lead records.
 * 
 * Part of CRM Phase 2.
 * Pure data layer — no HTTP imports.
 */

// ─── READ ────────────────────────────────────────────────────────────────────

export async function getCrmLeads({ ownerCid, status, leadType, qualification } = {}) {
  let sql = `
    SELECT 
      l.*,
      c.name AS contact_name,
      c.email AS contact_email,
      o.name AS organization_name,
      own.name AS owner_name
    FROM crm_leads l
    LEFT JOIN contacts c ON c.cid = l.contact_cid
    LEFT JOIN crm_organizations o ON o.id = l.organization_id
    LEFT JOIN contacts own ON own.cid = l.owner_cid
    WHERE l.deleted_at IS NULL
  `;
  const args = [];

  if (ownerCid) {
    sql += ` AND l.owner_cid = ?`;
    args.push(ownerCid);
  }
  if (status) {
    sql += ` AND l.status = ?`;
    args.push(status);
  }
  if (leadType) {
    sql += ` AND l.lead_type = ?`;
    args.push(leadType);
  }
  if (qualification) {
    sql += ` AND l.qualification_state = ?`;
    args.push(qualification);
  }

  sql += ` ORDER BY l.created_at DESC`;

  return db.execute({ sql, args });
}

export async function getCrmLeadById(id) {
  return db.execute({
    sql: `
      SELECT 
        l.*,
        c.name AS contact_name,
        c.email AS contact_email,
        o.name AS organization_name,
        own.name AS owner_name
      FROM crm_leads l
      LEFT JOIN contacts c ON c.cid = l.contact_cid
      LEFT JOIN crm_organizations o ON o.id = l.organization_id
      LEFT JOIN contacts own ON own.cid = l.owner_cid
      WHERE l.id = ? AND l.deleted_at IS NULL
    `,
    args: [id],
  });
}

// ─── WRITE ───────────────────────────────────────────────────────────────────

export async function createCrmLead({
  title,
  contact_cid,
  organization_id,
  owner_cid,
  lead_type,
  status,
  qualification_state,
  source,
  description,
  notes,
  created_by
}) {
  return db.execute({
    sql: `INSERT INTO crm_leads
            (title, contact_cid, organization_id, owner_cid, lead_type, status, 
             qualification_state, source, description, notes, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING *`,
    args: [
      title,
      contact_cid ?? null,
      organization_id ?? null,
      owner_cid ?? null,
      lead_type ?? 'other',
      status ?? 'new',
      qualification_state ?? 'not_assessed',
      source ?? null,
      description ?? null,
      notes ?? null,
      created_by ?? null,
    ],
  });
}

export async function updateCrmLead(id, updates) {
  // Use a dynamic update builder for partial updates
  const allowedFields = [
    'title', 'contact_cid', 'organization_id', 'owner_cid', 'lead_type', 
    'status', 'qualification_state', 'qualification_date', 'qualification_reason', 
    'qualification_notes', 'score', 'source', 'description', 'notes', 
    'is_converted', 'converted_at'
  ];
  
  const sets = [];
  const args = [];
  
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      sets.push(`${field} = ?`);
      args.push(updates[field]);
    }
  }
  
  if (sets.length === 0) return getCrmLeadById(id);
  
  sets.push(`updated_at = NOW()`);
  args.push(id);
  
  const sql = `
    UPDATE crm_leads 
    SET ${sets.join(', ')} 
    WHERE id = ? AND deleted_at IS NULL 
    RETURNING *
  `;
  
  return db.execute({ sql, args });
}

export async function softDeleteCrmLead(id, deletedByCid) {
  return db.execute({
    sql: `UPDATE crm_leads
          SET deleted_at = NOW(), deleted_by = ?, updated_at = NOW()
          WHERE id = ? AND deleted_at IS NULL
          RETURNING id`,
    args: [deletedByCid ?? null, id],
  });
}
