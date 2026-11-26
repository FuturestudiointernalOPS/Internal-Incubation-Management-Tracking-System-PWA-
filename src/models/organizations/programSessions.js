const FIELDS = `s.id,s.title,s.description,s.week_number,s.start_at,s.status,l.duration_minutes,l.revision`;
const SCOPE = `l.organization_id=? AND l.program_id=? AND l.cohort_id=?`;
export function createOrganizationSessionReader(query) {
  return {
    async sessions(org, program, cohort, limit, offset) {
      return (await query(`SELECT ${FIELDS} FROM organization_program_session_links l
        JOIN v2_sessions s ON s.id=l.id AND s.program_id=l.program_id WHERE ${SCOPE}
        ORDER BY s.week_number,s.start_at NULLS LAST,s.id LIMIT ? OFFSET ?`, [org, program, cohort, limit, offset])).rows;
    },
    async session(org, program, cohort, id) {
      return (await query(`SELECT ${FIELDS} FROM organization_program_session_links l
        JOIN v2_sessions s ON s.id=l.id AND s.program_id=l.program_id WHERE ${SCOPE} AND l.id=? FOR UPDATE OF s,l`, [org, program, cohort, id])).rows[0] || null;
    },
    async createSession(org, program, cohort, id, fields) {
      await query(`INSERT INTO v2_sessions(id,program_id,title,description,week_number,type,start_at,status,timezone)
        VALUES (?,?,?,?,?,'session',?,'planned','UTC')`, [id, program, fields.title, fields.description, fields.week_number, fields.start_at]);
      return (await query(`INSERT INTO organization_program_session_links(id,organization_id,program_id,cohort_id,duration_minutes)
        VALUES (?,?,?,?,?) RETURNING id,revision`, [id, org, program, cohort, fields.duration_minutes])).rows[0];
    },
    async updateSession(org, program, cohort, id, fields) {
      const updated = (await query(`UPDATE organization_program_session_links SET duration_minutes=?,revision=revision+1
        WHERE ${SCOPE.replaceAll('l.', '')} AND id=? RETURNING id,revision`, [fields.duration_minutes, org, program, cohort, id])).rows[0];
      await query(`UPDATE v2_sessions s SET title=?,description=?,week_number=?,start_at=?,status=?
        WHERE s.id=? AND s.program_id=? AND EXISTS (SELECT 1 FROM organization_program_session_links l
          WHERE l.id=s.id AND l.program_id=s.program_id AND l.organization_id=? AND l.cohort_id=?)`,
      [fields.title, fields.description, fields.week_number, fields.start_at, fields.status, id, program, org, cohort]);
      return updated;
    },
    async openSessionCount(org, program, cohort) {
      return Number((await query(`SELECT count(*) AS count FROM organization_program_session_links l
        JOIN v2_sessions s ON s.id=l.id AND s.program_id=l.program_id WHERE ${SCOPE}
        AND lower(COALESCE(s.status,'')) NOT IN ('completed','archived')`, [org, program, cohort])).rows[0].count);
    },
  };
}
