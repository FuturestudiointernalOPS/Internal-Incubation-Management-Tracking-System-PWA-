/**
 * LEGACY IDENTITY NORMALIZATION (MODEL layer).
 *
 * One-time, transactional data migration: give the contextual profile card to
 * every ACTIVE relationship, then normalize the identity to `member`.
 *
 * Why both in one transaction: the profile ↔ role gate allows `participant` /
 * `founder` only for the member identity and `facilitator` for staff or member.
 * A card cannot be granted while the label is present; a role change without the
 * card would drop the person from the participant default profile to the member
 * default (`venture_member`) in the same instant. Either both writes land, or
 * neither does.
 *
 * A legacy label with NO active relationship receives no card: there is no
 * function to carry (a programme that ended, a venture that was left), and the
 * label gave no base rights. A future relationship grants the profile again
 * through the normal reconcile.
 *
 * OPTIONAL SCHEMAS. This migration must run on EVERY production database, and
 * those databases do not all have every module's tables (measured: one has no
 * `investor_profiles`). A hard reference would make the whole transaction
 * fail — and because the marker is only written on success, the migration
 * would retry forever and never normalize anybody. Each family is therefore
 * probed first (`to_regclass`) and skipped when its table is absent; the label
 * still becomes `member`, so the identity correction is never blocked by a
 * missing optional module.
 *
 * Idempotent: cards already present are not duplicated, and the role update only
 * touches the three legacy values. The migration is recorded by the caller
 * (`runAuthzMigration`), so it runs once per database.
 */

import db from "@/lib/db";

export const LEGACY_IDENTITY_ROLES = [
  "participant",
  "facilitator",
  "investor",
  "founder",
];

/** The current population, by label. Read-only, used by diagnostics. */
export function countLegacyIdentities() {
  return db.execute({
    sql: `SELECT role, COUNT(*)::int AS people
          FROM contacts
          WHERE role IN ('participant', 'facilitator', 'investor', 'founder')
          GROUP BY role
          ORDER BY role`,
    args: [],
  });
}

/** True when a relation exists in the current database. */
async function tableExists(query, name) {
  const result = await query("SELECT to_regclass(?) AS name", [name]);
  return Boolean(result?.rows?.[0]?.name);
}

/**
 * Apply the normalization. Returns what happened; throws (rolling back) when a
 * post-condition fails.
 *
 * @returns {Promise<{before: Array, cards: number, updated: number,
 *                    withoutRelationship: number, skippedFamilies: string[]}>}
 */
