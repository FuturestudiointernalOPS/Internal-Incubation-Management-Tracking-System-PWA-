import db from "@/lib/db";
import { createOrganizationSessionReader } from "./programSessions";
import { readProgramAccessSnapshot, PROGRAM_SCOPE, scopeArgs } from "./programReads";

// No DDL or legacy membership/group synchronisation on the client path.
export async function withOrganizationProgramManagement(credentials, write, callback) {
  return db.transaction(async (query) => {
    await query(write ? "SET TRANSACTION ISOLATION LEVEL READ COMMITTED" : "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    await query("SET LOCAL statement_timeout = '10s'");
    await query("SET LOCAL lock_timeout = '3s'");
    if (write) {
      // Context switches lock the same session row. A stale tab cannot silently
      // retarget a mutation while this transaction is in flight.
      await query(`SELECT token_hash FROM user_sessions WHERE user_cid=?
        AND (token_hash=? OR (token_hash IS NULL AND token=?)) FOR UPDATE`,
      [credentials.cid, credentials.tokenHash, credentials.token]);
      await query("SELECT set_config('app.actor_person_id',?,true),set_config('app.request_id',?,true)", [credentials.cid, credentials.requestId]);
    }
    return callback({
      ...createOrganizationSessionReader(query),
      accessSnapshot: () => readProgramAccessSnapshot(query, credentials, null, write),
      async program(scope, id) {
        if (write) {
          const locked = await query(`SELECT p.id FROM v2_programs p
            WHERE ${PROGRAM_SCOPE} AND p.id=? FOR UPDATE OF p`, [...scopeArgs(scope), id]);
          if (!locked.rows.length) return null;
        }
        // A separate statement AFTER acquiring the parent lock sees the revision
        // committed by a writer we waited for; a joined snapshot before waiting
        // could otherwise retain the previous revision.
        return (await query(`SELECT p.id,p.name,p.description,p.status,p.start_date,p.end_date,
          p.duration_weeks,p.duration_days,COALESCE(r.revision,0) AS revision
          FROM v2_programs p LEFT JOIN organization_program_revisions r
            ON r.id=p.id AND r.organization_id=p.organization_id
          WHERE ${PROGRAM_SCOPE} AND p.id=?`,
        [...scopeArgs(scope), id])).rows[0] || null;
      },
      async createProgram(organizationId, id, fields) {
        return (await query(`INSERT INTO v2_programs
          (id,organization_id,name,description,status,start_date,end_date,duration_weeks,duration_days)
          VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`, [id, organizationId, fields.name, fields.description,
        fields.status, fields.start_date, fields.end_date, fields.duration_weeks, fields.duration_days])).rows[0];
      },
      async updateProgram(organizationId, id, fields) {
        await query(`UPDATE v2_programs SET name=?,description=?,status=?,start_date=?,end_date=?,
          duration_weeks=?,duration_days=?,is_archived=? WHERE organization_id=? AND id=?`,
        [fields.name, fields.description, fields.status, fields.start_date, fields.end_date,
          fields.duration_weeks, fields.duration_days, fields.status === "archived" ? 1 : 0, organizationId, id]);
      },
      async revision(organizationId, id) {
        return (await query(`INSERT INTO organization_program_revisions(id,organization_id,revision) VALUES (?,?,1)
          ON CONFLICT(id) DO UPDATE SET revision=organization_program_revisions.revision+1
          WHERE organization_program_revisions.organization_id=excluded.organization_id RETURNING revision`, [id, organizationId])).rows[0].revision;
      },
      async cohorts(organizationId, programId, limit, offset) {
        return (await query(`SELECT c.id,c.name,c.year,c.status,c.start_date,c.end_date,c.revision,
          (SELECT count(*)::integer FROM organization_program_enrollments e
            WHERE e.organization_id=c.organization_id AND e.program_id=c.program_id
              AND e.cohort_id=c.id AND e.status='active') AS active_enrollments
          FROM organization_program_cohorts c WHERE c.organization_id=? AND c.program_id=?
          ORDER BY c.year DESC,c.id LIMIT ? OFFSET ?`, [organizationId, programId, limit, offset])).rows;
      },
      async cohort(organizationId, programId, cohortId) {
        return (await query(`SELECT id,name,year,status,start_date,end_date,revision
          FROM organization_program_cohorts WHERE organization_id=? AND program_id=? AND id=?
          ${write ? "FOR UPDATE" : ""}`, [organizationId, programId, cohortId])).rows[0] || null;
      },
      async createCohort(organizationId, programId, fields) {
        return (await query(`INSERT INTO organization_program_cohorts(organization_id,program_id,name,year,start_date,end_date)
          VALUES (?,?,?,?,?,?) RETURNING id,revision`, [organizationId, programId, fields.name, fields.year, fields.start_date, fields.end_date])).rows[0];
      },
      async updateCohort(organizationId, programId, cohortId, fields) {
        return (await query(`UPDATE organization_program_cohorts SET name=?,status=?,start_date=?,end_date=?,revision=revision+1
          WHERE organization_id=? AND program_id=? AND id=? RETURNING id,revision`,
        [fields.name, fields.status, fields.start_date, fields.end_date, organizationId, programId, cohortId])).rows[0];
      },
      async activeEnrollmentCount(organizationId, programId, cohortId) {
        return Number((await query(`SELECT count(*) AS count FROM organization_program_enrollments
          WHERE organization_id=? AND program_id=? AND cohort_id=? AND status='active'`, [organizationId, programId, cohortId])).rows[0].count);
      },
      async openCohortCount(organizationId, programId) {
        return Number((await query(`SELECT count(*) AS count FROM organization_program_cohorts
          WHERE organization_id=? AND program_id=? AND status IN ('planned','active')`, [organizationId, programId])).rows[0].count);
      },
      async members(organizationId, search, limit, offset) {
        return (await query(`SELECT m.id AS membership_id,c.name FROM organization_memberships m
          JOIN contacts c ON c.cid=m.person_id AND c.deleted=0 AND c.status IN ('active','approved') AND lower(btrim(c.role)) IN ('member','participant','investor','founder','venture_owner','entrepreneur')
          WHERE m.organization_id=? AND m.status='active' AND m.ended_at IS NULL
            AND (m.started_at IS NULL OR m.started_at<=clock_timestamp())
            AND (m.expires_at IS NULL OR m.expires_at>clock_timestamp())
            AND POSITION(LOWER(?) IN LOWER(COALESCE(c.name,'')))>0
          ORDER BY c.name,m.id LIMIT ? OFFSET ?`, [organizationId, search, limit, offset])).rows;
      },
      async member(organizationId, membershipId) {
        return (await query(`SELECT m.id FROM organization_memberships m
          JOIN contacts c ON c.cid=m.person_id AND c.deleted=0 AND c.status IN ('active','approved') AND lower(btrim(c.role)) IN ('member','participant','investor','founder','venture_owner','entrepreneur')
          WHERE m.organization_id=? AND m.id=? AND m.status='active' AND m.ended_at IS NULL
            AND (m.started_at IS NULL OR m.started_at<=clock_timestamp())
            AND (m.expires_at IS NULL OR m.expires_at>clock_timestamp()) FOR SHARE OF m,c`, [organizationId, membershipId])).rows[0] || null;
      },
      async enrollments(organizationId, programId, cohortId, limit, offset) {
        return (await query(`SELECT e.id,e.membership_id,e.status,e.revision,e.created_at,e.ended_at,
          CASE WHEN c.deleted=0 THEN c.name END AS name
          FROM organization_program_enrollments e
          JOIN organization_memberships m ON m.id=e.membership_id AND m.organization_id=e.organization_id
          JOIN contacts c ON c.cid=m.person_id
          WHERE e.organization_id=? AND e.program_id=? AND e.cohort_id=? ORDER BY e.created_at,e.id LIMIT ? OFFSET ?`,
        [organizationId, programId, cohortId, limit, offset])).rows;
      },
      async enrollment(organizationId, programId, cohortId, enrollmentId) {
        return (await query(`SELECT id,status,revision FROM organization_program_enrollments
          WHERE organization_id=? AND program_id=? AND cohort_id=? AND id=? FOR UPDATE`, [organizationId, programId, cohortId, enrollmentId])).rows[0] || null;
      },
      async enroll(organizationId, programId, cohortId, membershipId) {
        return (await query(`INSERT INTO organization_program_enrollments(organization_id,program_id,cohort_id,membership_id)
          VALUES (?,?,?,?) RETURNING id,revision`, [organizationId, programId, cohortId, membershipId])).rows[0];
      },
      async endEnrollment(organizationId, programId, cohortId, enrollmentId, status) {
        return (await query(`UPDATE organization_program_enrollments SET status=?,ended_at=clock_timestamp(),revision=revision+1
          WHERE organization_id=? AND program_id=? AND cohort_id=? AND id=? RETURNING id,revision`, [status, organizationId, programId, cohortId, enrollmentId])).rows[0];
      },
      async audit(organizationId, actorRole, action, entityId, before, after, entityType = "program") {
        await query(`INSERT INTO organization_audit_events
          (organization_id,actor_person_id,actor_role,action,entity_type,entity_id,before,after,request_id)
          VALUES (?,?,?,?,?,?,?::jsonb,?::jsonb,?)`, [organizationId, credentials.cid, actorRole, action, entityType, entityId,
        before ? JSON.stringify(before) : null, JSON.stringify(after), credentials.requestId]);
      },
    });
  });
}
