import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

/**
 * EVALUATION API — TRACK 3 CONFIGURABLE EVALUATION
 *
 * Supports two evaluation models:
 * - Academic: numeric scores (0-100)
 * - Incubation: multi-dimensional startup readiness assessment
 *
 * Evaluation configuration is stored at the Program level
 * in v2_programs.evaluation_config as JSON.
 */

export const GET = createHandler(
  { roles: ["staff", "super_admin", "teacher", "program_manager"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const submissionId = searchParams.get("submission_id");

    // Return program evaluation config
    if (programId) {
      const progRes = await db.execute({
        sql: "SELECT grading_mode, evaluation_config FROM v2_programs WHERE id = ?",
        args: [programId],
      });

      if (progRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Program not found" },
          { status: 404 },
        );
      }

      const program = progRes.rows[0];
      let evaluationConfig = {};
      try {
        evaluationConfig =
          typeof program.evaluation_config === "string"
            ? JSON.parse(program.evaluation_config)
            : program.evaluation_config || {};
      } catch (_) {
        evaluationConfig = {};
      }

      return NextResponse.json({
        success: true,
        grading_mode: program.grading_mode,
        evaluation_config: evaluationConfig,
      });
    }

    // Return evaluation for a specific submission
    if (submissionId) {
      const subRes = await db.execute({
        sql: "SELECT s.evaluation_score, s.evaluation_data, d.title as deliverable_title FROM v2_submissions s LEFT JOIN v2_deliverables d ON s.deliverable_id = d.id WHERE s.id = ?",
        args: [submissionId],
      });

      if (subRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Submission not found" },
          { status: 404 },
        );
      }

      const sub = subRes.rows[0];
      let evaluationData = {};
      try {
        evaluationData =
          typeof sub.evaluation_data === "string"
            ? JSON.parse(sub.evaluation_data)
            : sub.evaluation_data || {};
      } catch (_) {
        evaluationData = {};
      }

      return NextResponse.json({
        success: true,
        evaluation: {
          score: sub.evaluation_score,
          data: evaluationData,
          deliverable_title: sub.deliverable_title,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "program_id or submission_id required" },
      { status: 400 },
    );
  },
);

export const PUT = createHandler(
  { roles: ["staff", "super_admin", "teacher", "program_manager"] },
  async (req) => {
    const { program_id, submission_id, score, evaluation_data } =
      await req.json();

    if (!program_id || !submission_id) {
      return NextResponse.json(
        { success: false, error: "program_id and submission_id required" },
        { status: 400 },
      );
    }

    // Fetch program's grading mode for validation
    const progRes = await db.execute({
      sql: "SELECT grading_mode, evaluation_config FROM v2_programs WHERE id = ?",
      args: [program_id],
    });

    if (progRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Program not found" },
        { status: 404 },
      );
    }

    const program = progRes.rows[0];
    const gradingMode = program.grading_mode;

    // Validate based on grading mode
    if (gradingMode === "academic" && score !== undefined) {
      if (score < 0 || score > 100) {
        return NextResponse.json(
          { success: false, error: "Academic score must be between 0 and 100" },
          { status: 400 },
        );
      }
    }

    if (gradingMode === "incubation" && evaluation_data) {
      // Validate incubation dimensions
      let config = {};
      try {
        config =
          typeof program.evaluation_config === "string"
            ? JSON.parse(program.evaluation_config)
            : program.evaluation_config || {};
      } catch (_) {}

      const dimensions = config.dimensions || [
        "idea",
        "execution",
        "market",
        "team",
        "traction",
      ];
      for (const dim of dimensions) {
        if (
          evaluation_data[dim] !== undefined &&
          (evaluation_data[dim] < 1 || evaluation_data[dim] > 5)
        ) {
          return NextResponse.json(
            {
              success: false,
              error: `${dim} score must be between 1 and 5`,
            },
            { status: 400 },
          );
        }
      }
    }

    // Update submission with evaluation
    await db.execute({
      sql: `UPDATE v2_submissions SET
              evaluation_score = ?,
              evaluation_data = ?::jsonb,
              updated_at = NOW()
            WHERE id = ?`,
      args: [
        score !== undefined ? score : null,
        evaluation_data ? JSON.stringify(evaluation_data) : "{}",
        submission_id,
      ],
    });

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

    if (!program_id) {
      return NextResponse.json(
        { success: false, error: "Program ID required" },
        { status: 400 },
      );
    }

    const validModes = ["graded", "review", "followup", "academic", "incubation"];
    if (grading_mode && !validModes.includes(grading_mode)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid grading mode. Must be one of: ${validModes.join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (grading_mode) {
      await db.execute({
        sql: "UPDATE v2_programs SET grading_mode = ?, updated_at = NOW() WHERE id = ?",
        args: [grading_mode, program_id],
      });
    }

    if (evaluation_config) {
      await db.execute({
        sql: "UPDATE v2_programs SET evaluation_config = ?::jsonb, updated_at = NOW() WHERE id = ?",
        args: [JSON.stringify(evaluation_config), program_id],
      });
    }

    return NextResponse.json({ success: true });
  },
);
