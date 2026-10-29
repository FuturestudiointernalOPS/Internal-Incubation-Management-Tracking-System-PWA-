import OrganizationProgramPortal from "@/components/ui/OrganizationProgramPortal";
export const dynamic = "force-dynamic";
export default async function OrganizationPage({ params }) {
  return <OrganizationProgramPortal organizationCode={(await params).organizationCode} view="home" />;
}
