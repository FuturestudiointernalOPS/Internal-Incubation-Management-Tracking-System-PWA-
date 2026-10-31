import { listSupervisedPrograms } from "@/services/organizations/supervisionPrograms";
import { organizationProgramResponse, privateOrganizationHandler, organizationHandler } from "@/server/http/organizationPrograms";

export const dynamic = "force-dynamic";

export const GET = privateOrganizationHandler(organizationHandler(async (req, { params }) => {
  const { organizationId } = await params;
  const { searchParams } = new URL(req.url);
  return organizationProgramResponse(await listSupervisedPrograms({
    session: req.session, organizationId,
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 20),
    search: searchParams.get("search") ?? "",
  }));
}));
