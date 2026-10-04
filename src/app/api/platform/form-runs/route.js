import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import {
  getSubmissionById,
  getRunById,
  getSubmissionReviewsBySubmissionId,
  getMySubmissionsBySubmitterId,
  getParticipantRunById,
  getParticipantSubmissionByRunAndSubmitter,
  getTimelineBySubmissionId,
  countActiveRuns,
  countTotalAssignments,
  countNonDraftSubmissions,
  countSubmittedSubmissions,
  countApprovedSubmissions,
  countOverdueSubmissions,
  getRecentActivityTimeline,
  getAssignableContactsList,
  getScoringSubmissionById,
  getRunContextForScoringById,
  getFormScoringConfigById,

  listSubmissionsForOpenRuns,

  getSubmissionsBySubmitterId,
  listFormRunsPage,
  getBulkReviewValidationsByIdsInRun,
} from "@/models/formRuns";

import {
  archiveRun,
  assignRunTargets,
  buildResultDocument,
  buildRunDetail,
  changeRunStatus,
  createRun,
  deleteSubmission,
  dispatchScheduledResultEmails,
  isValidRunStatus,
  launchRun,
  manualAddRespondent,
  markEmailsCancelled,
  processReviewInternal,
  regeneratePublicLink,
  regenerateRunReport,
  retryFailedEmails,
  sendActivationMessages,
  sendManualMessages,
  sendResultEmails,
  submitResponse,
  unassignRun,
  updateRespondentEmail,
  updateRunMetadata,
} from "@/services/platform/formRuns";

/**
 * PLATFORM FORM RUNS API — Run creation, submissions, reviews, timeline, assignments
 *
 * GET  /api/platform/form-runs                          — List all runs
 * GET  /api/platform/form-runs?id=X                     — Get run detail + submissions + assignments + reviews
 * GET  /api/platform/form-runs?submitter_id=X           — Get submissions for a user
 * GET  /api/platform/form-runs?timeline=X               — Get timeline for a submission
 * GET  /api/platform/form-runs?dashboard=true           — Get operational dashboard stats
 *
 * POST /api/platform/form-runs                          — Create run
 * POST /api/platform/form-runs?action=launch            — Launch (activate) a run
 * POST /api/platform/form-runs?action=status            — Change run status (close, cancel, archive, reactivate)
 * POST /api/platform/form-runs?action=submit            — Submit a response
 * POST /api/platform/form-runs?action=review            — Review a submission
 * POST /api/platform/form-runs?action=assign            — Add assignment
 * POST /api/platform/form-runs?action=unassign          — Remove assignment
 * POST /api/platform/form-runs?action=update_respondent_email
 *                                                        — Correct a respondent's email
 * POST /api/platform/form-runs?action=dispatch_scheduled_result_emails
 *                                                        — Send the result emails whose
 *                                                          scheduled time has passed (scheduler)
 *
 * PUT  /api/platform/form-runs                          — Update run metadata (including settings)
 * DELETE /api/platform/form-runs?id=X                    — Archive
 */

// Scoring lives in `@/services/platform/scoring` (see docs/LAYER_SPLIT.md).


export { GET, POST, PUT, DELETE } from "./route.handlers";
