import OrganizationPortalRoute from "@/components/ui/OrganizationPortalRoute";
export const dynamic = "force-dynamic";
export default async function OrganizationProgramsPage({ params, searchParams }) {
  const { organizationCode } = await params;
  const { preview } = await searchParams;
  return <OrganizationPortalRoute organizationCode={organizationCode} view="programs" preview={preview} />;
}
