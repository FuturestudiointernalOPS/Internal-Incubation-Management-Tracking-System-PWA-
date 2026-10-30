import OrganizationProgramPortal from "@/components/ui/OrganizationProgramPortal";
export const dynamic = "force-dynamic";
export default async function OrganizationProgramsPage({ params }) {
  const { organizationCode } = await params;
  return <OrganizationProgramPortal organizationCode={organizationCode} view="programs" />;
}
