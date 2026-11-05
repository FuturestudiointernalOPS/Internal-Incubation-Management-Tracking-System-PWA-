"use client";

import { useParams } from "next/navigation";
import VentureDataRoom from "@/components/ventures/data-room/VentureDataRoom";

/**
 * SUPER ADMIN → one Venture → Data Room.
 *
 * The screen itself is the shared `VentureDataRoom` component, used unchanged by
 * the founder workspace, the staff workspace and the investor's diligence view.
 * Keeping ONE component is what guarantees that a document a manager can file is
 * the same document a reviewer can verify and an investor can be granted: the
 * three screens cannot drift apart.
 */
export default function AdminVentureDataRoomPage() {
  const { id } = useParams();

  return (
    <div className="space-y-5 pb-16">
      <VentureDataRoom ventureId={id} />
    </div>
  );
}
