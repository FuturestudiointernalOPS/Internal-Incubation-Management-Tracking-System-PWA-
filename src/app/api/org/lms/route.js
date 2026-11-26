import { getOrganizationLmsOverview } from "@/services/organizations/lms";
import {
  organizationHandler,
  organizationProgramResponse,
  privateOrganizationHandler,
} from "@/server/http/organizationPrograms";

export const dynamic = "force-dynamic";

export const GET = privateOrganizationHandler(organizationHandler(async (req) => {
  const expectedOrganizationId = req.headers.get("x-organization-id");
  return organizationProgramResponse(
    await getOrganizationLmsOverview({ session: req.session, expectedOrganizationId }),
  );
}));
