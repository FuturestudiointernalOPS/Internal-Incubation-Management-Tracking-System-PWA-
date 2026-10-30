import OrganizationProgramPortal from "@/components/ui/OrganizationProgramPortal";

export const dynamic = "force-dynamic";

export default async function OrganizationVenturePage({ params }) {
  const { organizationCode } = await params;
  return <OrganizationProgramPortal organizationCode={organizationCode} view="venture" />;
}
