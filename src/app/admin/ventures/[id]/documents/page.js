"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
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
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="space-y-5 pb-16">
      <button
        type="button"
        onClick={() => router.push(`/admin/ventures/${id}`)}
        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowLeft size={13} /> {t("common.back")}
      </button>
      <VentureDataRoom ventureId={id} />
    </div>
  );
}
