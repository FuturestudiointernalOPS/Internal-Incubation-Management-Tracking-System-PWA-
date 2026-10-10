"use client";

/**
 * OPEN ACTIONS — the administrable list of API actions that carry NO permission
 * decision (spec §13), and WHY each is acceptable. Two families:
 *   - personal (self-scoped): open to any connected user, target = themselves;
 *   - open by design: public intake / auth flow / token / scheduled / webhook.
 *
 * Read-only: it reports the declaration ratchets the static guards enforce, so
 * an administrator can SEE what is open instead of inferring it.
 */

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Cell, EmptyRow, HeadCell, Note, Pill, PrototypeTable } from "../prototypeUi";

export default function OpenActionsTab() {
  const { t } = useI18n();
  const [state, setState] = useState({
    loading: true,
    error: false,
    selfScoped: [],
    openAssumed: [],
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/engineering/permissions/open-actions")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success) {
          setState({
            loading: false,
            error: false,
            selfScoped: data.selfScoped || [],
            openAssumed: data.openAssumed || [],
          });
        } else {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false, error: true }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const heading = (title, hint) => (
    <div className="space-y-1">
      <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
    </div>
  );

  const table = (rows, renderKind) => (
    <PrototypeTable minWidth="48rem">
      <thead>
        <tr>
          <HeadCell>{t("engineering.permissions.openActionsColRoute")}</HeadCell>
          <HeadCell>{t("engineering.permissions.openActionsColKind")}</HeadCell>
          <HeadCell>{t("engineering.permissions.openActionsColReason")}</HeadCell>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyRow colSpan={3} label={t("engineering.permissions.openActionsEmpty")} />
        ) : (
          rows.map((row) => (
            <tr key={row.file}>
              <Cell>
                <span className="font-mono text-xs text-[var(--text-primary)]">
                  {String(row.file).replace(/^src\/app\/api\//, "")}
                </span>
              </Cell>
              <Cell>{renderKind(row)}</Cell>
              <Cell>
                <span className="text-xs text-[var(--text-secondary)]">{row.reason}</span>
              </Cell>
            </tr>
          ))
        )}
      </tbody>
    </PrototypeTable>
  );

  return (
    <div className="space-y-6">
      <Note>{t("engineering.permissions.openActionsIntro")}</Note>

      <section className="space-y-2">
        {heading(
          t("engineering.permissions.openActionsSelfScoped"),
          t("engineering.permissions.openActionsSelfScopedHint"),
        )}
        {table(state.selfScoped, (row) => (
          <Pill tone="neutral">{row.scope}</Pill>
        ))}
      </section>

      <section className="space-y-2">
        {heading(
          t("engineering.permissions.openActionsOpenAssumed"),
          t("engineering.permissions.openActionsOpenAssumedHint"),
        )}
        {table(state.openAssumed, (row) => (
          <Pill tone="neutral">
            {t(`engineering.permissions.openActionsKind.${row.kind}`)}
          </Pill>
        ))}
      </section>

      {state.loading && <Note>{t("engineering.permissions.openActionsLoading")}</Note>}
      {state.error && <Note>{t("engineering.permissions.openActionsError")}</Note>}
    </div>
  );
}