export async function migrateLegacyIdentities() {
  return db.transaction(async (query) => {
    // ── Which optional families can this schema carry? ───────────────────────
    const hasParticipant = await tableExists(query, "public.participant_programs");
    const hasFacilitator =
      (await tableExists(query, "public.v2_program_staff")) &&
      (await tableExists(query, "public.v2_programs"));
    const hasFounder = await tableExists(query, "public.venture_members");
    const hasInvestor = await tableExists(query, "public.investor_profiles");

    const skippedFamilies = [
      !hasParticipant && "participant",
      !hasFacilitator && "facilitator",
      !hasFounder && "founder",
      !hasInvestor && "investor",
    ].filter(Boolean);

    const participantCte = hasParticipant
      ? `participant_rel AS (
           SELECT DISTINCT c.cid
           FROM contacts c
           JOIN participant_programs pp ON pp.participant_id = c.cid
           WHERE c.role = 'participant'
             AND pp.program_id IS NOT NULL
         )`
      : null;

    const facilitatorCte = hasFacilitator
      ? `facilitator_rel AS (
           SELECT DISTINCT c.cid
           FROM contacts c
           JOIN v2_program_staff ps
             ON (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(c.email))
           JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
           WHERE c.role = 'facilitator'
             AND LOWER(COALESCE(ps.role, '')) = 'facilitator'
             AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
         )`
      : null;

    const founderCte = hasFounder
      ? `founder_rel AS (
           SELECT DISTINCT c.cid
           FROM contacts c
           JOIN venture_members vm
             ON (vm.contact_id = c.cid OR vm.user_cid = c.cid)
           WHERE c.role = 'founder'
             AND vm.removed_at IS NULL
             AND (vm.member_type = 'founder' OR vm.role IN ('founder', 'co-founder'))
         )`
      : null;

    const investorCte = hasInvestor
      ? `investor_rel AS (
           SELECT DISTINCT c.cid
           FROM contacts c
           JOIN investor_profiles ip
             ON ip.user_id = c.cid AND ip.approval_status = 'approved'
           WHERE c.role = 'investor'
         )`
      : null;

    const ctes = [participantCte, facilitatorCte, founderCte, investorCte].filter(Boolean);
    const withClause = ctes.length > 0 ? `WITH ${ctes.join(",\n")}` : "";
    const hasRelationship = (family) =>
      family
        ? `EXISTS (SELECT 1 FROM ${family}_rel r WHERE r.cid = c.cid)`
        : "FALSE";

    // ── Targets and their ACTIVE relationships (same rules as the reconcile) ──
    await query(
      `CREATE TEMP TABLE legacy_migration_relationships ON COMMIT DROP AS
       ${withClause}
       SELECT
         c.cid,
         c.role AS source_role,
         CASE c.role
           WHEN 'participant' THEN 'participant'
           WHEN 'facilitator' THEN 'facilitator'
           WHEN 'investor'    THEN 'investor'
           WHEN 'founder'     THEN 'founder'
         END AS profile_key,
         CASE c.role
           WHEN 'participant' THEN ${hasRelationship(hasParticipant ? "participant" : null)}
           WHEN 'facilitator' THEN ${hasRelationship(hasFacilitator ? "facilitator" : null)}
           WHEN 'investor'    THEN ${hasRelationship(hasInvestor ? "investor" : null)}
           WHEN 'founder'     THEN ${hasRelationship(hasFounder ? "founder" : null)}
           ELSE FALSE
         END AS has_relationship
       FROM contacts c
       WHERE c.role IN ('participant', 'facilitator', 'investor', 'founder')`,
    );

    const before = await query(
      `SELECT source_role, has_relationship, COUNT(*)::int AS people
       FROM legacy_migration_relationships
       GROUP BY source_role, has_relationship
       ORDER BY source_role, has_relationship DESC`,
    );

    // ── Cards, one per active relationship ───────────────────────────────────
    const participantCards = hasParticipant
      ? await query(
          `INSERT INTO profile_assignments
             (contact_cid, profile_key, context_type, context_id, started_at, ends_at,
              status, source, source_ref, notes, created_by)
           SELECT DISTINCT
             c.cid, 'participant', 'program', CAST(pp.program_id AS TEXT),
             NOW(), NULL, 'active', 'automatic', CAST(pp.program_id AS TEXT),
             'legacy-identity-migration', NULL
           FROM contacts c
           JOIN participant_programs pp ON pp.participant_id = c.cid
           WHERE c.role = 'participant'
             AND pp.program_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM profile_assignments pa
               WHERE pa.contact_cid = c.cid
                 AND pa.profile_key = 'participant'
                 AND pa.context_type = 'program'
                 AND pa.context_id = CAST(pp.program_id AS TEXT)
                 AND pa.status = 'active'
             )`,
        )
      : { rows: [], rowsAffected: 0 };

    const facilitatorCards = hasFacilitator
      ? await query(
          `WITH facilitator_assignments AS (
             SELECT
               c.cid,
               CAST(ps.program_id AS TEXT) AS program_id,
               MAX(p.end_date) OVER (PARTITION BY c.cid) AS ends_at
             FROM contacts c
             JOIN v2_program_staff ps
               ON (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(c.email))
             JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
             WHERE c.role = 'facilitator'
               AND LOWER(COALESCE(ps.role, '')) = 'facilitator'
               AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
           )
           INSERT INTO profile_assignments
             (contact_cid, profile_key, context_type, context_id, started_at, ends_at,
              status, source, source_ref, notes, created_by)
           SELECT DISTINCT
             fa.cid, 'facilitator', 'program', fa.program_id,
             NOW(), fa.ends_at, 'active', 'automatic', fa.program_id,
             'legacy-identity-migration', NULL
           FROM facilitator_assignments fa
           WHERE fa.program_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM profile_assignments pa
               WHERE pa.contact_cid = fa.cid
                 AND pa.profile_key = 'facilitator'
                 AND pa.context_type = 'program'
                 AND pa.context_id = fa.program_id
                 AND pa.status = 'active'
             )`,
        )
      : { rows: [], rowsAffected: 0 };

    const founderCards = hasFounder
      ? await query(
          `INSERT INTO profile_assignments
             (contact_cid, profile_key, context_type, context_id, started_at, ends_at,
              status, source, source_ref, notes, created_by)
           SELECT DISTINCT
             c.cid, 'founder', 'venture', CAST(vm.venture_id AS TEXT),
             NOW(), NULL, 'active', 'automatic', CAST(vm.venture_id AS TEXT),
             'legacy-identity-migration', NULL
           FROM contacts c
           JOIN venture_members vm
             ON (vm.contact_id = c.cid OR vm.user_cid = c.cid)
           WHERE c.role = 'founder'
             AND vm.removed_at IS NULL
             AND (vm.member_type = 'founder' OR vm.role IN ('founder', 'co-founder'))
             AND NOT EXISTS (
               SELECT 1 FROM profile_assignments pa
               WHERE pa.contact_cid = c.cid
                 AND pa.profile_key = 'founder'
                 AND pa.context_type = 'venture'
                 AND pa.context_id = CAST(vm.venture_id AS TEXT)
                 AND pa.status = 'active'
             )`,
        )
      : { rows: [], rowsAffected: 0 };

    // ── Investors: one card per approved investor context ────────────────────
    const investorCards = hasInvestor
      ? await query(
          `INSERT INTO profile_assignments
             (contact_cid, profile_key, context_type, context_id, started_at, ends_at,
              status, source, source_ref, notes, created_by)
           SELECT DISTINCT
             c.cid, 'investor', 'investor', CAST(ip.id AS TEXT),
             NOW(), NULL, 'active', 'automatic', CAST(ip.id AS TEXT),
             'legacy-identity-migration', NULL
           FROM contacts c
           JOIN investor_profiles ip
             ON ip.user_id = c.cid AND ip.approval_status = 'approved'
           WHERE c.role = 'investor'
             AND NOT EXISTS (
               SELECT 1 FROM profile_assignments pa
               WHERE pa.contact_cid = c.cid
                 AND pa.profile_key = 'investor'
                 AND pa.context_type = 'investor'
                 AND pa.context_id = CAST(ip.id AS TEXT)
                 AND pa.status = 'active'
             )`,
        )
      : { rows: [], rowsAffected: 0 };

    // ── The identity change, AFTER the cards ────────────────────────────────
    const updated = await query(
      `UPDATE contacts
       SET role = 'member'
       WHERE role IN ('participant', 'facilitator', 'investor', 'founder')`,
    );

    // ── Post-conditions: any failure throws, and the transaction rolls back ──
    const legacyLeft = await query(
      `SELECT COUNT(*)::int AS n FROM contacts WHERE role IN ('participant', 'facilitator', 'investor', 'founder')`,
    );
    if (Number(legacyLeft.rows[0]?.n || 0) > 0) {
      throw new Error(
        `legacy identity migration: ${legacyLeft.rows[0].n} label(s) still present`,
      );
    }

    const missingCard = await query(
      `SELECT COUNT(*)::int AS n
       FROM legacy_migration_relationships t
       WHERE t.has_relationship
         AND NOT EXISTS (
           SELECT 1 FROM profile_assignments pa
           WHERE pa.contact_cid = t.cid
             AND pa.profile_key = t.profile_key
             AND pa.status = 'active'
             AND (pa.started_at IS NULL OR pa.started_at <= NOW())
             AND (pa.ends_at IS NULL OR pa.ends_at > NOW())
         )`,
    );
    if (Number(missingCard.rows[0]?.n || 0) > 0) {
      throw new Error(
        `legacy identity migration: ${missingCard.rows[0].n} active relationship(s) without a card`,
      );
    }

    const withoutRelationship = await query(
      `SELECT COUNT(*)::int AS n
       FROM legacy_migration_relationships
       WHERE NOT has_relationship`,
    );

    return {
      before: before.rows,
      participantCards: participantCards.rowsAffected || 0,
      facilitatorCards: facilitatorCards.rowsAffected || 0,
      investorCards: investorCards.rowsAffected || 0,
      founderCards: founderCards.rowsAffected || 0,
      cards:
        (participantCards.rowsAffected || 0) +
        (facilitatorCards.rowsAffected || 0) +
        (investorCards.rowsAffected || 0) +
        (founderCards.rowsAffected || 0),
      updated: updated.rowsAffected || 0,
      withoutRelationship: Number(withoutRelationship.rows[0]?.n || 0),
      skippedFamilies,
    };
  });
}
