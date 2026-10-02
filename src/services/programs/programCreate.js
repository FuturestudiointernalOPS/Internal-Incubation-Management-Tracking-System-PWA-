/**
 * Programs — creating a program and everything that hangs off it (SERVICE layer).
 *
 * The domain work behind `POST /api/pm/programs`: the slug, the duplicate-name
 * rule, the date rules, the system Facilitators group, the segment assignment,
 * the default objectives and the audit/notification trail. The CONTROLLER keeps
 * authentication, the `programs.create` capability and the response envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It writes through `@/models/**` and returns a plain `{ status, body }`.
 */

import { v4 as uuidv4 } from "uuid";
import { logAuditEvent } from "@/services/tasks/auditLog";
import {
  addProgramExpectedOutcomesColumn,
  addProgramSlugColumn,
  addProgramSuccessMetricsColumn,
  assignSegmentById,
  assignSegmentByName,
  createProgram,
  createProgramKpi,
  createSystemFacilitatorsGroup,
  findProgramByExactName,
} from "@/models/programs";

/** The objectives a program starts with when none are supplied. */
const DEFAULT_KPIS = [
  { title: "Attendance Rate", target_value: 80 },
  { title: "Assignment Completion", target_value: 80 },
  { title: "Session Participation", target_value: 80 },
  { title: "Team Engagement", target_value: 80 },
  { title: "Coaching Completion", target_value: 80 },
  { title: "Graduation Rate", target_value: 80 },
];

/** The slug a new program is registered under: name + a short id suffix. */
function buildProgramSlug(name, id) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 100) +
    "-" +
    id.substring(0, 8)
  );
}

/**
 * Create a program and everything that hangs off it: the system Facilitators
 * group, the assigned segments (and their participant membership), the default
 * objectives, and the audit/notification trail.
 *
 * @returns {Promise<{status: number, body: Object}>}
 */
export async function createProgramRecord({ payload, actor }) {
  const {
    name,
    description,
    concept_note,
    vision,
    objectives,
    program_type,
    visibility,
    language,
    note_id,
    assigned_pm_id,
    assigned_assistant_id,
    duration_weeks,
    materials,
    start_date,
    end_date,
    assigned_segments,
    kpis,
    expected_outcomes,
    success_metrics,
  } = payload;

  const id = uuidv4();
  const slug = buildProgramSlug(name, id);

  // Ensure new columns exist.
  try { await addProgramSlugColumn(); } catch (_) {}
  try { await addProgramExpectedOutcomesColumn(); } catch (_) {}
  try { await addProgramSuccessMetricsColumn(); } catch (_) {}

  // B6: Check duplicate program name.
  const existing = await findProgramByExactName(name);
  if (existing.rows.length > 0) {
    return {
      status: 409,
      body: { success: false, error: "A program with this name already exists." },
    };
  }

  // Prevent start date in the past.
  if (start_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(start_date) < today) {
      return {
        status: 400,
        body: { success: false, error: "Start date cannot be in the past." },
      };
    }
  }

  // Prevent end date before start date.
  if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
    return {
      status: 400,
      body: { success: false, error: "End date cannot be earlier than start date." },
    };
  }

  await createProgram({
    id,
    name,
    slug,
    description,
    concept_note,
    vision,
    objectives,
    expected_outcomes,
    success_metrics,
    program_type,
    visibility,
    language,
    note_id,
    assigned_pm_id,
    assigned_assistant_id,
    duration_weeks,
    materials,
    start_date,
    end_date,
  });

  // Auto-create the system-defined Facilitators group for this program.
  try {
    await createSystemFacilitatorsGroup(id);
  } catch (_) {}

  // Handle Segment/Team Assignments for new program.
  if (Array.isArray(assigned_segments) && assigned_segments.length > 0) {
    for (const segmentId of assigned_segments) {
      if (!segmentId) continue;
      const numericSegmentId = !isNaN(segmentId) ? Number(segmentId) : null;
      if (numericSegmentId !== null) {
        await assignSegmentById(id, numericSegmentId);
      } else {
        await assignSegmentByName(id, segmentId);
      }
    }
  }

  // Handle KPIs — auto-populate defaults if none provided.
  const kpisToCreate = Array.isArray(kpis) && kpis.length > 0 ? kpis : DEFAULT_KPIS;
  for (const kpi of kpisToCreate) {
    if (!kpi.title) continue;
    await createProgramKpi(id, kpi.title, kpi.target_value);
  }

  // B10: Audit log.
  await logAuditEvent({
    entity_type: "program",
    entity_id: id,
    user_id: actor?.user_cid || "system",
    user_name: actor?.name || "System",
    action: "created",
    details: `Program "${name}" created`,
  });

  // B11: Notification PM assignment.
  if (assigned_pm_id) {
    await logAuditEvent({
      entity_type: "program_assignment",
      entity_id: id,
      user_id: assigned_pm_id,
      user_name: name,
      action: "assigned",
      details: `You have been assigned as Program Manager for "${name}"`,
    });
  }

  return { status: 200, body: { success: true, id } };
}
