import OrganizationProgramPortal from "@/components/ui/OrganizationProgramPortal";

export const dynamic = "force-dynamic";

export default async function OrganizationLmsCoursePage({ params }) {
  const { organizationCode, courseId } = await params;
  return <OrganizationProgramPortal
    organizationCode={organizationCode}
    programId={courseId}
    view="lms-course"
  />;
}
