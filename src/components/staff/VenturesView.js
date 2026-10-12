"use client";

import KpiCard from "@/components/ui/KpiCard";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Flag,
  Inbox,
  Rocket,
  ShieldAlert,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

const pickHome = (payload) => (payload?.success ? payload : null);
const pickAssignments = (payload) => (payload?.success ? payload.assignments || [] : []);
const EMPTY_LIST = [];

function formatShortDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString();
}

/**
 * Staff → Ventures.
 *
 * Lead Managers land on an operational "My day" home (KPIs + urgency queue +
 * enriched Mes Ventures). Staff with only coach/facilitator assignments keep
 * the simpler assignment list (same source of truth: their own rows).
 */
export default function VenturesView() {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("all");

  const homeRead = useApi("/api/ventures/lead-manager/home", {
    defaultValue: null,
    transform: pickHome,
  });
  const assignmentsRead = useApi("/api/ventures/assigned", {
    defaultValue: EMPTY_LIST,
    transform: pickAssignments,
  });

  const home = homeRead.data;
  const isLeadManager = Boolean(home?.is_lead_manager);
  const kpis = home?.kpis || null;
  const queue = useMemo(
    () => (Array.isArray(home?.queue) ? home.queue : []),
    [home],
  );
  const lmVentures = useMemo(
    () => (Array.isArray(home?.ventures) ? home.ventures : []),
    [home],
  );
  const assignments = assignmentsRead.data;

  const loading = (homeRead.loading && !home) || (assignmentsRead.loading && assignments.length === 0);

  const phases = useMemo(() => {
    const set = new Set(lmVentures.map((row) => row.business_stage || row.status || "unknown"));
    return ["all", ...[...set].filter(Boolean).sort()];
  }, [lmVentures]);

  const filteredVentures = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return lmVentures.filter((row) => {
      if (phaseFilter !== "all" && String(row.business_stage || row.status || "unknown") !== phaseFilter) {
        return false;
      }
      if (!needle) return true;
      return `${row.name} ${row.venture_id} ${row.business_stage || ""} ${row.industry || ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [lmVentures, phaseFilter, query]);

  const assignmentName = (assignment) => assignment.company_name || assignment.name || assignment.venture_id;
  const assignmentNeedle = query.trim().toLowerCase();
  const visibleAssignments = assignments.filter(
    (assignment) =>
      !assignmentNeedle ||
      `${assignmentName(assignment)} ${assignment.venture_id} ${assignment.responsibility_name || assignment.responsibility_code || ""}`
        .toLowerCase()
        .includes(assignmentNeedle),
  );

  if (loading) {
    return <div className="stf"><div className="stf-empty">{t("common.loading")}</div></div>;
  }

  // Lead Manager operational home
  if (isLeadManager) {
    return (
      <div className="stf" style={{ paddingBottom: 60 }}>
        <div className="stf-head">
          <div>
            <h1 className="stf-title">{t("staff.leadHome.title")}</h1>
            <p className="stf-sub">{t("staff.leadHome.subtitle")}</p>
          </div>
        </div>

        <div className="stf-grid">
          <KpiCard
            label={t("staff.leadHome.kpiVentures")}
            value={kpis?.ventures_total ?? 0}
            icon={Rocket}
            onClick={() => setPhaseFilter("all")}
          />
          <KpiCard
            label={t("staff.leadHome.kpiActiveJourneys")}
            value={kpis?.active_journeys ?? 0}
            icon={Flag}
          />
          <KpiCard
            label={t("staff.leadHome.kpiBlocked")}
            value={kpis?.blocked_milestones ?? 0}
            icon={AlertTriangle}
          />
          <KpiCard
            label={t("staff.leadHome.kpiToReview")}
            value={kpis?.deliverables_to_review ?? 0}
            icon={Inbox}
          />
          <KpiCard
            label={t("staff.leadHome.kpiSignoff")}
            value={kpis?.milestones_awaiting_signoff ?? 0}
            icon={CheckCircle2}
          />
          <KpiCard
            label={t("staff.leadHome.kpiSessionsWeek")}
            value={kpis?.sessions_this_week ?? 0}
            icon={Calendar}
          />
          <KpiCard
            label={t("staff.leadHome.kpiReports")}
            value={kpis?.journey_reports_due ?? 0}
            icon={ClipboardList}
          />
        </div>

        {kpis?.blocked_milestone_titles?.length > 0 && (
          <p className="stf-small" style={{ marginTop: -8 }}>
            {t("staff.leadHome.blockedHint", {
              names: kpis.blocked_milestone_titles
                .slice(0, 3)
                .map((row) => row.title)
                .join(", "),
            })}
          </p>
        )}

        <section className="stf-card" style={{ marginTop: 16 }}>
          <h2 className="stf-title" style={{ fontSize: 16, marginBottom: 8 }}>
            {t("staff.leadHome.queueTitle")}
          </h2>
          {queue.length === 0 ? (
            <p className="stf-small">{t("staff.leadHome.queueEmpty")}</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {queue.slice(0, 25).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="stf-pc"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => router.push(item.href || `/staff/ventures/${item.venture_id}`)}
                  >
                    <h4>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.title}
                      </span>
                      <ChevronRight size={15} />
                    </h4>
                    <p className="stf-small">
                      <span className="stf-tag o">{t(`staff.leadHome.kind.${item.kind}`)}</span>
                      {" · "}
                      {item.venture_name || item.venture_id}
                      {item.detail ? ` · ${typeof item.detail === "string" ? (item.detail.length > 40 ? formatShortDate(item.detail) : item.detail) : ""}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={{ marginTop: 24 }}>
          <div className="stf-head" style={{ marginBottom: 8 }}>
            <div>
              <h2 className="stf-title" style={{ fontSize: 18 }}>{t("staff.leadHome.myVenturesTitle")}</h2>
              <p className="stf-sub">{t("staff.leadHome.myVenturesSubtitle")}</p>
            </div>
          </div>

          <div className="stf-bar">
            <input
              className="stf-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("common.search")}
              aria-label={t("common.search")}
            />
            <select
              className="stf-input"
              style={{ maxWidth: 220 }}
              value={phaseFilter}
              onChange={(event) => setPhaseFilter(event.target.value)}
              aria-label={t("staff.leadHome.filterPhase")}
            >
              {phases.map((phase) => (
                <option key={phase} value={phase}>
                  {phase === "all" ? t("staff.leadHome.filterAllPhases") : phase}
                </option>
              ))}
            </select>
          </div>

          {filteredVentures.length === 0 ? (
            <div className="stf-card stf-empty">{t("common.noResults")}</div>
          ) : (
            <div className="stf-grid g3">
              {filteredVentures.map((venture) => (
                <button
                  key={venture.venture_id}
                  type="button"
                  className="stf-pc"
                  onClick={() => router.push(venture.href || `/staff/ventures/${venture.venture_id}`)}
                >
                  <h4>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{venture.name}</span>
                    <ChevronRight size={15} />
                  </h4>
                  <p style={{ fontFamily: "monospace", fontSize: 11 }}>{venture.venture_id}</p>
                  <div className="ft">
                    {venture.business_stage ? <span className="stf-tag b">{venture.business_stage}</span> : null}
                    <span className="stf-tag">
                      {t("staff.leadHome.progress", {
                        done: venture.milestones_done,
                        total: venture.milestones_total,
                      })}
                    </span>
                    {venture.milestones_blocked > 0 ? (
                      <span className="stf-tag o">
                        {t("staff.leadHome.blockedCount", { count: venture.milestones_blocked })}
                      </span>
                    ) : null}
                  </div>
                  <p className="stf-small" style={{ marginTop: 8 }}>
                    {venture.next_deadline
                      ? t("staff.leadHome.nextDeadline", {
                          title: venture.next_deadline.title,
                          date: formatShortDate(venture.next_deadline.target_date),
                        })
                      : t("staff.leadHome.noDeadline")}
                  </p>
                  <p className="stf-small">
                    {t("staff.leadHome.lastActivity", {
                      date: formatShortDate(venture.last_activity_at),
                    })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Fallback: coach / facilitator / other assignments (non–lead_manager)
  const ventures = new Set(assignments.map((assignment) => assignment.venture_id)).size;
  const active = assignments.filter((assignment) => String(assignment.status).toLowerCase() === "active").length;

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
          <KpiCard key={label} label={label} value={value} icon={Rocket} />
        ))}
      </div>

      {assignments.length > 0 && (
        <div className="stf-bar">
          <input
            className="stf-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("common.search")}
            aria-label={t("common.search")}
          />
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="stf-card stf-empty">
          <ShieldAlert size={36} />
          <b>{t("staff.ventureWorkspace.listEmpty")}</b>
          <div className="stf-small">{t("staff.ventureWorkspace.listEmptyHint")}</div>
        </div>
      ) : visibleAssignments.length === 0 ? (
        <div className="stf-card stf-empty">{t("common.noResults")}</div>
      ) : (
        <div className="stf-grid g3">
          {visibleAssignments.map((assignment) => (
            <button
              key={assignment.id}
              type="button"
              className="stf-pc"
              onClick={() => router.push(`/staff/ventures/${assignment.venture_id}`)}
            >
              <h4>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {assignmentName(assignment)}
                </span>
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
