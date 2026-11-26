import OrganizationPortalRoute from "@/components/ui/OrganizationPortalRoute";

export const dynamic = "force-dynamic";

export default async function OrganizationLmsCoursePage({ params, searchParams }) {
  const { organizationCode, courseId } = await params;
  const { preview } = await searchParams;
  return <OrganizationPortalRoute
    organizationCode={organizationCode}
    programId={courseId}
    view="lms-course"
    preview={preview}
  />;
}
