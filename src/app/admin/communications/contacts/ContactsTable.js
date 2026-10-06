"use client";

import {
  Search,
  Edit3,
  Send,
  Archive,
  Trash2,
  RotateCcw,
  Mail,
  UserCheck,
  UserX,
  TrendingUp,
} from "lucide-react";
import { TableSkeleton } from "@/components/ui/Skeleton";
import {
  CONTACT_STATUS_LABELS,
  INVITATION_STATUS_LABELS,
  GROUP_LABELS,
  isInternalContact,
} from "./contactsConstants";

export function ContactsTable({
  t,
  loading,
  paginated,
  teams,
  statusFilter,
  isProcessing,
  search,
  selectedGroup,
  toggleStatus,
  handleInviteContact,
  handleResendActivation,
  openEditContact,
  handlePivotToEntity,
  handleArchive,
  handleRestore,
  handleSoftDelete,
  clearFilters,
}) {
  if (loading) {
    return <TableSkeleton rows={8} />;
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t("crm.contacts.identity")}</th>
            <th>{t("crm.contacts.groupStatus")}</th>
            <th className="text-right">{t("crm.contacts.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((contact) => (
            <tr key={contact.cid} className="group">
              <td>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight">
                    {contact.name}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    {contact.email}
                  </span>
                </div>
              </td>
              <td>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-primary border border-[var(--border-primary)] rounded text-[10px] font-bold uppercase text-[var(--brand-orange)]">
                      {t(GROUP_LABELS[contact.group_name] || "") || contact.group_name || t("crm.contacts.individual")}
                    </span>
                    {contact.v2_team_id && (
                      <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold uppercase text-blue-500">
                        {teams.find((team) => team.id === contact.v2_team_id)
                          ?.name || t("crm.contacts.subteam")}
                      </span>
                    )}
                  </div>
                  <span
                    className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      contact.status === "pending"
                        ? "bg-orange-500/10 text-orange-400"
                        : contact.status === "inactive"
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    {t(CONTACT_STATUS_LABELS[contact.status] || "") || contact.status}
                  </span>
                  <span
                    className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      contact.invitation_status === "activated"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : contact.invitation_status === "sent"
                          ? "bg-orange-500/10 text-orange-400"
                          : contact.invitation_status === "expired"
                            ? "bg-rose-500/10 text-rose-400"
                            : "bg-white/5 text-[var(--text-tertiary)]"
                    }`}
                  >
                    {t(INVITATION_STATUS_LABELS[contact.invitation_status] || "") || contact.invitation_status}
                  </span>
                  {!isInternalContact(contact) && (
                    <span
                      title={
                        contact.activation_email_status === "failed"
                          ? (contact.activation_email_error || t("crm.contacts.activationEmailFailed"))
                          : contact.activation_email_sent_at
                            ? `${t("crm.contacts.activationEmailSent")} — ${new Date(contact.activation_email_sent_at).toLocaleString()}`
                            : (contact.activation_email_error || t("crm.contacts.activationEmailNotSent"))
                      }
                      className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        contact.activation_email_status === "failed"
                          ? "bg-rose-500/10 text-rose-400"
                          : contact.activation_email_sent_at
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-white/5 text-[var(--text-tertiary)]"
                      }`}
                    >
                      {contact.activation_email_status === "failed"
                        ? t("crm.contacts.activationEmailFailed")
                        : contact.activation_email_sent_at
                          ? t("crm.contacts.activationEmailSent")
                          : t("crm.contacts.activationEmailNotSent")}
                    </span>
                  )}
                </div>
              </td>
              <td className="text-right">
                <div className="flex justify-end gap-2">
                  {statusFilter === "Archived" ? (
                    <>
                      <button
                        onClick={() => handleRestore(contact)}
                        title={t("crm.contacts.restoreContact")}
                        disabled={isProcessing}
                        className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-emerald-500 transition-all"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSoftDelete(contact)}
                        title={t("crm.contacts.permanentlyDelete")}
                        disabled={isProcessing}
                        className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-rose-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleStatus(contact.cid, contact.status, contact.group_name)}
                        title={
                          contact.status === "active"
                            ? t("crm.contacts.deactivate")
                            : t("crm.contacts.activate")
                        }
                        className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-emerald-500 transition-all"
                      >
                        {contact.status === "active" ? (
                          <UserX className="w-4 h-4" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                      </button>
                      {contact.invitation_status !== "activated" &&
                        (contact.invitation_status === "not_invited" ? (
                          <button
                            onClick={() => handleInviteContact(contact)}
                            title={t("crm.contacts.inviteUser") || "Invite User"}
                            disabled={isProcessing}
                            className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-[var(--brand-orange)] transition-all"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleResendActivation(contact)}
                            title={t("crm.contacts.resendActivation") || "Resend Activation Email (48h link)"}
                            disabled={isProcessing}
                            className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-blue-500 transition-all"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        ))}
                      <button
                        onClick={() => openEditContact(contact)}
                        title={t("crm.contacts.editContact")}
                        className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-[var(--brand-orange)]"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handlePivotToEntity(contact)}
                        title={t("crm.contacts.pivotToEntity")}
                        className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-emerald-500"
                      >
                        <TrendingUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleArchive(contact)}
                        title={t("crm.contacts.archiveContact")}
                        disabled={isProcessing}
                        className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-amber-500 transition-all"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {paginated.length === 0 && (
            <tr>
              <td colSpan={3} className="py-14 text-center">
                <div className="flex flex-col items-center gap-3">
                  <Search className="w-8 h-8 text-[var(--text-secondary)] opacity-40" />
                  <p className="text-xs font-bold text-[var(--text-secondary)]">
                    {t("crm.contacts.noContactsFound")}
                  </p>
                  {(search || statusFilter !== "All" || selectedGroup !== "All Contacts") && (
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all"
                    >
                      {t("common.clearFilter")}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
