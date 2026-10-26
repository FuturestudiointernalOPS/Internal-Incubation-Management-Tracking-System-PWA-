import { createHandler } from "@/lib/api/createHandler";
import { listSupervisedPrograms } from "@/services/organizations/supervisionPrograms";
import { organizationProgramResponse, privateOrganizationHandler } from "@/server/http/organizationPrograms";

export const dynamic = "force-dynamic";

export const GET = privateOrganizationHandler(createHandler(async (req, { params }) => {
  const { organizationId } = await params;
  const { searchParams } = new URL(req.url);
  return organizationProgramResponse(await listSupervisedPrograms({
    session: req.session, organizationId,
    page: Number(searchParams.get("page") ?? 1),
    pageSize: Number(searchParams.get("pageSize") ?? 20),
    search: searchParams.get("search") ?? "",
  }));
}));
