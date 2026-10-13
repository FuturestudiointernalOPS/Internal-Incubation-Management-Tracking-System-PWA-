"use client";

import { useEffect, useState } from "react";
import AppModal from "@/components/ui/AppModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";

/** Fetch `url` once and expose what it answered. */
function useLoaded(url) {
  const { t } = useI18n();
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (!alive) return;
        if (data.success) setState({ loading: false, data, error: "" });
        else setState({ loading: false, data: null, error: t(data.error || "errors.somethingWrong") });
      })
      .catch(() => {
        if (alive) setState({ loading: false, data: null, error: t("errors.somethingWrong") });
      });
    return () => {
      alive = false;
    };
  }, [url, t]);

  return state;
}

function ListBody({ state, empty, children }) {
  if (state.loading) return <Skeleton className="h-24 w-full" />;
  if (state.error) return <p className="text-sm text-red-500">{state.error}</p>;
  return children || <p className="text-sm text-[var(--text-secondary)]">{empty}</p>;
}

/** The leads or opportunities a segment currently contains. */
export function CrmSegmentMembersModal({ segment, onClose }) {
  const { t } = useI18n();
  const state = useLoaded(`/api/crm/segments/${segment.id}`);
  const members = state.data?.members ?? [];
  const isOpportunity = segment.entity_type === "opportunity";

  return (
    <AppModal isOpen onClose={onClose} title={segment.name} size="lg">
      <ListBody state={state} empty={t("crm.intelligence.segments.noMembers")}>
        {members.length > 0 && (
          <>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              {t("crm.intelligence.segments.memberCount", { count: members.length })}
            </p>
            <ul className="divide-y divide-[var(--border-primary)]">
              {members.map((member) => (
                <li key={member.id} className="py-2 flex items-center justify-between gap-3">
                  <a
                    href={isOpportunity ? `/crm/opportunities/${member.id}` : `/crm/leads/${member.id}`}
                    className="text-sm font-semibold text-[var(--brand-orange)] hover:underline"
                  >
                    {isOpportunity ? member.name : member.title}
                  </a>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {member.organization_name || member.contact_name || "—"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </ListBody>
    </AppModal>
  );
}

const EXECUTION_TONE = {
  success: "text-emerald-500 bg-emerald-500/10",
  failed: "text-rose-500 bg-rose-500/10",
  skipped: "text-[var(--text-secondary)] bg-[var(--surface-3)]",
};

/** The execution log of an automation rule, most recent first. */
export function CrmAutomationExecutionsModal({ rule, onClose }) {
  const { t } = useI18n();
  const state = useLoaded(`/api/crm/automations/${rule.id}`);
  const executions = state.data?.executions ?? [];

  return (
    <AppModal isOpen onClose={onClose} title={`${t("crm.intelligence.automations.executions")} — ${rule.name}`} size="lg">
      <ListBody state={state} empty={t("crm.intelligence.automations.noExecutions")}>
        {executions.length > 0 && (
          <ul className="divide-y divide-[var(--border-primary)]">
            {executions.map((execution) => (
              <li key={execution.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    href={execution.entity_type === "opportunity"
                      ? `/crm/opportunities/${execution.entity_id}`
                      : `/crm/leads/${execution.entity_id}`}
                    className="text-sm font-semibold text-[var(--brand-orange)] hover:underline"
                  >
                    {t(`crm.intelligence.common.${execution.entity_type}`)}
                  </a>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {formatDate(new Date(execution.completed_at || execution.started_at))}
                  </p>
                  {execution.error && <p className="text-xs text-rose-500 mt-1">{execution.error}</p>}
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-bold uppercase ${EXECUTION_TONE[execution.status] ?? EXECUTION_TONE.skipped}`}>
                  {t(`crm.intelligence.automations.executionStatus.${execution.status}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ListBody>
    </AppModal>
  );
}
