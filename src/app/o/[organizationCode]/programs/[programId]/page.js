import OrganizationProgramPortal from "@/components/ui/OrganizationProgramPortal";
export const dynamic = "force-dynamic";
export default async function OrganizationProgramPage({ params }) {
  const { organizationCode, programId } = await params;
  return <OrganizationProgramPortal organizationCode={organizationCode} programId={programId} view="programs" />;
}
