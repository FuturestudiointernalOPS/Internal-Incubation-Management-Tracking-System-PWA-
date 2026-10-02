import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  getProgramConfig,
  getSubmissionEvaluationDetail,
  saveSubmissionEvaluation,
  configureProgramEvaluation,
} from "@/services/platform/programEvaluation";

/**
 * EVALUATION API — TRACK 3 CONFIGURABLE EVALUATION
 *
 * Supports two evaluation models:
 * - Academic: numeric scores (0-100)
 * - Incubation: multi-dimensional startup readiness assessment
 *
 * Evaluation configuration is stored at the Program level
 * in v2_programs.evaluation_config as JSON.
 *
 * See services/platform/programEvaluation.js for the grading-mode-aware
 * validation.
 */

export const GET = createHandler(
  { roles: ["staff", "super_admin", "program_manager"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const submissionId = searchParams.get("submission_id");

    if (programId) {
      const result = await getProgramConfig(programId);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode });
      return NextResponse.json({ success: true, grading_mode: result.grading_mode, evaluation_config: result.evaluation_config });
    }

    if (submissionId) {
      const result = await getSubmissionEvaluationDetail(submissionId);
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode });
      return NextResponse.json({ success: true, evaluation: result.evaluation });
    }

    return NextResponse.json(
      { success: false, error: "program_id or submission_id required" },
      { status: 400 },
    );
  },
);

export const PUT = createHandler(
  { roles: ["staff", "super_admin", "program_manager"] },
  async (req) => {
    const { program_id, submission_id, score, evaluation_data } = await req.json();
    const result = await saveSubmissionEvaluation({ program_id, submission_id, score, evaluation_data });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode });
    return NextResponse.json({ success: true });
  },
);

/**
 * POST handler for configuring evaluation model on a program.
 */
export const POST = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    const { program_id, grading_mode, evaluation_config } = await req.json();
    const result = await configureProgramEvaluation({ program_id, grading_mode, evaluation_config });
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode });
    return NextResponse.json({ success: true });
  },
);
