import db from "@/lib/db";

/** Weekly reports — `attachment_type` column (URL link or PDF upload). */
export async function addWeeklyReportAttachmentTypeColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS attachment_type TEXT",
    args: [],
  });
}

/** Weekly reports — `attachment_url` column (URL link or PDF upload). */
export async function addWeeklyReportAttachmentUrlColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS attachment_url TEXT",
    args: [],
  });
}

/** Weekly reports — `week_status` column (weekly overview). */
export async function addWeeklyReportWeekStatusColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS week_status VARCHAR(50) DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `week_rating` column (weekly overview). */
export async function addWeeklyReportWeekRatingColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS week_rating VARCHAR(50) DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `main_topic` column (weekly overview). */
export async function addWeeklyReportMainTopicColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS main_topic TEXT DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `assignment_given` column (KPI-linked assignment). */
export async function addWeeklyReportAssignmentGivenColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS assignment_given BOOLEAN DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `assignment_kpi_ids` column (linked KPI ids, JSON text). */
export async function addWeeklyReportAssignmentKpiIdsColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS assignment_kpi_ids TEXT DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `assignment_objective` column (KPI-linked assignment). */
export async function addWeeklyReportAssignmentObjectiveColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS assignment_objective TEXT DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `assignment_outcome` column (KPI-linked assignment). */
export async function addWeeklyReportAssignmentOutcomeColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS assignment_outcome TEXT DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `attendance_level` column (participation). */
export async function addWeeklyReportAttendanceLevelColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS attendance_level VARCHAR(50) DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `participation_level` column (participation). */
export async function addWeeklyReportParticipationLevelColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS participation_level VARCHAR(50) DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `participants_need_attention` column (participation). */
export async function addWeeklyReportParticipantsNeedAttentionColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS participants_need_attention BOOLEAN DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `participants_attention_notes` column (participation). */
export async function addWeeklyReportParticipantsAttentionNotesColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS participants_attention_notes TEXT DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `standout_participants` column (participation). */
export async function addWeeklyReportStandoutParticipantsColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS standout_participants BOOLEAN DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `standout_notes` column (participation). */
export async function addWeeklyReportStandoutNotesColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS standout_notes TEXT DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `delivery_quality` column (delivery feedback). */
export async function addWeeklyReportDeliveryQualityColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS delivery_quality VARCHAR(50) DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `participant_understanding` column (delivery feedback). */
export async function addWeeklyReportParticipantUnderstandingColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS participant_understanding VARCHAR(50) DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `delivery_challenges` column (delivery feedback). */
export async function addWeeklyReportDeliveryChallengesColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS delivery_challenges BOOLEAN DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `delivery_challenge_note` column (delivery feedback). */
export async function addWeeklyReportDeliveryChallengeNoteColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS delivery_challenge_note TEXT DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `had_issues` column (issues & support). */
export async function addWeeklyReportHadIssuesColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS had_issues BOOLEAN DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `issue_types` column (issues & support, TEXT[]). */
export async function addWeeklyReportIssueTypesColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS issue_types TEXT[] DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `requires_admin_attention` column (issues & support). */
export async function addWeeklyReportRequiresAdminAttentionColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS requires_admin_attention BOOLEAN DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `additional_issue_note` column (issues & support). */
export async function addWeeklyReportAdditionalIssueNoteColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS additional_issue_note TEXT DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `program_on_track` column (next week). */
export async function addWeeklyReportProgramOnTrackColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS program_on_track BOOLEAN DEFAULT NULL",
    args: [],
  });
}

/** Weekly reports — `planned_adjustments` column (next week). */
export async function addWeeklyReportPlannedAdjustmentsColumn() {
  return db.execute({
    sql: "ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS planned_adjustments TEXT DEFAULT NULL",
    args: [],
  });
}

/**
 * Weekly reports — unique key behind `ON CONFLICT (program_id, week_number,
 * teacher_id)`. The base schema declares it inline; environments created
 * before that declaration need the index for the report upsert to work.
 */
export async function ensureWeeklyReportConflictKeyIndex() {
  return db.execute({
    sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_weekly_reports_week_key ON v2_weekly_reports (program_id, week_number, teacher_id)",
    args: [],
  });
}

/**
 * Ensure the structured weekly-report columns written by `upsertWeeklyReport`
 * exist. Production drifted: the INSERT targets 31 columns while only the
 * attachment pair was self-healed, so saving a PM report failed with 42601
 * ("INSERT has more expressions than target columns"). Idempotent and
 * additive — each statement keeps its own try/catch so one failure cannot
 * block the save.
 */
export async function ensureWeeklyReportSchema() {
  const statements = [
    addWeeklyReportWeekStatusColumn,
    addWeeklyReportWeekRatingColumn,
    addWeeklyReportMainTopicColumn,
    addWeeklyReportAssignmentGivenColumn,
    addWeeklyReportAssignmentKpiIdsColumn,
    addWeeklyReportAssignmentObjectiveColumn,
    addWeeklyReportAssignmentOutcomeColumn,
    addWeeklyReportAttendanceLevelColumn,
    addWeeklyReportParticipationLevelColumn,
    addWeeklyReportParticipantsNeedAttentionColumn,
    addWeeklyReportParticipantsAttentionNotesColumn,
    addWeeklyReportStandoutParticipantsColumn,
    addWeeklyReportStandoutNotesColumn,
    addWeeklyReportDeliveryQualityColumn,
    addWeeklyReportParticipantUnderstandingColumn,
    addWeeklyReportDeliveryChallengesColumn,
    addWeeklyReportDeliveryChallengeNoteColumn,
    addWeeklyReportHadIssuesColumn,
    addWeeklyReportIssueTypesColumn,
    addWeeklyReportRequiresAdminAttentionColumn,
    addWeeklyReportAdditionalIssueNoteColumn,
    addWeeklyReportProgramOnTrackColumn,
    addWeeklyReportPlannedAdjustmentsColumn,
    ensureWeeklyReportConflictKeyIndex,
  ];
  for (const statement of statements) {
    try {
      await statement();
    } catch (_) {}
  }
}
