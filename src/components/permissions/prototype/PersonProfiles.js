"use client";

/**
 * Person ▸ Profiles — the profile-assignment registry FOR ONE PERSON, inside the
 * prototype's person detail.
 *
 * The write the profile-assignment API has always offered (`POST` to open a
 * period, `PATCH` to close it) had no door on the live centre: it lived on the
 * retired editor. This tab is that door — pick a catalogue profile, assign it,
 * and see every period held, active or ended.
 *
 * The registry DESCRIBES; it decides no access on its own (Phase C). Assigning
 * a profile changes which eligibility ceilings apply to the person, so the
 * parent re-reads the resolver's own answer through `onChanged`.
 */

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { notify } from "@/lib/notify";
import { defer } from "../effectUtils";
import { Cell, EmptyRow, HeadCell, Note, Pill, PrototypeTable } from "./prototypeUi";

const SOURCE_LABEL_KEY = {
  manual: "engineering.permissions.profileAssignmentsSourceManual",
  automatic: "engineering.permissions.profileAssignmentsSourceAutomatic",
};
const STATUS_LABEL_KEY = {
  active: "engineering.permissions.profileAssignmentsStatusActive",
  ended: "engineering.permissions.profileAssignmentsStatusEnded",
  revoked: "engineering.permissions.profileAssignmentsStatusRevoked",
};
const STATUS_TONE = { active: "ok", ended: "neutral", revoked: "crit" };

/** The already-active refusal is the one error worth its own words. */
function assignmentError(raw, t) {
  if (raw === "this profile is already active for this person") {
    return t("engineering.permissions.profileAssignmentsAlreadyActive");
  }
  if (typeof raw === "string" && raw.startsWith("errors.") && t(raw) !== raw) return t(raw);
  return raw || t("engineering.permissions.profileAssignmentsAssignFailed");
}

export default function PersonProfiles({ cid, data, onChanged }) {
  const { t, lang } = useI18n();
  const { confirm } = useDialogs();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const profiles = (data?.profiles || []).filter((profile) => Number(profile.is_active) !== 0);

  const load = useCallback(async () => {
    if (!cid) return;
    try {
      const response = await fetch(
        `/api/engineering/permissions/profile-assignments?cid=${encodeURIComponent(cid)}`,
      );
      const json = await response.json();
      setAssignments(json?.success ? json.assignments || [] : []);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [cid]);

  useEffect(() => {
    defer(() => load());
  }, [load]);

  const assign = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      const response = await fetch("/api/engineering/permissions/profile-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid, profile_key: picked }),
      });
      const json = await response.json().catch(() => ({}));
      if (!json?.success) throw new Error(assignmentError(json?.error, t));
      notify("success", t("engineering.permissions.profileAssignmentsAssigned"));
      setPicked("");
      await load();
      onChanged?.();
    } catch (error) {
      notify("error", error.message || t("engineering.permissions.profileAssignmentsAssignFailed"));
    } finally {
      setBusy(false);
    }
  };

  const close = async (row) => {
    const accepted = await confirm({
      message: t("engineering.permissions.profileAssignmentsCloseConfirm"),
      tone: "danger",
      confirmLabel: t("engineering.permissions.profileAssignmentsClose"),
      cancelLabel: t("common.cancel"),
    });
    if (!accepted) return;
    setBusyId(row.id);
    try {
      const response = await fetch("/api/engineering/permissions/profile-assignments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, action: "close" }),
      });
      const json = await response.json().catch(() => ({}));
      if (!json?.success) throw new Error(json?.error || t("engineering.permissions.profileAssignmentsCloseFailed"));
      notify("success", t("engineering.permissions.profileAssignmentsClosed"));
      await load();
      onChanged?.();
    } catch (error) {
      notify("error", error.message || t("engineering.permissions.profileAssignmentsCloseFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const labelFor = (key) =>
    data?.profiles?.find((profile) => profile.key === key)?.name || String(key).replace(/_/g, " ");
  const contextLabel = (context) =>
    t(`engineering.permissions.contextRolesContexts.${context}`);
  const fmtDate = (value) => (value ? new Date(value).toLocaleDateString(lang) : null);
  const periodOf = (row) =>
    `${fmtDate(row.started_at)} → ${
      row.ends_at ? fmtDate(row.ends_at) : t("engineering.permissions.profileAssignmentsOpenEnded")
    }`;

  return (
    <>
      <Note>{t("engineering.permissions.profileAssignmentsHint")}</Note>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <select
          value={picked}
          onChange={(event) => setPicked(event.target.value)}
          aria-label={t("engineering.permissions.profileAssignmentsSelectProfile")}
          className="min-w-56 flex-1 rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-surface-1 px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        >
          <option value="">{t("engineering.permissions.profileAssignmentsSelectProfile")}</option>
          {profiles.map((profile) => (
            <option key={profile.key} value={profile.key}>
              {profile.name}
            </option>
          ))}
        </select>
        <AppButton onClick={assign} disabled={!picked} loading={busy}>
          {t("engineering.permissions.profileAssignmentsAssign")}
        </AppButton>
      </div>

      <PrototypeTable minWidth="40rem">
        <thead>
          <tr>
            <HeadCell>{t("engineering.permissions.profileAssignmentsProfile")}</HeadCell>
            <HeadCell>{t("engineering.permissions.profileAssignmentsContext")}</HeadCell>
            <HeadCell>{t("engineering.permissions.profileAssignmentsPeriod")}</HeadCell>
            <HeadCell>{t("engineering.permissions.profileAssignmentsSource")}</HeadCell>
            <HeadCell>{t("engineering.permissions.profileAssignmentsStatus")}</HeadCell>
            <HeadCell />
          </tr>
        </thead>
        <tbody>
          {loading && <EmptyRow colSpan={6} label={t("common.loading")} />}
          {!loading && assignments.length === 0 && (
            <EmptyRow colSpan={6} label={t("engineering.permissions.profileAssignmentsEmpty")} />
          )}
          {!loading &&
            assignments.map((row) => (
              <tr key={row.id}>
                <Cell className="font-bold">{labelFor(row.profile_key)}</Cell>
                <Cell>
                  {contextLabel(row.context_type)}
                  {row.context_id ? ` · ${row.context_id}` : ""}
                </Cell>
                <Cell>{periodOf(row)}</Cell>
                <Cell>
                  <Pill tone="neutral">{t(SOURCE_LABEL_KEY[row.source] || SOURCE_LABEL_KEY.manual)}</Pill>
                </Cell>
                <Cell>
                  <Pill tone={STATUS_TONE[row.status] || "neutral"}>
                    {t(STATUS_LABEL_KEY[row.status] || STATUS_LABEL_KEY.ended)}
                  </Pill>
                </Cell>
                <Cell className="text-right">
                  {row.status === "active" && (
                    <AppButton
                      variant="danger"
                      size="sm"
                      onClick={() => close(row)}
                      loading={busyId === row.id}
                    >
                      {t("engineering.permissions.profileAssignmentsClose")}
                    </AppButton>
                  )}
                </Cell>
              </tr>
            ))}
        </tbody>
      </PrototypeTable>
    </>
  );
}
