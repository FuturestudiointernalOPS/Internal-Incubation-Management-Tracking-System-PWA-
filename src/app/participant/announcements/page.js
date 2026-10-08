import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Preserve links from the previous participant prototype.
export default function ParticipantAnnouncementsPage() {
  redirect("/participant#announcements");
}
