import OrganizationPortalRoute from "@/components/ui/OrganizationPortalRoute";

export const dynamic = "force-dynamic";

export default async function OrganizationLmsPage({ params, searchParams }) {
  const { organizationCode } = await params;
  const { preview } = await searchParams;
  return <OrganizationPortalRoute organizationCode={organizationCode} view="lms" preview={preview} />;
}
