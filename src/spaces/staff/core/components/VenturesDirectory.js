"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Rocket, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import KpiCard from "@/components/ui/KpiCard";
import PageHero from "@/components/ui/PageHero";

/**
 * Staff → Ventures → ALL VENTURES.
 *
 * The portfolio directory: every Venture the server hands back, which is the
 * whole studio set only when the caller holds `ventures.view_all`. The list is
 * a read — opening a Venture goes to the staff workspace, where the write
 * rights (`ventures.edit_all` or an assignment) are decided again by the API.
 *
 * The screen never widens what the API returned: it renders `GET /api/ventures`
 * as-is, so a staff member without the portfolio right still sees only their
 * assigned Ventures (and normally never reaches this page from the sidebar).
 */

const STAGE_TAG = {
  idea: "b",
  validation: "b",
  early_traction: "o",
  growth: "g",
  scaling: "o",
};

const STATUS_TAG = {
  prospect: "b",
  active: "g",
  pending: "w",
  paused: "w",
  graduated: "b",
  archived: "",
};

const pickVentures = (payload) => (payload?.success ? payload.ventures || [] : []);

export default function VenturesDirectory() {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const { data: ventures, loading, error, refresh } = useApi("/api/ventures", {
    defaultValue: [],
    transform: pickVentures,
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ventures;
    return ventures.filter((venture) =>
      `${venture.company_name || ""} ${venture.name || ""} ${venture.venture_id || ""} ${venture.industry || ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [ventures, query]);

  const active = ventures.filter((venture) => venture.status === "active").length;
  const prospects = ventures.filter((venture) => venture.status === "prospect").length;

  return (
    <div className="stf" style={{ paddingBottom: 60 }}>
      <PageHero
        kicker={t("vadmin.list.ventureOs")}
        title={t("vadmin.list.allTitle")}
        subtitle={t("vadmin.list.allSubtitle")}
      />

      <div className="stf-grid c3">
        <KpiCard label={t("vadmin.list.kpiTotal")} value={ventures.length} icon={Rocket} />
        <KpiCard label={t("vadmin.list.kpiActive")} value={active} icon={Rocket} />
        <KpiCard label={t("vadmin.list.kpiProspects")} value={prospects} icon={Rocket} />
      </div>

      <div className="stf-bar">
        <Search size={16} aria-hidden="true" />
        <input
          className="stf-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("vadmin.list.searchPlaceholder")}
          aria-label={t("vadmin.list.searchPlaceholder")}
        />
      </div>

      {loading ? (
        <div className="stf-card stf-empty">{t("common.loading")}</div>
      ) : error ? (
        <div className="stf-card stf-empty">
          <p>{t(error) || t("errors.somethingWrong")}</p>
          <button type="button" className="stf-btn" onClick={refresh}>
            {t("common.retry")}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="stf-card stf-empty">
          <Rocket size={36} />
          <b>{query ? t("vadmin.list.noSearchResults") : t("vadmin.list.noVentures")}</b>
          <div className="stf-small">
            {query ? t("vadmin.list.tryDifferentSearch") : t("vadmin.list.noVenturesDesc")}
          </div>
        </div>
      ) : (
        <div className="stf-tw">
          <table>
            <thead>
              <tr>
                <th>{t("vadmin.list.venture")}</th>
                <th>{t("vadmin.list.industry")}</th>
                <th>{t("vadmin.list.stage")}</th>
                <th>{t("vadmin.list.status")}</th>
                <th>{t("vadmin.list.members")}</th>
                <th>{t("vadmin.list.created")}</th>
                <th aria-label={t("common.workspaces.open")} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((venture) => {
                const members =
                  (parseInt(venture.founder_count) || 0) + (parseInt(venture.member_count) || 0);
                return (
                  <tr
                    key={venture.id || venture.venture_id}
                    onClick={() => router.push(`/staff/ventures/${venture.venture_id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <strong>{venture.company_name || venture.name}</strong>
                      <div className="stf-small" style={{ fontFamily: "monospace" }}>
                        {venture.venture_id}
                      </div>
                    </td>
                    <td>{venture.industry || "—"}</td>
                    <td>
                      <span className={`stf-tag ${STAGE_TAG[venture.business_stage] || ""}`}>
                        {t(
                          venture.business_stage === "early_traction"
                            ? "vadmin.list.stageEarlyTraction"
                            : venture.business_stage === "validation"
                              ? "vadmin.list.stageValidation"
                              : venture.business_stage === "growth"
                                ? "vadmin.list.stageGrowth"
                                : venture.business_stage === "scaling"
                                  ? "vadmin.list.stageScaling"
                                  : "vadmin.list.stageIdea",
                        )}
                      </span>
                    </td>
                    <td>
                      <span className={`stf-tag ${STATUS_TAG[venture.status] ?? ""}`}>
                        {t(`status.${venture.status || "active"}`)}
                      </span>
                    </td>
                    <td>{t("vadmin.list.membersCount", { count: members })}</td>
                    <td>{new Date(venture.created_at).toLocaleDateString()}</td>
                    <td className="c">
                      <ChevronRight size={16} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
