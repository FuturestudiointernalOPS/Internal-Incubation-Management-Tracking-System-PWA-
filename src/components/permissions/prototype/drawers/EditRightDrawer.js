"use client";

/**
 * "Modifier…" — the prototype's right editor: Accorder / Restreindre, the
 * level, the before → after preview, the risk rating and the mandatory motif
 * on a high or critical change.
 *
 * The four actions are the ones the write API really has: grant, restrict,
 * revoke and unrestrict. A capability that is currently blocked cannot be
 * granted on top of the block (a restriction beats every source), so
 * "Accorder" lifts the block first — two writes, one intent.
 */

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppDrawer from "@/components/ui/AppDrawer";
import AppButton from "@/components/ui/AppButton";
import { notify } from "@/lib/notify";
import { CONTROL_CLASS, Field, Pill } from "../prototypeUi";
import { changeRisk, levelLabel } from "../personAccess";

const RISK_TONE = { normal: "ok", high: "warn", critical: "crit" };

async function put(body) {
  const response = await fetch("/api/engineering/permissions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "save failed");
  }
  return data;
}

export default function EditRightDrawer({ person, row, onClose, onSaved }) {
  const { t } = useI18n();
  const available = useMemo(() => {
    const actions = ["grant"];
    if (row.restricted) actions.unshift("unrestrict");
    else {
      actions.push("restrict");
      if (row.origin === "direct") actions.push("revoke");
    }
    return actions;
  }, [row]);

  const [action, setAction] = useState(row.restricted ? "unrestrict" : "grant");
  const [level, setLevel] = useState(Math.max(1, row.level || 3));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const effectiveBefore = row.restricted ? 0 : row.level;
  const targetLevel =
    action === "grant"
      ? Number(level)
      : action === "unrestrict"
        ? row.level || 1
        : 0;
  const risk = changeRisk(action === "restrict" || action === "revoke" ? "restrict" : "grant", effectiveBefore, targetLevel);
  const needsReason = risk !== "normal";

  const before = row.restricted
    ? t("engineering.permissions.prototype.revoked")
    : levelLabel(effectiveBefore, t);
  const after =
    action === "grant"
      ? levelLabel(Number(level), t)
      : action === "unrestrict"
        ? levelLabel(row.level, t)
        : t("engineering.permissions.prototype.revoked");

  const label = {
    grant: t("engineering.permissions.prototype.actionGrant"),
    restrict: t("engineering.permissions.prototype.actionRestrict"),
    revoke: t("engineering.permissions.prototype.actionRevoke"),
    unrestrict: t("engineering.permissions.prototype.actionUnrestrict"),
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const base = {
        user_cid: person.cid,
        module: row.module,
        capability: row.capability,
        reason: reason.trim() || undefined,
      };
      // A block beats every source: lift it before granting on top of it.
      if (action === "grant" && row.restricted) await put({ ...base, action: "unrestrict" });
      if (action === "grant") {
        await put({ ...base, action: "grant", access_level: Number(level) });
      } else {
        await put({ ...base, action });
      }
      notify("success", t("engineering.permissions.prototype.changeApplied"));
      onSaved?.();
      onClose();
    } catch (caught) {
      setError(caught?.message || t("engineering.permissions.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppDrawer
      isOpen
      onClose={onClose}
      title={`${row.module} ▸ ${row.capability}`}
      footer={
        <>
          <AppButton onClick={confirm} disabled={busy || (needsReason && !reason.trim())} loading={busy}>
            {t("common.confirm")}
          </AppButton>
          <AppButton variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </AppButton>
        </>
      }
    >
      <p className="text-xs text-[var(--text-secondary)]">{person.name || person.cid}</p>

      <Field label={t("engineering.permissions.prototype.actionLabel")}>
        <select className={CONTROL_CLASS} value={action} onChange={(event) => setAction(event.target.value)}>
          {available.map((item) => (
            <option key={item} value={item}>
              {label[item]}
            </option>
          ))}
        </select>
      </Field>

      {action === "grant" && (
        <Field label={t("engineering.permissions.prototype.level")}>
          <select className={CONTROL_CLASS} value={level} onChange={(event) => setLevel(event.target.value)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {levelLabel(value, t)}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-surface-2 p-3 text-sm">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t("engineering.permissions.prototype.beforeAfter")}
        </p>
        <p className="text-[var(--text-primary)]">
          {before} → <b>{after}</b>
        </p>
        <p className="mt-2 flex items-center gap-2">
          <span className="text-[var(--text-secondary)]">{t("engineering.permissions.prototype.risk")}:</span>
          <Pill tone={RISK_TONE[risk]}>{t(`engineering.permissions.prototype.risk.${risk}`)}</Pill>
        </p>
        {needsReason && (
          <Field label={t("engineering.permissions.prototype.reasonRequired")}>
            <textarea
              rows={3}
              className={`${CONTROL_CLASS} w-full`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        )}
      </div>

      {error && <p className="text-xs text-rose-500">{error}</p>}
    </AppDrawer>
  );
}
