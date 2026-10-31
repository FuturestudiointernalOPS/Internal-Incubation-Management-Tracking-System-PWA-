"use client";

import NewProgramForm from "@/components/admin/programs/NewProgramForm";
import CreationAccessGuard from "@/components/create/CreationAccessGuard";

/**
 * CREATE → Program — the SAME wizard the Super Admin uses, reachable by anyone
 * holding `programs.create`. The form itself is unchanged; only its back link
 * and post-create destination point at the creation surface instead of /admin.
 */
export default function CreateProgramPage() {
  return (
    <CreationAccessGuard requirements={[{ module: "programs", capability: "create" }]}>
      <NewProgramForm
        backHref="/create"
        backLabelKey="creation.backToCreate"
        successHref="/create"
      />
    </CreationAccessGuard>
  );
}
