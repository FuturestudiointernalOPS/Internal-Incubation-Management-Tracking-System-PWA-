import { redirect } from "next/navigation";

/**
 * The timeline now lives inside the Venture's Project page. The old address
 * keeps working: it forwards there, onto the Timeline view.
 */
export default async function VentureTimelineRedirect({ params }) {
  const { id } = await params;
  redirect(`/admin/ventures/${id}/projects?view=timeline`);
}
