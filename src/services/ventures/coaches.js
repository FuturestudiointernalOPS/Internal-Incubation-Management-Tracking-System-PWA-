/**
 * VENTURE COACH & MENTOR MANAGEMENT (the catalog and its assignments).
 *
 * The coach catalog (list / read / create / update / delete) and the per-Venture
 * assignment layer (list, assign with the active/primary/duplicate rules, and the
 * scoped removal with its activity log).
 *
 * The decisions — the JSON wrapping of the multi-value columns, the assignability
 * rules, the primary replacement, the removal scope — live here; every statement
 * is in `@/models/ventureCoachesStore`. Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) — see
 * docs/LAYER_SPLIT.md. (Distinct from `@/services/ventures/coach`, which backs the
 * coach IDENTITY and INVITATION layer.)
 */

import {
  selectCoaches,
  selectCoachById,
  insertCoach,
  updateCoachColumns,
  deleteCoachRow,
  selectVentureAssignments,
  selectActiveCoachAssignment,
  clearPrimaryCoachAssignments,
  insertCoachAssignment,
  insertCoachActivity,
  markAssignmentRemoved,
  selectScopedAssignment,
  insertCoachRemovedActivity,
} from "@/models/ventureCoachesStore";

/**
 * List all coaches (optionally filtered by type).
 */
export async function listCoaches(coachType) {
  const res = await selectCoaches(coachType);
  return (res.rows || []).map((coach) => ({
    ...coach,
    areas_of_expertise: typeof coach.areas_of_expertise === "string" ? JSON.parse(coach.areas_of_expertise) : (coach.areas_of_expertise || []),
    industries: typeof coach.industries === "string" ? JSON.parse(coach.industries) : (coach.industries || []),
    languages: typeof coach.languages === "string" ? JSON.parse(coach.languages) : (coach.languages || []),
  }));
}

export async function getCoach(coachId) {
  const res = await selectCoachById(coachId);
  if (res.rows.length === 0) return null;
  const coach = res.rows[0];
  coach.areas_of_expertise = typeof coach.areas_of_expertise === "string" ? JSON.parse(coach.areas_of_expertise) : (coach.areas_of_expertise || []);
  coach.industries = typeof coach.industries === "string" ? JSON.parse(coach.industries) : (coach.industries || []);
  coach.languages = typeof coach.languages === "string" ? JSON.parse(coach.languages) : (coach.languages || []);
  return coach;
}

export async function createCoach({ coachType, fullName, email, phone, organization, biography, yearsExperience, areasOfExpertise, industries, languages, timezone, linkedinUrl, websiteUrl, createdBy }) {
  const res = await insertCoach({
    coachType: coachType || "coach",
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    phone: phone||null,
    organization: organization||null,
    biography: biography||null,
    yearsExperience: yearsExperience||null,
    areasOfExpertiseJson: JSON.stringify(areasOfExpertise||[]),
    industriesJson: JSON.stringify(industries||[]),
    languagesJson: JSON.stringify(languages||[]),
    timezone: timezone||"UTC",
    linkedinUrl: linkedinUrl||null,
    websiteUrl: websiteUrl||null,
    createdBy: createdBy||"system",
  });
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function updateCoach(coachId, updates) {
  const allowed = ["full_name", "photo_url", "email", "phone", "organization", "biography", "years_experience", "availability", "timezone", "linkedin_url", "website_url", "status", "coach_type"];
  const sets = []; const args = [];
  for (const column of allowed) {
    if (updates[column] !== undefined) {
      if (column === "areas_of_expertise" || column === "industries" || column === "languages") {
        sets.push(`${column} = ?::jsonb`); args.push(JSON.stringify(updates[column]));
      } else { sets.push(`${column} = ?`); args.push(updates[column]); }
    }
  }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at = NOW()");
  args.push(coachId);
  await updateCoachColumns(sets, args);
  return { updated: true };
}

export async function deleteCoach(coachId) {
  await deleteCoachRow(coachId);
  return { success: true };
}

// ─── Assignments ───────────────────────────────────────────────────────────

export async function getVentureAssignments(ventureId) {
  const res = await selectVentureAssignments(ventureId);
  return (res.rows || []).map((assignment) => ({
    ...assignment,
    areas_of_expertise: typeof assignment.areas_of_expertise === "string" ? JSON.parse(assignment.areas_of_expertise) : (assignment.areas_of_expertise || []),
    industries: typeof assignment.industries === "string" ? JSON.parse(assignment.industries) : (assignment.industries || []),
  }));
}

export async function assignCoachToVenture({ ventureId, coachId, coachType, isPrimary, assignedBy, notes }) {
  const coach = await getCoach(coachId);
  if (!coach) throw new Error("Coach not found.");
  if (coach.status !== "active") throw new Error("Cannot assign an inactive coach.");
  if (coach.availability === "inactive") throw new Error("Coach is marked as inactive.");

  // Check for duplicate
  const existing = await selectActiveCoachAssignment(ventureId, coachId);
  if (existing.rows.length > 0) throw new Error("Coach is already assigned to this venture.");

  // If setting as primary, unset any existing primary
  if (isPrimary) {
    await clearPrimaryCoachAssignments(ventureId, coachType);
  }

  const res = await insertCoachAssignment(ventureId, coachId, coachType || coach.coach_type, isPrimary ? 1 : 0, assignedBy || "system", notes || null);

  // Log activity
  await insertCoachActivity(
    coachId,
    ventureId,
    coachType === "advisor" ? "ADVISOR_ASSIGNED" : "COACH_ASSIGNED",
    assignedBy || "system",
    JSON.stringify({ venture_id: ventureId, coach_name: coach.full_name }),
  );

  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function removeAssignment(assignmentId, removedBy, ventureIds = []) {
  const ids = (Array.isArray(ventureIds) ? ventureIds : [ventureIds]).filter(
    (ventureId) => ventureId !== null && ventureId !== undefined,
  );
  if (ids.length === 0) return { success: false };
  const scope = ids.map(() => "venture_id = ?").join(" OR ");
  // Only an assignment OF THIS VENTURE may be removed; the log row is written
  // from the same scoped read so it can never describe another venture.
  await markAssignmentRemoved(scope, assignmentId, ids);

  // Log
  try {
    const aRes = await selectScopedAssignment(scope, assignmentId, ids);
    if (aRes.rows.length > 0) {
      await insertCoachRemovedActivity(
        aRes.rows[0].coach_id,
        aRes.rows[0].venture_id,
        removedBy || "system",
        JSON.stringify({ assignment_id: assignmentId }),
      );
    }
  } catch (_) {}

  return { success: true };
}
