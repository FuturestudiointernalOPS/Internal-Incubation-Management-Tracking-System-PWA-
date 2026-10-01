"use client";

import Stat from "./Stat";

/** The four top-line numbers of the readiness report. */
export default function ScopeSummaryStats({ t, summary }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat
        label={t("engineering.permissions.programScopeRunning")}
        value={summary?.runningPrograms ?? 0}
      />
      <Stat
        label={t("engineering.permissions.programScopeUnmanaged")}
        value={summary?.unmanaged ?? 0}
        tone={(summary?.unmanaged ?? 0) > 0 ? "warn" : "good"}
      />
      <Stat
        label={t("engineering.permissions.programScopePeople")}
        value={summary?.holders ?? 0}
      />
      <Stat
        label={t("engineering.permissions.programScopeLosesEverything")}
        value={summary?.losesEverything ?? 0}
        tone={(summary?.losesEverything ?? 0) > 0 ? "warn" : "good"}
      />
    </div>
  );
}
