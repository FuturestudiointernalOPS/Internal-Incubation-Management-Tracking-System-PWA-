import db from "@/lib/db";
import { readProgramAccessSnapshot } from "./programReads";

export async function withOrganizationVentureRead(credentials, callback) {
  return db.transaction(async (query) => {
    await query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const snapshot = await readProgramAccessSnapshot(query, credentials);
    return callback({
      snapshot,
      async listAssignedVentures(organizationId, personId) {
        const result = await query(
          `SELECT venture.id::text AS id, venture.venture_id AS code,
                  venture.company_name, venture.industry, venture.business_stage,
                  venture.status, venture.description, venture.website,
                  venture.logo_url, venture.created_at,
                  CASE WHEN EXISTS (
                    SELECT 1 FROM venture_members member
                    WHERE member.venture_id::text IN (venture.id::text, venture.venture_id)
                      AND (member.contact_id = ? OR member.user_cid = ?)
                      AND member.removed_at IS NULL AND member.suspended_at IS NULL
                  ) THEN 'member' ELSE 'assigned' END AS assignment_type
           FROM ventures venture
           WHERE venture.owner_organization_id = ?
             AND COALESCE(venture.is_archived::int, 0) = 0
             AND COALESCE(LOWER(venture.status), '') <> 'archived'
             AND (
               EXISTS (
                 SELECT 1 FROM venture_members member
                 WHERE member.venture_id::text IN (venture.id::text, venture.venture_id)
                   AND (member.contact_id = ? OR member.user_cid = ?)
                   AND member.removed_at IS NULL AND member.suspended_at IS NULL
               )
               OR EXISTS (
                 SELECT 1 FROM venture_staff_assignments assignment
                 WHERE assignment.venture_id::text IN (venture.id::text, venture.venture_id)
                   AND assignment.staff_contact_id = ?
                   AND assignment.status = 'active'
               )
             )
           ORDER BY venture.company_name, venture.id
           LIMIT 200`,
          [personId, personId, organizationId, personId, personId, personId],
        );
        return result.rows;
      },
    });
  });
}
