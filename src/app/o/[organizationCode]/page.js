import OrganizationProgramPortal from "@/components/ui/OrganizationProgramPortal";
export default async function OrganizationPage({ params }) {
  return <OrganizationProgramPortal organizationCode={(await params).organizationCode} />;
}
