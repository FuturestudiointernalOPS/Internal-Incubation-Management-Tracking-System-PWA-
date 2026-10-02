"use client";

import { Plus, Mail, Edit3, Link as LinkIcon, Check } from "lucide-react";

export function ContactsSegmentsSidebar({
  t,
  families,
  contacts,
  selectedGroup,
  setSelectedGroup,
  segmentCounts,
  copiedGroup,
  setShowGroupModal,
  setInviteForm,
  setShowInviteModal,
  setNewGroupName,
  setNewGroupType,
  setNewGroupProgramId,
  copyJoinLink,
}) {
  return (
    <div className="xl:col-span-1 space-y-6">
      <div className="card space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center ml-2 mb-3">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
              {t("crm.contacts.segments")}
            </p>
            <button
              onClick={() => setShowGroupModal(true)}
              className="text-[10px] font-bold text-[var(--brand-orange)] hover:opacity-80 uppercase tracking-widest flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> {t("crm.contacts.new")}
            </button>
          </div>
          {["All Contacts", ...families].map((family) => {
            const name = typeof family === "string" ? family : family.name;
            const isAll = name === "All Contacts";
            return (
              <div key={name} className="flex gap-2 group items-center">
                <button
                  onClick={() => setSelectedGroup(name)}
                  className={`flex-1 flex items-center justify-between gap-2 text-left px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${selectedGroup === name ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-primary"}`}
                >
                  <span className="break-words whitespace-normal">
                    {isAll ? t("crm.contacts.allContacts") : name} {!!family.is_archived && t("crm.contacts.archivedSuffix")}
                  </span>
                  <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${selectedGroup === name ? "bg-black/20" : "bg-tertiary"}`}>
                    {isAll ? contacts.length : segmentCounts[String(name).toUpperCase()] || 0}
                  </span>
                </button>
                {!isAll && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setInviteForm({ name: "", email: "", phone: "", role: "member" });
                        setShowInviteModal({ name });
                      }}
                      title={t("crm.contacts.invite")}
                      className="p-2.5 rounded-lg border border-[var(--border-primary)] bg-primary text-slate-500 hover:text-[var(--brand-orange)]"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setNewGroupName(family.name);
                        setNewGroupType(family.type);
                        setNewGroupProgramId(family.program_id);
                        setShowGroupModal(family);
                      }}
                      title={t("crm.contacts.editSegment")}
                      className="p-2.5 rounded-lg border border-[var(--border-primary)] bg-primary text-slate-500 hover:text-[var(--brand-orange)]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => copyJoinLink(name)}
                      title={t("crm.contacts.copyJoinLink")}
                      className={`p-2.5 rounded-lg border border-[var(--border-primary)] transition-all ${copiedGroup === name ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-primary text-slate-500 hover:text-[var(--brand-orange)]"}`}
                    >
                      {copiedGroup === name ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <LinkIcon className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
