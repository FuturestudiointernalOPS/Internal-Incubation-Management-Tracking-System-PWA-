"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Shield,
  UserPlus,
  History,
  RotateCcw,
  Ban,
  UserX,
  Eye,
  Building2,
  Link2,
} from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { deriveMembershipStatus, sortGroups } from "@/lib/membership-ui";
import {
  STATUS_STYLE,
  Badge,
  runMembershipAction,
  AddMemberModal,
  RenewModal,
  ConfirmModal,
  HistoryModal,
} from "@/components/membership/MembershipModals";

/**
 * Organizational Membership section for the CRM contact profile.
 *
 * Renders CURRENT vs PAST memberships for one contact, with the full
 * lifecycle (add / renew / end / reactivate / history) and a deep link to
 * the Permissions Control Center. Role and group stay visibly separate —
 * membership is a CRM relationship, authorization lives elsewhere.
 *
 * All mutations go through PUT /api/org-membership (org_membership.manage,
 * server-side). The UI never is the security boundary.
 */
export default function MembershipSection({ cid, t, lang }) {
  const [memberships, setMemberships] = useState(null); // all rows (also sources the group catalog)
  const [protectedMap, setProtectedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [renewMember, setRenewMember] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [historyMember, setHistoryMember] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/org-membership");
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "—");
        return;
      }
      setMemberships(data.memberships || []);
      setProtectedMap(data.protected || {});
    } catch {
      setError("—");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const mine = useMemo(
    () => (memberships || []).filter((m) => String(m.user_cid) === String(cid)),
    [memberships, cid],
  );

  const current = mine.filter((m) => ["active", "expiringSoon"].includes(deriveMembershipStatus(m)));
  const past = mine.filter((m) => ["expired", "ended"].includes(deriveMembershipStatus(m)));

  const groups = useMemo(
    () =>
      sortGroups(
        [...new Set((memberships || []).map((m) => m.group_name).filter(Boolean))].map((name) => ({
          name,
          isProtected: !!protectedMap[name],
        })),
      ),
    [memberships, protectedMap],
  );

  const fmtDate = useCallback(
    (v) => {
      if (!v) return "—";
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    },
    [lang],
  );

  const statusKey = (status) => {
    switch (status) {
      case "expiringSoon":
        return t("membership.status.expiringSoon");
      case "expired":
        return t("membership.status.expired");
      case "ended":
        return t("membership.status.ended");
      default:
        return t("membership.status.active");
    }
  };

  const reload = () => {
    setHistoryMember(null);
    fetchAll();
  };

  const handleAction = async () => {
    if (!confirmState) return;
    const ok = await runMembershipAction(confirmState.member, confirmState.action, t);
    if (ok) {
      setConfirmState(null);
      reload();
    }
  };

  const handleRenew = async (expiresAt) => {
    if (!renewMember) return false;
    const ok = await runMembershipAction(renewMember, "renewed", t, {
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
    if (ok) {
      setRenewMember(null);
      reload();
    }
    return ok;
  };

  const isProtected = (name) => !!protectedMap[name];

  const renderCard = (m) => {
    const derived = deriveMembershipStatus(m);
    const isActive = derived === "active" || derived === "expiringSoon";
    return (
      <div
        key={`${m.user_cid}|${m.group_name}`}
        className="rounded-xl p-4"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border-primary)",
          opacity: isActive ? 1 : 0.65,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
            <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
              {m.group_name}
              {isProtected(m.group_name) && <Shield className="w-3.5 h-3.5" style={{ color: "#F59E0B" }} />}
            </span>
            {isProtected(m.group_name) && (
              <span
                className="px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase"
                style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B" }}
              >
                {t("membership.page.protected")}
              </span>
            )}
            <Badge label={statusKey(derived)} style={STATUS_STYLE[derived] || STATUS_STYLE.active} />
          </div>
          <div className="flex items-center gap-1.5">
            {isActive ? (
              <>
                <AppButton variant="ghost" size="sm" icon={RotateCcw} onClick={() => setRenewMember(m)}>
                  {t("membership.actions.renew")}
                </AppButton>
                <AppButton
                  variant="ghost"
                  size="sm"
                  icon={Ban}
                  onClick={() => setConfirmState({ member: m, action: "deactivated" })}
                >
                  {t("membership.actions.deactivate")}
                </AppButton>
                <AppButton
                  variant="ghost"
                  size="sm"
                  icon={UserX}
                  onClick={() => setConfirmState({ member: m, action: "ended" })}
                >
                  {t("membership.actions.end")}
                </AppButton>
              </>
            ) : (
              <>
                <AppButton variant="ghost" size="sm" icon={RotateCcw} onClick={() => setRenewMember(m)}>
                  {m.status === "ended" ? t("membership.actions.reactivate") : t("membership.actions.renew")}
                </AppButton>
                <AppButton variant="ghost" size="sm" icon={History} onClick={() => setHistoryMember(m)}>
                  {t("membership.actions.history")}
                </AppButton>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[10px]" style={{ color: "var(--text-secondary)" }}>
          <span>
            {t("membership.columns.start")}: <b style={{ color: "var(--text-primary)" }}>{fmtDate(m.started_at)}</b>
          </span>
          <span>
            {t("membership.columns.expires")}:{" "}
            <b style={{ color: "var(--text-primary)" }}>
              {m.expires_at ? fmtDate(m.expires_at) : t("membership.status.never")}
            </b>
          </span>
          <span>
            {t("membership.columns.role")}: <b style={{ color: "var(--text-primary)" }}>{m.role || "—"}</b>
          </span>
          <span>
            {t("membership.columns.accountStatus")}:{" "}
            <b style={{ color: "var(--text-primary)" }}>{m.account_status || "—"}</b>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header row: actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>
          {t("membership.detail.accessHint")}
        </p>
        <div className="flex items-center gap-2">
          <AppButton variant="ghost" size="sm" icon={UserPlus} onClick={() => setAddOpen(true)}>
            {t("membership.page.addMember")}
          </AppButton>
          <a href={`/admin/security/permissions?cid=${encodeURIComponent(cid)}`}>
            <AppButton variant="secondary" size="sm" icon={Eye}>
              {t("membership.detail.viewEffectiveAccess")}
            </AppButton>
          </a>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--surface-3)" }} />
          ))}
        </div>
      ) : error ? (
        <AppEmptyState title={t("membership.page.loadError")} icon={Link2} />
      ) : (
        <>
          {/* Current memberships */}
          <section>
            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--text-tertiary)" }}>
              {t("membership.section.current")}
            </p>
            {current.length === 0 ? (
              <div
                className="rounded-xl p-4 text-[10px]"
                style={{ background: "var(--surface-2)", border: "1px dashed var(--border-primary)", color: "var(--text-tertiary)" }}
              >
                {t("membership.section.empty")}
              </div>
            ) : (
              <div className="space-y-3">{current.map(renderCard)}</div>
            )}
          </section>

          {/* Past memberships */}
          {past.length > 0 && (
            <section>
              <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--text-tertiary)" }}>
                {t("membership.section.past")}
              </p>
              <div className="space-y-3">{past.map(renderCard)}</div>
            </section>
          )}
        </>
      )}

      {addOpen && (
        <AddMemberModal
          groups={groups}
          defaultGroup={groups[0] ? groups[0].name : ""}
          isProtected={isProtected}
          existing={memberships || []}
          t={t}
          lang={lang}
          onClose={() => setAddOpen(false)}
          onAdded={() => {
            setAddOpen(false);
            reload();
          }}
        />
      )}
      {renewMember && (
        <RenewModal
          member={renewMember}
          isReactivate={deriveMembershipStatus(renewMember) === "ended"}
          t={t}
          lang={lang}
          fmtDate={fmtDate}
          onClose={() => setRenewMember(null)}
          onConfirm={handleRenew}
        />
      )}
      {confirmState && (
        <ConfirmModal state={confirmState} t={t} onClose={() => setConfirmState(null)} onConfirm={handleAction} />
      )}
      {historyMember && (
        <HistoryModal member={historyMember} t={t} lang={lang} fmtDate={fmtDate} onClose={() => setHistoryMember(null)} />
      )}
    </div>
  );
}
