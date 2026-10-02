"use client";

import { Plus, Users, Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function ContactsHeader({
  t,
  goBack,
  statusFilter,
  onAddMember,
  onBulkAssign,
}) {
  return (
    <>
      <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <button onClick={goBack} className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("crm.backToPrevious")}
        </button>
        <Link href="/admin/crm" className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("crm.backToCrm")}
        </Link>
      </nav>

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("crm.contacts.contact")}
              </span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)]">
              {t("crm.contacts.contactsTitle")}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {statusFilter !== "Archived" && (
            <>
              <button
                onClick={onAddMember}
                className="btn btn-primary gap-2"
              >
                <Plus className="w-4 h-4" /> {t("crm.contacts.addMember")}
              </button>
              <button
                onClick={onBulkAssign}
                className="btn btn-secondary gap-2"
              >
                <Users className="w-4 h-4" /> {t("crm.contacts.bulkAssign")}
              </button>
            </>
          )}
        </div>
      </header>
    </>
  );
}
