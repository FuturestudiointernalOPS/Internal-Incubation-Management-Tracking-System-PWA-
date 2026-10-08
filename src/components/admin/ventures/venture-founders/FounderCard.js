"use client";

import { Crown, Mail, Phone, Trash2, Ban, RefreshCw, MoreVertical } from "lucide-react";

export default function FounderCard({
  founder,
  openMenuId,
  setOpenMenuId,
  getRoleColor,
  handleReactivate,
  handleSuspend,
  handleRemove,
  handleRoleUpdate,
  setConfirmAction,
  setTransferTarget,
  setShowTransferModal,
  setTransferring,
  notify,
  t,
  id,
  venture,
  reload,
  ventureRoles,
}) {
  const isOwner = !!founder.is_owner;
  const isSuspended = !!founder.suspended_at;
  const isMenuOpen = openMenuId === founder.id;
  const roleColor = getRoleColor(founder.role);

  return (
    <div
      className={`p-5 rounded-2xl border transition-all ${
        isSuspended
          ? "bg-rose-500/5 border-rose-500/20 opacity-60"
          : isOwner
            ? "bg-amber-500/5 border-amber-500/20"
            : "bg-tertiary border-[var(--border-primary)] hover:border-brand-orange/30"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-black shrink-0 ${
            isOwner
              ? "bg-amber-500/20 text-amber-400 border-2 border-amber-500/30"
              : isSuspended
                ? "bg-rose-500/10 text-rose-500 border-2 border-rose-500/20"
                : "bg-primary border-2 border-[var(--border-primary)] text-[var(--text-primary)]"
          }`}>
            {founder.name?.charAt(0) || founder.email?.charAt(0) || "?"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                {founder.name || founder.email}
              </p>
              {isOwner && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5" /> {t("vadmin.founders.owner")}
                </span>
              )}
              {isSuspended && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                  {t("vadmin.founders.suspended")}
                </span>
              )}
              {founder.status === "pending" && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                  {t("vadmin.founders.pending")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${roleColor}`}>
                {founder.role_label || founder.role}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                <Mail className="w-3 h-3" /> {founder.email}
              </span>
              {founder.phone && (
                <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                  <Phone className="w-3 h-3" /> {founder.phone}
                </span>
              )}
            </div>
            {founder.invitation_expired && founder.status === "pending" && (
              <p className="text-[10px] text-rose-400 mt-1">{t("vadmin.founders.invitationExpired")}</p>
            )}
          </div>
        </div>

        {/* Actions Menu */}
        <div className="relative shrink-0">
          <button
            onClick={() => setOpenMenuId(isMenuOpen ? null : founder.id)}
            className="p-2 hover:bg-white/5 rounded-lg transition-all"
          >
            <MoreVertical className="w-4 h-4 text-slate-500" />
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
              <div className="absolute right-0 top-10 z-20 w-52 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-2 space-y-0.5">
                  {/* Role selector */}
                  <div className="px-3 py-2">
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">{t("vadmin.founders.changeRole")}</p>
                    <select
                      value={founder.role}
                      onChange={(event) => {
                        if (event.target.value !== founder.role) {
                          setConfirmAction({
                            title: t("vadmin.founders.updateRole"),
                            message: t("vadmin.founders.updateRoleMessage", {
                              name: founder.name,
                              current: founder.role,
                              new: event.target.value,
                            }),
                            confirmLabel: t("vadmin.founders.updateRole"),
                            onConfirm: () => handleRoleUpdate(founder.id, event.target.value),
                          });
                        }
                      }}
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold text-[var(--text-primary)] outline-none"
                    >
                      {ventureRoles.map((ventureRole) => (
                        <option key={ventureRole} value={ventureRole}>{ventureRole.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>

                  <div className="border-t border-[var(--border-primary)] mx-3" />

                  {!isOwner && (
                    <button
                      onClick={() => {
                        setConfirmAction({
                          title: t("vadmin.founders.transferOwnership"),
                          message: t("vadmin.founders.transferConfirmMessage", { name: founder.name }),
                          confirmLabel: t("vadmin.founders.transfer"),
                          onConfirm: async () => {
                            setTransferTarget(String(founder.id));
                            setOpenMenuId(null);
                            setShowTransferModal(false);
                            // Direct transfer
                            setTransferring(true);
                            try {
                              const response = await fetch(`/api/ventures/${id}/founders/transfer-ownership`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ new_owner_id: founder.id }),
                              });
                              const data = await response.json();
                              if (data.success) {
                                notify(t("vadmin.founders.ownershipTransferred"));
                                setConfirmAction(null);
                                reload();
                              } else {
                                notify(t((data.error || t("vadmin.founders.transferFailed")) || "") || (data.error || t("vadmin.founders.transferFailed")), "error");
                                setConfirmAction(null);
                              }
                            } catch { notify(t("vadmin.founders.networkError"), "error"); setConfirmAction(null); }
                            setTransferring(false);
                          },
                        });
                      }}
                      className="w-full text-left px-3 py-2 text-[10px] font-bold text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all flex items-center gap-2"
                    >
                      <Crown className="w-3 h-3" /> {t("vadmin.founders.transferOwnership")}
                    </button>
                  )}

                  {isSuspended ? (
                    <button
                      onClick={() => handleReactivate(founder.id)}
                      className="w-full text-left px-3 py-2 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all flex items-center gap-2"
                    >
                      <RefreshCw className="w-3 h-3" /> {t("vadmin.founders.reactivate")}
                    </button>
                  ) : (
                    !isOwner && (
                      <button
                        onClick={() => handleSuspend(founder.id)}
                        className="w-full text-left px-3 py-2 text-[10px] font-bold text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all flex items-center gap-2"
                      >
                        <Ban className="w-3 h-3" /> {t("vadmin.founders.suspend")}
                      </button>
                    )
                  )}

                  {!isOwner && (
                    <>
                      <div className="border-t border-[var(--border-primary)] mx-3" />
                      <button
                        onClick={() => {
                          setConfirmAction({
                            title: t("vadmin.founders.removeFounder"),
                            message: t("vadmin.founders.removeConfirmMessage", {
                              name: founder.name,
                              company: venture.company_name,
                            }),
                            confirmLabel: t("vadmin.founders.remove"),
                            variant: "danger",
                            onConfirm: () => handleRemove(founder.id),
                          });
                          setOpenMenuId(null);
                        }}
                        className="w-full text-left px-3 py-2 text-[10px] font-bold text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" /> {t("vadmin.founders.remove")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
