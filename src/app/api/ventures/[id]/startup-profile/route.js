import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import {
  getOrCreateStartupProfile,
  updateWizardStep,
  validateStep,
  uploadProfileDocument,
  deleteProfileDocument,
  canEditStartupProfile,
  canReadStartupProfile,
} from "@/lib/ventures";

/**
 * GET /api/ventures/[id]/startup-profile
 *
 * Fetch the startup profile with progress and documents.
 * Accessible by founders, super_admin, staff, program_manager.
 */
export const GET = createHandler(
  async (req, { params }) => {
    const { id } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    // Check read permission
    const canRead = await canReadStartupProfile(id, session);
    if (!canRead) {
      return NextResponse.json(
        { success: false, error: "Unauthorized to view this startup profile." },
        { status: 403 },
      );
    }

    const result = await getOrCreateStartupProfile(id);

    return NextResponse.json({
      success: true,
      profile: result.profile,
      progress: result.progress,
      documents: result.documents,
      completion_percentage: result.completion_percentage,
      steps: {
        1: { name: "Startup Identity", data: result.profile.step_1_data || {} },
        2: { name: "Business Information", data: result.profile.step_2_data || {} },
        3: { name: "Founder Information", data: result.profile.step_3_data || {} },
        4: { name: "Team Information", data: result.profile.step_4_data || {} },
        5: { name: "Supporting Documents", data: result.profile.step_5_data || {} },
      },
    });
  },
);

/**
 * PATCH /api/ventures/[id]/startup-profile
 *
 * Autosave a wizard step's data.
 * Only founders and super_admin can edit.
 */
export const PATCH = createHandler(
  async (req, { params }) => {
    const { id } = await params;
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
        { success: false, error: "Unauthorized to edit this startup profile." },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { step, data, action } = body;

    // Handle document upload/deletion actions
    if (action === "upload_document") {
      try {
        const result = await uploadProfileDocument({
          ventureId: id,
          documentType: body.document_type,
          fileName: body.file_name,
          fileSize: body.file_size,
          fileType: body.file_type,
          fileUrl: body.file_url,
          uploadedBy: session.cid || "system",
        });
        return NextResponse.json({ success: true, ...result });
      } catch (e) {
        return NextResponse.json(
          { success: false, error: e.message },
          { status: 400 },
        );
      }
    }

    if (action === "delete_document") {
      await deleteProfileDocument({
        ventureId: id,
        documentId: body.document_id,
      });
      return NextResponse.json({ success: true });
    }

    // Validate step
    if (!step || step < 1 || step > 6) {
      return NextResponse.json(
        { success: false, error: "Step must be between 1 and 6." },
        { status: 400 },
      );
    }

    // Validate the step data
    const validation = validateStep(step, data);
    if (!validation.valid) {
      // Still save the data (autosave), but return validation warnings
      const result = await updateWizardStep({ ventureId: id, step, data });
      return NextResponse.json({
        success: true,
        saved: true,
        has_errors: true,
        validation_errors: validation.errors,
        ...result,
      });
    }

    // Save the step data
    const result = await updateWizardStep({ ventureId: id, step, data });

    return NextResponse.json({
      success: true,
      saved: true,
      ...result,
    });
  },
);
