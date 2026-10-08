"use client";

import KpiCard from "@/components/ui/KpiCard";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Rocket, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

// Module scope: the data hook keys its read on this.
const pickAssignments = (payload) => (payload?.success ? payload.assignments || [] : []);
const EMPTY = [];

/**
 * MY VENTURES (delegated) — the Ventures this staff member is explicitly
 * assigned to, one card per assignment.
 *
 * Reads GET /api/ventures/assigned. Opening a card goes to the venture's own
 * workspace page (`/staff/ventures/<venture id>`).
 */
export default function VenturesView() {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const read = useApi("/api/ventures/assigned", { defaultValue: EMPTY, transform: pickAssignments });
  const assignments = read.data;

  const name = (assignment) => assignment.company_name || assignment.name || assignment.venture_id;
  const needle = query.trim().toLowerCase();
  const visible = assignments.filter(
    (assignment) =>
      !needle ||
      `${name(assignment)} ${assignment.venture_id} ${assignment.responsibility_name || assignment.responsibility_code || ""}`.toLowerCase().includes(needle),
  );
  const ventures = new Set(assignments.map((assignment) => assignment.venture_id)).size;
  const active = assignments.filter((assignment) => String(assignment.status).toLowerCase() === "active").length;
  const loading = read.loading && assignments.length === 0;

  return (
    <div className="stf" style={{ paddingBottom: 60 }}>
      <div className="stf-head">
        <div>
          <h1 className="stf-title">{t("venture.personal.myVentures")}</h1>
          <p className="stf-sub">{t("staff.ventureWorkspace.listSubtitle")}</p>
        </div>
      </div>

      <div className="stf-grid">
        {[
          [t("staffMisc.front.ventures.kpiVentures"), ventures],
          [t("staffMisc.front.ventures.kpiAssignments"), assignments.length],
          [t("staffMisc.front.ventures.kpiActive"), active],
        ].map(([label, value]) => (
          <KpiCard key={label} label={label} value={value} icon={Rocket} loading={loading} />
        ))}
      </div>

      {assignments.length > 0 && (
        <div className="stf-bar">
          <input className="stf-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("common.search")} aria-label={t("common.search")} />
        </div>
      )}

      {loading ? (
        <div className="stf-empty">{t("common.loading")}</div>
      ) : assignments.length === 0 ? (
        <div className="stf-card stf-empty">
          <ShieldAlert size={36} />
          <b>{t("staff.ventureWorkspace.listEmpty")}</b>
          <div className="stf-small">{t("staff.ventureWorkspace.listEmptyHint")}</div>
        </div>
      ) : visible.length === 0 ? (
        <div className="stf-card stf-empty">{t("common.noResults")}</div>
      ) : (
        <div className="stf-grid g3">
          {visible.map((assignment) => (
            <button key={assignment.id} type="button" className="stf-pc" onClick={() => router.push(`/staff/ventures/${assignment.venture_id}`)}>
              <h4>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{name(assignment)}</span>
                <ChevronRight size={15} />
              </h4>
              <p style={{ fontFamily: "monospace", fontSize: 11 }}>{assignment.venture_id}</p>
              <div className="ft">
                <span className="stf-tag o">{assignment.responsibility_name || assignment.responsibility_code}</span>
                {assignment.scope_type !== "venture_wide" && (
                  <span className="stf-tag b">
                    {assignment.scope_type}
                    {assignment.scope_ref_id ? ` · ${assignment.scope_ref_id}` : ""}
                  </span>
                )}
                <span className="stf-tag">{assignment.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
