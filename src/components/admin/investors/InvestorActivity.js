"use client";

import { useState } from "react";
import { MessageSquare, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppModal from "@/components/ui/AppModal";

const STAGE_TONE = { invested: "g", due_diligence: "b", negotiation: "o", meeting_requested: "w" };
const CATEGORY_TONE = { general: "", financial: "g", legal: "b", product: "b", team: "w", market: "r" };
const REQUEST_TONE = { pending: "w", responded: "g" };

const row = (key, title, subtitle, side, onClick) => (
  <div
    key={key}
    className="stf-card"
    style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: onClick ? "pointer" : "default" }}
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (event) => (event.key === "Enter" || event.key === " ") && onClick() : undefined}
  >
    <div style={{ minWidth: 0 }}>
      <b style={{ fontSize: 13 }}>{title}</b>
      <div className="stf-small" style={{ marginTop: 0 }}>{subtitle}</div>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{side}</div>
  </div>
);

/**
 * What investors are doing right now, from `GET /api/investor/admin-overview`:
 * the due-diligence workspaces, the introduction requests waiting for an answer
 * (a click opens the request), the other live pipelines and the information
 * requests. Read-only: the request detail only displays.
 */
export default function InvestorActivity({ workspaces, pipelines, requests }) {
  const { t } = useI18n();
  const [detail, setDetail] = useState(null);
  const stageLabels = {
    invested: t("investorAdmin.overview.invested"),
    due_diligence: t("investorAdmin.overview.dueDiligence"),
    negotiation: t("investorAdmin.overview.negotiation"),
    meeting_requested: t("investorAdmin.overview.introductionRequested"),
  };
  const introductions = pipelines.filter((pipeline) => pipeline.stage === "meeting_requested");
  const others = pipelines.filter((pipeline) => pipeline.stage !== "meeting_requested");
  const who = (item) => `${item.investor_name || ""}${item.organization_name ? ` · ${item.organization_name}` : ""}`;
  const empty = (text) => <p className="stf-small" style={{ padding: "8px 0" }}>{text}</p>;

  const facts = detail
    ? [
        [t("investorAdmin.overview.venture"), detail.venture_name || "—"],
        [t("investorAdmin.overview.investor"), detail.investor_name || "—"],
        [t("investorAdmin.overview.organization"), detail.organization_name || "—"],
        [t("investorAdmin.overview.stage"), stageLabels[detail.stage] || detail.stage],
        [t("investorAdmin.overview.email"), detail.email || "—"],
        [t("investorAdmin.overview.date"), detail.stage_changed_at ? new Date(detail.stage_changed_at).toLocaleDateString() : "—"],
      ]
    : [];
  const profile = detail
    ? [
        [t("investorAdmin.overview.industries"), (detail.industries || []).join(", ")],
        [t("investorAdmin.overview.countries"), (detail.countries || []).join(", ")],
        [t("investorAdmin.overview.stages"), (detail.startup_stages || []).join(", ")],
        [t("investorAdmin.overview.ticket"), detail.ticket_size_min || detail.ticket_size_max ? `$${detail.ticket_size_min || "0"}–$${detail.ticket_size_max || "∞"}` : ""],
      ].filter(([, value]) => value)
    : [];

  return (
    <>
      <div className="stf-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", marginBottom: 0 }}>
        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <h3 className="stf-card-title" style={{ marginBottom: 2 }}>{t("investorAdmin.overview.dueDiligenceCount", { count: workspaces.length })}</h3>
          {workspaces.length === 0
            ? empty(t("investorAdmin.overview.noActiveDd"))
            : workspaces.map((workspace) =>
                row(
                  workspace.id,
                  workspace.venture_name || "—",
                  who(workspace),
                  <span className={`stf-tag ${workspace.status === "active" ? "b" : "g"}`}>{workspace.status}</span>,
                ),
              )}
        </div>

        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          <h3 className="stf-card-title" style={{ marginBottom: 2 }}>{t("investorAdmin.overview.introductionRequestsCount", { count: introductions.length })}</h3>
          {introductions.length === 0
            ? empty(t("investorAdmin.overview.noPendingIntroductionRequests"))
            : introductions.map((pipeline) =>
                row(
                  pipeline.id,
                  pipeline.venture_name || "—",
                  who(pipeline),
                  <>
                    {pipeline.notes && <MessageSquare size={14} style={{ color: "var(--stf-warn)" }} aria-label={pipeline.notes} />}
                    <span className="stf-tag w">{stageLabels[pipeline.stage] || pipeline.stage}</span>
                  </>,
                  () => setDetail(pipeline),
                ),
              )}
        </div>
      </div>

      <h3 className="stf-card-title" style={{ margin: "22px 0 10px" }}>{t("investorAdmin.overview.activePipelines")}</h3>
      {others.length === 0 ? (
        empty(t("investorAdmin.dashboard.noPipelineActivity"))
      ) : (
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          {others.map((pipeline) =>
            row(
              pipeline.id,
              pipeline.venture_name || "—",
              who(pipeline),
              <>
                {pipeline.investment_amount && <b style={{ fontSize: 12, color: "var(--stf-done)" }}>${Number(pipeline.investment_amount).toLocaleString()}</b>}
                <span className={`stf-tag ${STAGE_TONE[pipeline.stage] || ""}`}>{stageLabels[pipeline.stage] || pipeline.stage}</span>
              </>,
            ),
          )}
        </div>
      )}

      <h3 className="stf-card-title" style={{ margin: "22px 0 10px" }}>{t("investorAdmin.overview.informationRequestsCount", { count: requests.length })}</h3>
      {requests.length === 0 ? (
        empty(t("investorAdmin.overview.noRequests"))
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {requests.map((request) => (
            <div key={request.id} className="stf-card" style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <span className={`stf-tag ${CATEGORY_TONE[request.category] ?? ""}`}>{request.category}</span>
                  <span className={`stf-tag ${REQUEST_TONE[request.status] || ""}`}>{request.status}</span>
                </div>
                <b style={{ fontSize: 13 }}>{request.title}</b>
                <div className="stf-small" style={{ marginTop: 0 }}>{request.venture_name} · {request.investor_name}</div>
                {request.response_text && (
                  <div className="stf-small" style={{ color: "var(--stf-done)" }}>{t("investorAdmin.overview.response", { text: request.response_text })}</div>
                )}
              </div>
              <span className="stf-small" style={{ flexShrink: 0, margin: 0 }}>{new Date(request.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      <AppModal isOpen={!!detail} onClose={() => setDetail(null)} title={t("investorAdmin.overview.introductionRequest")} size="md">
        {detail && (
          <div className="stf stf-form">
            <div className="stf-grid" style={{ marginBottom: 0 }}>
              {facts.map(([label, value]) => (
                <div key={label} className="stf-card" style={{ padding: 12 }}>
                  <div className="stf-k">{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, wordBreak: "break-word" }}>{value}</div>
                </div>
              ))}
            </div>
            {profile.length > 0 && (
              <div className="stf-card" style={{ padding: 12, background: "var(--surface-2)" }}>
                <div className="stf-k" style={{ marginBottom: 8 }}>{t("investorAdmin.overview.investorProfile")}</div>
                <div className="stf-grid" style={{ marginBottom: 0 }}>
                  {profile.map(([label, value]) => (
                    <div key={label}>
                      <div className="stf-k">{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detail.notes ? (
              <div className="stf-card" style={{ padding: 12, borderColor: "color-mix(in srgb, var(--stf-warn) 40%, transparent)" }}>
                <div className="stf-k" style={{ display: "flex", gap: 6, alignItems: "center" }}><MessageSquare size={12} /> {t("investorAdmin.overview.investorMessage")}</div>
                <p style={{ fontSize: 13, marginTop: 6 }}>{detail.notes}</p>
              </div>
            ) : (
              <p className="stf-small" style={{ textAlign: "center" }}>{t("investorAdmin.overview.noMessageFromInvestor")}</p>
            )}
            <div className="stf-card" style={{ padding: 12, background: "var(--surface-2)" }}>
              <div className="stf-k" style={{ display: "flex", gap: 6, alignItems: "center" }}><UserPlus size={12} /> {t("investorAdmin.overview.actions")}</div>
              <p className="stf-small">{t("investorAdmin.overview.actionsHint")}</p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="stf-btn" onClick={() => setDetail(null)}>{t("investorAdmin.overview.close")}</button>
            </div>
          </div>
        )}
      </AppModal>
    </>
  );
}
