import { getOrganizationLmsCourse } from "@/services/organizations/lms";
import {
  organizationHandler,
  organizationProgramResponse,
  privateOrganizationHandler,
} from "@/server/http/organizationPrograms";

export const dynamic = "force-dynamic";

export const GET = privateOrganizationHandler(organizationHandler(async (req, { params }) => {
  const { courseId } = await params;
  return organizationProgramResponse(
    await getOrganizationLmsCourse({
      session: req.session,
      expectedOrganizationId: req.headers.get("x-organization-id"),
      courseId,
    }),
  );
}));
