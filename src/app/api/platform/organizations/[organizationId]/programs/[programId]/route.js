import { getSupervisedProgram } from "@/services/organizations/supervisionPrograms";
import { organizationProgramResponse, privateOrganizationHandler, organizationHandler } from "@/server/http/organizationPrograms";

export const dynamic = "force-dynamic";

export const GET = privateOrganizationHandler(organizationHandler(async (req, { params }) => {
  const { organizationId, programId } = await params;
  return organizationProgramResponse(await getSupervisedProgram({ session: req.session, organizationId, programId }));
}));
