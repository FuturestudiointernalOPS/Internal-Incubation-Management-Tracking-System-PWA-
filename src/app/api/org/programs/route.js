import { organizationProgramManagementRoute } from "@/server/http/organizationProgramManagement";
import { listOrganizationPrograms } from "@/services/organizations/programs";
import { organizationProgramResponse, privateOrganizationHandler, organizationHandler } from "@/server/http/organizationPrograms";
import { refusalResponse } from "@/server/http/refusal";
export const dynamic = "force-dynamic";
export const GET = privateOrganizationHandler(organizationHandler(async (req) => {
  const expectedOrganizationId = req.headers.get("x-organization-id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedOrganizationId || "")) {
    return refusalResponse({ status: 400, errorKey: "errors.invalidRequest" });
  }
  const params = new URL(req.url).searchParams;
  return organizationProgramResponse(await listOrganizationPrograms({ session: req.session, expectedOrganizationId,
    page: Number(params.get("page") ?? 1), pageSize: Number(params.get("pageSize") ?? 20), search: params.get("search") ?? "" }));
}));

export const POST = organizationProgramManagementRoute("create");
