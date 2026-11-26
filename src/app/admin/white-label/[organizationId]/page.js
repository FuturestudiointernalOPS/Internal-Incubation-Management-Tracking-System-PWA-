import WhiteLabelClient from "@/components/ui/white-label-admin/WhiteLabelClient";
export default async function WhiteLabelClientPage({params}) {
  const { organizationId } = await params;
  return <WhiteLabelClient key={organizationId} organizationId={organizationId} />;
}
