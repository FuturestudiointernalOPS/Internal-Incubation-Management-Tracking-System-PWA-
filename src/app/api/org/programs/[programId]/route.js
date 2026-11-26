import { organizationProgramManagementRoute } from "@/server/http/organizationProgramManagement";
import { getOrganizationProgram } from "@/services/organizations/programs";
import { organizationProgramResponse, privateOrganizationHandler, organizationHandler } from "@/server/http/organizationPrograms";
import { refusalResponse } from "@/server/http/refusal";
export const dynamic = "force-dynamic";
export const GET = privateOrganizationHandler(organizationHandler(async (req, { params }) => {
  const expectedOrganizationId = req.headers.get("x-organization-id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedOrganizationId || "")) {
    return refusalResponse({ status: 400, errorKey: "errors.invalidRequest" });
  }
  return organizationProgramResponse(await getOrganizationProgram({ session: req.session, expectedOrganizationId, programId: (await params).programId }));
}));

export const PATCH = organizationProgramManagementRoute("update");
