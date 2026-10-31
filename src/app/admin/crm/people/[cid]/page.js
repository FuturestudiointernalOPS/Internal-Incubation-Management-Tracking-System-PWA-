import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The person record moved into the CRM workspace; the person id is preserved
 * so the same dossier opens from an old link.
 */
export default async function LegacyPersonRedirect({ params }) {
  const { cid } = await params;
  redirect(`/crm/people/${encodeURIComponent(cid)}`);
}
