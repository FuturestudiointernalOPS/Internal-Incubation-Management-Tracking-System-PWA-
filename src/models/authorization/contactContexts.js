/**
 * PHASE UI-4c — a person's CONTEXTUAL RELATIONSHIPS (read-only projection).
 *
 * The correction this phase delivers: a person has ONE baseline identity
 * (Super Admin / Staff / Member) and MANY additive contexts — a program they
 * are enrolled in, a venture they belong to, a course they are taking. The
 * Permission Center showed only the identity, so a participant read as
 * "member" and their program access appeared nowhere.
 *
 * This module answers "which contexts does this person hold, and what are they
 * inside each one?" — using the SAME authority the Scope Engine enforces from
 * (`resolveScopeIds`, the data-layer predicates in ./scope.js), never the
 * capability cache and never a client projection:
 *
 *   venture  → venture_own   : venture_members ∪ venture_staff_assignments
 *   program  → program_assigned : participant_programs ∪ v2_program_staff
 *   course   → learning_own  : lms_enrollments (suspended excluded)
 *
 * Fail-soft, per context: a failing lookup is reported as `unavailable` for
 * that kind instead of being presented as "no memberships". An empty list and
 * an unknown list are different answers and the UI must be able to tell them
 * apart.
 *
 * No HTTP imports; SQL lives here (MVC: models only).
 */

import db from "@/lib/db";
import { resolveScopeIds, SCOPE_POLICIES } from "./scope";

/** A pathological membership list must not blow up the payload or the query. */
const MAX_IDS = 60;

const ph = (n) => new Array(n).fill("?").join(",");

async function ventureLabels(ids) {
  const r = await db.execute({
    sql: `SELECT CAST(venture_id AS TEXT) AS id,
                 COALESCE(NULLIF(name, ''), company_name, CAST(venture_id AS TEXT)) AS label
          FROM ventures
          WHERE CAST(venture_id AS TEXT) IN (${ph(ids.length)})`,
    args: ids,
  });
  return Object.fromEntries(r.rows.map((row) => [String(row.id), row.label]));
}

async function programLabels(ids) {
  const r = await db.execute({
    sql: `SELECT CAST(id AS TEXT) AS id, name AS label
          FROM v2_programs
          WHERE CAST(id AS TEXT) IN (${ph(ids.length)})`,
    args: ids,
  });
  return Object.fromEntries(r.rows.map((row) => [String(row.id), row.label]));
}

async function courseLabels(ids) {
  const r = await db.execute({
    sql: `SELECT CAST(id AS TEXT) AS id, title AS label
          FROM lms_courses
          WHERE CAST(id AS TEXT) IN (${ph(ids.length)})`,
    args: ids,
  });
  return Object.fromEntries(r.rows.map((row) => [String(row.id), row.label]));
}

/**
 * What the person IS inside each venture. A membership row wins; a delegated
 * staff assignment answers only when no membership exists (founders and team
 * members are members, coaches/advisors are assignments).
 */
async function ventureRoles(cid, ids) {
  const roles = {};
  const m = await db.execute({
    sql: `SELECT CAST(venture_id AS TEXT) AS id, member_type, is_owner
          FROM venture_members
          WHERE (user_cid = ? OR contact_id = ?) AND removed_at IS NULL
            AND CAST(venture_id AS TEXT) IN (${ph(ids.length)})`,
    args: [cid, cid, ...ids],
  });
  for (const row of m.rows) {
    const key = String(row.id);
    const owner = row.is_owner === true || Number(row.is_owner) === 1;
    roles[key] = owner ? "founder" : row.member_type || "team_member";
  }
  const s = await db.execute({
    sql: `SELECT CAST(venture_id AS TEXT) AS id, role
          FROM venture_staff_assignments
          WHERE staff_contact_id = ? AND status = 'active'
            AND CAST(venture_id AS TEXT) IN (${ph(ids.length)})`,
    args: [cid, ...ids],
  });
  for (const row of s.rows) {
    const key = String(row.id);
    if (!roles[key]) roles[key] = row.role || "venture_staff";
  }
  return roles;
}

/** Participant (enrolled) or the program-staff role (assigned; email-tolerant). */
async function programRoles(cid, email, ids) {
  const roles = {};
  const p = await db.execute({
    sql: `SELECT CAST(program_id AS TEXT) AS id
          FROM participant_programs
          WHERE participant_id = ? AND CAST(program_id AS TEXT) IN (${ph(ids.length)})`,
    args: [cid, ...ids],
  });
  for (const row of p.rows) roles[String(row.id)] = "participant";
  const s = await db.execute({
    sql: `SELECT CAST(program_id AS TEXT) AS id, role
          FROM v2_program_staff
          WHERE (staff_id = ? OR LOWER(TRIM(staff_id)) = LOWER(?))
            AND CAST(program_id AS TEXT) IN (${ph(ids.length)})`,
    args: [cid, email || cid, ...ids],
  });
  for (const row of s.rows) roles[String(row.id)] = row.role || "program_staff";
  return roles;
}

const policyFacts = (policyKey) => ({
  scopePolicy: policyKey,
  scopeImplemented: Boolean(SCOPE_POLICIES[policyKey]?.implemented),
});

/**
 * Every context this person holds, newest information first-class.
 *
 * @returns {Promise<{contexts: Array, unavailable: string[]}>}
 *   contexts: [{ type, id, label, role, scopePolicy, scopeImplemented }]
 *   unavailable: context kinds whose lookup failed (never silently "none")
 */
export async function getContactContexts(cid, { email = null } = {}) {
  if (!cid) return { contexts: [], unavailable: [] };

  const [ventureIds, programIds, courseIds] = await Promise.all([
    resolveScopeIds("venture_own", cid, { email }),
    resolveScopeIds("program_assigned", cid, { email }),
    resolveScopeIds("learning_own", cid, { email }),
  ]);

  const unavailable = [];
  if (ventureIds === null) unavailable.push("venture");
  if (programIds === null) unavailable.push("program");
  if (courseIds === null) unavailable.push("course");

  const contexts = [];
  const take = (ids) => (Array.isArray(ids) ? ids.slice(0, MAX_IDS) : []);

  const ventures = take(ventureIds);
  if (ventures.length) {
    const [labels, roles] = await Promise.all([
      ventureLabels(ventures),
      ventureRoles(cid, ventures),
    ]);
    for (const id of ventures) {
      contexts.push({
        type: "venture",
        id,
        label: labels[id] || id,
        role: roles[id] || "member",
        ...policyFacts("venture_own"),
      });
    }
  }

  const programs = take(programIds);
  if (programs.length) {
    const [labels, roles] = await Promise.all([
      programLabels(programs),
      programRoles(cid, email, programs),
    ]);
    for (const id of programs) {
      contexts.push({
        type: "program",
        id,
        label: labels[id] || id,
        role: roles[id] || "participant",
        ...policyFacts("program_assigned"),
      });
    }
  }

  const courses = take(courseIds);
  if (courses.length) {
    const labels = await courseLabels(courses);
    for (const id of courses) {
      contexts.push({
        type: "course",
        id,
        label: labels[id] || id,
        role: "learner",
        ...policyFacts("learning_own"),
      });
    }
  }

  return { contexts, unavailable };
}
