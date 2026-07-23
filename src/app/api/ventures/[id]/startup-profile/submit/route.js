import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import {
  submitStartupProfile,
  canEditStartupProfile,
  getOrCreateStartupProfile,
  validateFullProfile,
} from "@/lib/ventures";

/**
 * POST /api/ventures/[id]/startup-profile/submit
 *
 * Submit the completed startup profile for final review.
 * Only founders and super_admin can submit.
 */
export const POST = createHandler(
  async (req, { params }) => {
    const { id } = params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    // Check edit permission
    const canEdit = await canEditStartupProfile(id, session);
    if (!canEdit) {
      return NextResponse.json(
        { success: false, error: "Unauthorized to submit this startup profile." },
        { status: 403 },
      );
    }

    // Get the profile
    const { profile } = await getOrCreateStartupProfile(id);

    // Check if already submitted
    if (profile.is_submitted) {
      return NextResponse.json(
        { success: false, error: "Startup profile has already been submitted." },
        { status: 409 },
      );
    }

    // Build full profile data for validation
    const profileData = {};
    for (let i = 1; i <= 6; i++) {
      const key = `step_${i}_data`;
      let stepData = profile[key];
      if (typeof stepData === "string") {
        try { stepData = JSON.parse(stepData); } catch { stepData = {}; }
      }
      profileData[key] = stepData || {};
    }

    // Validate the full profile
    const validation = validateFullProfile(profileData);
    if (!validation.valid) {
      // Return per-step errors
      const stepErrors = {};
      for (const [stepNum, errors] of Object.entries(validation.errors)) {
        stepErrors[stepNum] = errors;
      }
      return NextResponse.json(
        {
          success: false,
          error: `Profile validation failed: ${validation.totalErrors} errors found.`,
          step_errors: stepErrors,
          total_errors: validation.totalErrors,
        },
        { status: 400 },
      );
    }

    // Submit the profile
    const result = await submitStartupProfile({
      ventureId: id,
      submittedBy: session.cid || "system",
    });

    return NextResponse.json({
      success: true,
      submitted: true,
      submitted_at: result.submitted_at,
      message: "Startup profile submitted successfully.",
    });
  },
);
