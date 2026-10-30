import OrganizationProgramPortal from "./OrganizationProgramPortal";
import OrganizationPortalPreview from "./OrganizationPortalPreview";

export default function OrganizationPortalRoute({
  organizationCode,
  programId,
  view,
  preview,
}) {
  if (process.env.NODE_ENV === "development" && preview === "1") {
    return <OrganizationPortalPreview organizationCode={organizationCode} programId={programId} view={view} />;
  }

  return <OrganizationProgramPortal organizationCode={organizationCode} programId={programId} view={view} />;
}
