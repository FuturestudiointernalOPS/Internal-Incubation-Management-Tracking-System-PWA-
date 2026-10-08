"use client";

import {
  ArrowLeft,
  User,
  Crown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  UserPlus,
} from "lucide-react";

import FounderCard from "./venture-founders/FounderCard";
import InviteModal from "./venture-founders/InviteModal";
import TransferModal from "./venture-founders/TransferModal";
import ConfirmDialog from "./venture-founders/ConfirmDialog";

const VENTURE_ROLES = [
  "founder",
  "co-founder",
  "ceo",
  "cto",
  "coo",
  "cfo",
  "cmo",
  "cpo",
  "cio",
  "product_manager",
  "engineering_manager",
  "marketing_lead",
  "sales_lead",
  "operations_lead",
  "finance_lead",
  "hr_lead",
  "legal_lead",
  "advisor",
  "observer",
];

export default function VentureFoundersView({ ctx }) {
  const {
    loading,
    confirmAction,
    error,
    filteredFounders,
    founders,
    getRoleColor,
    handleInvite,
    handleReactivate,
    handleRemove,
    handleRoleUpdate,
    handleSuspend,
    id,
    inviteForm,
    inviting,
    notify,
    openMenuId,
    reload,
    router,
    searchQuery,
    setConfirmAction,
    setInviteForm,
    setOpenMenuId,
    setSearchQuery,
    setShowInviteModal,
    setShowTransferModal,
    setTransferTarget,
    setTransferring,
    showInviteModal,
    showTransferModal,
    t,
    toast,
    transferring,
    venture,
  } = ctx;

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
        </div>
      </>
    );
  }

  if (error || !venture) {
    return (
      <>
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t("vadmin.founders.errorTitle")}</h2>
          <p className="text-[var(--text-secondary)] mb-6">{error || t("vadmin.founders.ventureNotFound")}</p>
          <button onClick={() => router.push("/admin/ventures")} className="btn btn-primary">
            {t("vadmin.founders.backToVentures")}
          </button>
        </div>
      </>
    );
  }

  const owner = founders.find((founder) => founder.is_owner);

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${
            toast.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
          }`}>
            {toast.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button
              onClick={() => router.push(`/admin/ventures/${id}`)}
              className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-3"
            >
              <ArrowLeft className="w-3 h-3" /> {t("vadmin.founders.backToVenture", { name: venture.company_name })}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center">
                <User className="w-6 h-6 text-[var(--brand-orange)]" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
                  {t("vadmin.founders.title")}
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {venture.company_name} · {t("vadmin.founders.memberCount", { count: founders.length })}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1 max-w-2xl">
                  {t("vadmin.founders.ledgerHint")}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowTransferModal(true)}
              disabled={!owner}
              className="px-4 py-2.5 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary transition-all disabled:opacity-30 flex items-center gap-2"
            >
              <Crown className="w-3.5 h-3.5" /> {t("vadmin.founders.transferOwnership")}
            </button>
            {/* Adding a member starts from the Venture itself (the founder sends
                an email invitation). Disabled here on purpose. */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={t("vadmin.founders.inviteDisabledHint")}
              className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 opacity-40 cursor-not-allowed"
            >
              <UserPlus className="w-3.5 h-3.5" /> {t("vadmin.founders.inviteMember")}
            </button>
          </div>
        </div>

        {/* Owner Badge */}
        {owner && (
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {owner.name} · {owner.email}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">{t("vadmin.founders.ownerHint")}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder={t("vadmin.founders.searchPlaceholder")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-secondary border border-[var(--border-primary)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-brand-orange/50 transition-all"
          />
        </div>

        {/* Founder List */}
        {filteredFounders.length === 0 ? (
          <div className="text-center py-20">
            <User className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              {searchQuery ? t("vadmin.founders.noMatches") : t("vadmin.founders.noFounders")}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              {searchQuery ? t("vadmin.founders.tryDifferentSearch") : t("vadmin.founders.inviteFirstMember")}
            </p>
            {!searchQuery && (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title={t("vadmin.founders.inviteDisabledHint")}
                className="btn btn-primary gap-2 opacity-40 cursor-not-allowed"
              >
                <UserPlus className="w-4 h-4" /> {t("vadmin.founders.inviteMember")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFounders.map((founder) => (
              <FounderCard
                key={founder.id}
                founder={founder}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                getRoleColor={getRoleColor}
                handleReactivate={handleReactivate}
                handleSuspend={handleSuspend}
                handleRemove={handleRemove}
                handleRoleUpdate={handleRoleUpdate}
                setConfirmAction={setConfirmAction}
                setTransferTarget={setTransferTarget}
                setShowTransferModal={setShowTransferModal}
                setTransferring={setTransferring}
                notify={notify}
                t={t}
                id={id}
                venture={venture}
                reload={reload}
                ventureRoles={VENTURE_ROLES}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Invite Modal ── */}
      {showInviteModal && (
        <InviteModal
          setShowInviteModal={setShowInviteModal}
          inviteForm={inviteForm}
          setInviteForm={setInviteForm}
          inviting={inviting}
          handleInvite={handleInvite}
          t={t}
          ventureRoles={VENTURE_ROLES}
        />
      )}

      {/* ── Transfer Ownership Modal ── */}
      {showTransferModal && (
        <TransferModal
          setShowTransferModal={setShowTransferModal}
          founders={founders}
          setConfirmAction={setConfirmAction}
          setTransferTarget={setTransferTarget}
          setTransferring={setTransferring}
          notify={notify}
          t={t}
          id={id}
          reload={reload}
        />
      )}

      {/* ── Confirmation Dialog ── */}
      {confirmAction && (
        <ConfirmDialog
          confirmAction={confirmAction}
          setConfirmAction={setConfirmAction}
          transferring={transferring}
          t={t}
        />
      )}
    </>
  );
}
