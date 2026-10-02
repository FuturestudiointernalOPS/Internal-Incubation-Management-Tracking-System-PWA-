"use client";

import { X } from "lucide-react";

export function ContactFormModal({
  t,
  form,
  setForm,
  families,
  programs,
  contactPrograms,
  setContactPrograms,
  onClose,
  onSave,
}) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <div className="card w-full max-w-xl space-y-6 border-[var(--brand-orange)]/30 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold uppercase">{t("crm.contacts.identityProfile")}</h3>
          <button onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-4">
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder={t("crm.contacts.fullName")}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder={t("crm.contacts.email")}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
            />
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              placeholder={t("crm.contacts.phone")}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
            />
          </div>
          <select
            value={form.group_name}
            onChange={(event) =>
              setForm({ ...form, group_name: event.target.value })
            }
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
          >
            <option value="">{t("crm.contacts.selectSegment")}</option>
            {families.map((family) => (
              <option key={family.id ?? family.name} value={family.name}>
                {family.name.toUpperCase()}
              </option>
            ))}
          </select>
          {/* Role Selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">
              {t("crm.contacts.roleOverride")}
            </label>
            <select
              value={form.role || ""}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
            >
              <option value="">{t("crm.contacts.autoDetect")}</option>
              <option value="staff">{t("crm.contacts.roleStaff")}</option>
              <option value="participant">{t("crm.contacts.roleParticipant")}</option>
              <option value="member">{t("crm.contacts.roleMember")}</option>
              <option value="intern">{t("crm.contacts.roleIntern")}</option>
              <option value="facilitator">{t("crm.contacts.roleFacilitator")}</option>
            </select>
            <p className="text-[10px] text-[var(--text-secondary)] ml-1 opacity-60">
              {t("crm.contacts.roleHelper")}
            </p>
          </div>
          {/* Program Assignments */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">
              {t("crm.contacts.programAssignment")}
            </label>
            <p className="text-[10px] text-[var(--text-secondary)] ml-1 mb-1 opacity-60">
              {t("crm.contacts.programHelper")}
            </p>
            <select
              value={contactPrograms[0] || ""}
              onChange={(event) =>
                setContactPrograms(event.target.value ? [event.target.value] : [])
              }
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
            >
              <option value="">{t("crm.contacts.selectProgram")}</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={onSave}
            className="btn btn-primary w-full py-5 font-bold uppercase tracking-widest"
          >
            {t("crm.contacts.saveIdentity")}
          </button>
        </div>
      </div>
    </div>
  );
}
