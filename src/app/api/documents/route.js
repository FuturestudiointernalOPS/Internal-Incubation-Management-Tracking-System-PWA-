import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import {
  ensureDocumentRequirementsResourceUrlColumn,
  ensureDocumentRequirementsResourceLabelColumn,
  getDocumentRequirementsByProgram,
  createDocumentRequirement,
} from "@/models/workspace";

async function ensureDeliverableResourceSchema() {
  try {
    await ensureDocumentRequirementsResourceUrlColumn();
  } catch (_) {}
  try {
    await ensureDocumentRequirementsResourceLabelColumn();
  } catch (_) {}
}

export const GET = createHandler(
  async (req) => {
    const capError = await requireAuthorization("programs", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const result = await getDocumentRequirementsByProgram(programId);
    return NextResponse.json({ success: true, documents: result.rows });
  },
);

export const POST = createHandler(
  async (req) => {
    const capError = await requireAuthorization("programs", "edit");
    if (capError) return capError;

    await ensureDeliverableResourceSchema();
    const { program_id, title, description, resource_url, resource_label } = await req.json();
    const result = await createDocumentRequirement(
      program_id,
      title,
      description,
      resource_url || null,
      resource_label || null,
    );
    return NextResponse.json({ success: true, document: result.rows[0] });
  },
);
