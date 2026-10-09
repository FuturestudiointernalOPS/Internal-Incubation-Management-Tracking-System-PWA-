"use client";

import { useState } from "react";
import StandupRetroView from "@/components/dashboard/StandupRetroView";
import TasksView from "@/components/staff/TasksView";
import { useI18n } from "@/lib/i18n";
import { useSessionUser } from "@/lib/hooks/useSessionUser";

/**
 * STAFF TASKS — two views of the same work.
 *
 *   list  — every task of the person, one table (status tabs, search, advance /
 *           block / delete, add) — `TasksView`
 *   week  — the week's tasks with the stand-up and retro forms, unchanged —
 *           `StandupRetroView`
 */
export default function StaffTasksPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState("list");
  // The identity comes from the shell's session cache instead of the browser's
  // stored copy, so nothing is written from an effect. It is absent for the first
  // moment of a cold load; the empty object keeps the view's existing contract
  // while that arrives.
  const { user } = useSessionUser();

  return (
    <div className="stf" style={{ paddingBottom: 60 }}>
      <div className="stf-bar" style={{ marginBottom: 18 }}>
        <div className="stf-tabs" role="tablist">
          {["list", "week"].map((value) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "on" : ""} onClick={() => setTab(value)}>
              {t(`staffMisc.front.tasks.tab.${value}`)}
            </button>
          ))}
        </div>
      </div>
      {tab === "list" ? (
        <TasksView />
      ) : (
        <StandupRetroView
          user={user || {}}
          context={{ context_type: "staff", context_id: null }}
          contextLabel={t("staffMisc.standupRetro.contextLabel")}
        />
      )}
    </div>
  );
}
