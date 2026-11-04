"use client";

import NewProgramForm from "@/components/admin/programs/NewProgramForm";
import CreationAccessGuard from "@/components/shared/create/CreationAccessGuard";

/**
 * CREATE → Program — the SAME wizard the Super Admin uses, reachable by anyone
 * holding `programs.create`. The form itself is unchanged; only its back link
 * and post-create destination point at the program workspace instead of
 * /admin.
 */
export default function CreateProgramPage() {
  return (
    <CreationAccessGuard requirements={[{ module: "programs", capability: "create" }]}>
      <NewProgramForm
        backHref="/staff/program-manager/programs"
        backLabelKey="adminMisc.newProgram.programList"
        programHref={(id) => `/staff/program-manager/programs/${id}`}
      />
    </CreationAccessGuard>
  );
}
