"use client";

import { motion } from "framer-motion";
import { AlertCircle, BadgeCheck, BookOpen, Building2, Calendar, Camera, CheckCircle2, Clock, ExternalLink, FileText, Globe, Languages, Mail, Phone, Rocket, Save, Shield, Target, User } from "lucide-react";
import AppImage from "@/components/ui/AppImage";
import HistoryGroup from "./HistoryGroup";
import InfoRow from "./InfoRow";
import SearchableSelect from "@/components/ui/SearchableSelect";
import SectionCard from "./SectionCard";

export default function ProfileViewContent({ ctx }) {
  const { addAltEmail, altBusy, altEmails, altNotice, contact, countryOptions, deriveCurrentRole, editedCountryCode, editedLanguage, formatDate, formatDateTime, groupInfo, handlePhotoUpload, handleSave, history, languageOptions, newAltEmail, photoMessage, programs, removeAltEmail, roleLabel, saveMessage, saving, setEditedAlternativePhone, setEditedCountryCode, setEditedLanguage, setEditedName, setEditedPhone, setNewAltEmail, statusLabel, storedCountryCode, submissions, t, timeline, uploadingPhoto } = ctx;
return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
          {t("adminMisc.profile.title")}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t("adminMisc.profile.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══ LEFT COLUMN: Avatar + Quick Info ═══ */}
        <div className="lg:col-span-1 space-y-4">
          {/* Avatar card */}
          <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl p-6 text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="w-24 h-24 rounded-2xl bg-brand-orange/10 border-2 border-brand-orange/20 flex items-center justify-center overflow-hidden">
                {contact.image ? (
                  <AppImage
                    src={contact.image}
                    alt={contact.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-[var(--brand-orange)]" />
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[var(--brand-orange)] text-black flex items-center justify-center cursor-pointer hover:brightness-110 transition-all shadow-lg">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => handlePhotoUpload(event.target.files?.[0])}
                />
              </label>
            </div>
            <h2 className="text-base font-black text-[var(--text-primary)]">
              {contact.name}
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
              {roleLabel(deriveCurrentRole())}
            </p>
            {uploadingPhoto && (
              <p className="text-[10px] font-bold text-[var(--brand-orange)] mt-2">
                {t("adminMisc.profile.uploadingPhoto")}
              </p>
            )}
            {photoMessage && (
              <p
                className={`text-[10px] font-bold mt-2 ${
                  photoMessage.type === "success"
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {photoMessage.text}
              </p>
            )}
            <div className="mt-4 pt-4 border-t border-[var(--border-primary)] space-y-2 text-left">
              <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--text-secondary)]">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
            </div>
          </div>

          {/* Programs summary */}
          <SectionCard title={t("adminMisc.profile.enrolledPrograms")} icon={BookOpen}>
            {programs.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t("adminMisc.profile.noPrograms")}
              </p>
            ) : (
              <div className="space-y-2">
                {programs.slice(0, 5).map((program) => (
                  <div key={program.id} className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                      {program.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        program.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-white/5 text-[var(--text-tertiary)]"
                      }`}
                    >
                      {program.status || "active"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ═══ RIGHT COLUMN: Details + Activity ═══ */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <SectionCard title={t("adminMisc.profile.personalInformation")} icon={User}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow
                icon={User}
                label={t("adminMisc.profile.fullName")}
                value={contact.name}
                editable
                onChange={setEditedName}
              />
              <InfoRow icon={Mail} label={t("adminMisc.profile.email")} value={contact.email} />
              <InfoRow
                icon={Phone}
                label={t("adminMisc.profile.phone")}
                value={contact.phone}
                editable
                onChange={setEditedPhone}
              />
              <InfoRow
                icon={Shield}
                label={t("adminMisc.profile.role")}
                value={roleLabel(deriveCurrentRole())}
              />
              <InfoRow
                icon={Building2}
                label={t("adminMisc.profile.organization")}
                value={contact.group_name}
              />
              <InfoRow
                icon={BadgeCheck}
                label={t("adminMisc.profile.accountStatus")}
                value={statusLabel(contact.status)}
              />
              <SearchableSelect
                label={t("adminMisc.profile.country")}
                icon={Globe}
                value={editedCountryCode ?? storedCountryCode}
                onChange={setEditedCountryCode}
                options={countryOptions}
                placeholder={t("common.select")}
                searchPlaceholder={t("common.search")}
                emptyText={t("common.noResults")}
              />

              {/* Preferred Language */}
              <SearchableSelect
                label={t("adminMisc.profile.preferredLanguage")}
                icon={Languages}
                value={editedLanguage ?? contact.language}
                onChange={setEditedLanguage}
                options={languageOptions}
                placeholder={t("common.select")}
                searchPlaceholder={t("common.search")}
                emptyText={t("common.noResults")}
              />

              <InfoRow
                icon={Calendar}
                label={t("adminMisc.profile.dateJoined")}
                value={formatDate(contact.created_at)}
              />
              <InfoRow
                icon={Clock}
                label={t("adminMisc.profile.lastLogin")}
                value={formatDateTime(contact.last_login_at)}
              />
              <InfoRow
                icon={Phone}
                label={t("adminMisc.profile.alternativePhone")}
                value={contact.alternative_phone}
                editable
                onChange={setEditedAlternativePhone}
              />

              {/* Alternative emails — identity matching (multiple) */}
              <div className="space-y-2 pt-1">
                <p className="flex items-center gap-2 text-[8px] font-black text-[var(--text-tertiary)] uppercase tracking-wider">
                  <Mail className="w-3 h-3" /> {t("adminMisc.profile.alternativeEmailsTitle")}
                </p>
                {altEmails.length === 0 ? (
                  <p className="text-[10px] font-bold text-[var(--text-tertiary)]">
                    {t("adminMisc.profile.alternativeEmailsEmpty")}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {altEmails.map((email) => (
                      <div
                        key={email.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)]"
                      >
                        <span className="text-[10px] font-bold text-[var(--text-primary)] break-all">
                          {email.email}
                        </span>
                        <button
                          type="button"
                          disabled={altBusy}
                          onClick={() => removeAltEmail(email.id)}
                          className="text-[9px] font-black uppercase tracking-wider text-red-400 hover:text-red-300 disabled:opacity-40 shrink-0"
                        >
                          {t("adminMisc.profile.altEmailRemove")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <input
                    value={newAltEmail}
                    disabled={altBusy}
                    onChange={(event) => setNewAltEmail(event.target.value)}
                    placeholder={t("adminMisc.profile.altEmailPlaceholder")}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addAltEmail(); } }}
                    className="flex-1 min-w-0 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                  />
                  <button
                    type="button"
                    disabled={altBusy}
                    onClick={addAltEmail}
                    className="px-3 py-2 rounded-lg bg-[var(--brand-orange)] text-white text-[9px] font-black uppercase tracking-wider disabled:opacity-40"
                  >
                    {t("adminMisc.profile.altEmailAdd")}
                  </button>
                </div>
                {altNotice && (
                  <p className="text-[9px] font-bold text-[var(--text-secondary)]">
                    {altNotice}
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Program History */}
          <SectionCard title={t("adminMisc.profile.programHistory")} icon={BookOpen}>
            {history.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {t("adminMisc.profile.noHistory")}
              </p>
            ) : (
              <div className="space-y-5">
                <HistoryGroup
                  title={t("adminMisc.profile.currentPrograms")}
                  rows={history.filter((entry) => entry.status === "active")}
                  roleLabel={roleLabel}
                  activeLabel={t("adminMisc.profile.activeStatus")}
                  completedLabel={t("adminMisc.profile.completedStatus")}
                />
                <HistoryGroup
                  title={t("adminMisc.profile.pastPrograms")}
                  rows={history.filter((entry) => entry.status !== "active")}
                  roleLabel={roleLabel}
                  activeLabel={t("adminMisc.profile.activeStatus")}
                  completedLabel={t("adminMisc.profile.completedStatus")}
                />
              </div>
            )}
          </SectionCard>

          {/* Activity Timeline — the user's own contact activity log */}
          <div id="timeline">
            <SectionCard title={t("participant.activityTimeline")} icon={Clock}>
              {timeline.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">
                  {t("participant.timelineEmpty")}
                </p>
              ) : (
                <div className="space-y-2">
                  {timeline.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)]"
                    >
                      <Clock className="w-3.5 h-3.5 text-[var(--brand-orange)] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-[var(--text-primary)]">
                          {event.description}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
                          {(event.event_type || "").replace(/_/g, " ")} ·{" "}
                          {event.created_at ? new Date(event.created_at).toLocaleDateString() : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Startup / Group Profile */}
          {groupInfo && (
            <SectionCard title={t("adminMisc.profile.startupProfile")} icon={Rocket}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[var(--brand-orange)]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[var(--text-primary)]">
                      {groupInfo.name}
                    </p>
                    {groupInfo.project_description && (
                      <p className="text-sm text-[var(--text-secondary)]">
                        {groupInfo.project_description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {groupInfo.url && (
                    <a
                      href={groupInfo.url}
                      target="_blank"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:brightness-110 transition-all" rel="noreferrer"
                    >
                      <Globe className="w-3 h-3" /> {t("adminMisc.profile.website")}
                    </a>
                  )}
                  {groupInfo.demo_link && (
                    <a
                      href={groupInfo.demo_link}
                      target="_blank"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:brightness-110 transition-all" rel="noreferrer"
                    >
                      <ExternalLink className="w-3 h-3" /> {t("adminMisc.profile.demo")}
                    </a>
                  )}
                  {groupInfo.pitch_deck_url && (
                    <a
                      href={groupInfo.pitch_deck_url}
                      target="_blank"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-purple-400 hover:brightness-110 transition-all" rel="noreferrer"
                    >
                      <ExternalLink className="w-3 h-3" /> {t("adminMisc.profile.pitchDeck")}
                    </a>
                  )}
                </div>
              </div>
            </SectionCard>
          )}

          {/* Goals */}
          <SectionCard title={t("adminMisc.profile.goalsObjectives")} icon={Target}>
            <div className="space-y-3">
              <p className="text-[10px] text-[var(--text-secondary)]">
                {programs.length > 0
                  ? t("adminMisc.profile.activelyEnrolled", { count: programs.length })
                  : t("adminMisc.profile.noActivePrograms")}
              </p>
              <div className="flex flex-wrap gap-2">
                {programs
                  .filter((program) => program.status === "active" || !program.status)
                  .map((program) => (
                    <div
                      key={program.id}
                      className="px-3 py-1.5 rounded-lg bg-brand-orange/10 border border-brand-orange/20"
                    >
                      <p className="text-[10px] font-bold text-[var(--brand-orange)]">
                        {program.name}
                      </p>
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                        {t("adminMisc.profile.weekProgress", {
                          week: program.currentWeek,
                          duration: program.durationWeeks || "?",
                          percent: program.metrics?.percentComplete || 0,
                        })}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </SectionCard>



          {/* Recent Submissions */}
          <SectionCard title={t("adminMisc.profile.submittedWork")} icon={FileText}>
            {submissions.length === 0 ? (
              <div className="text-center py-6">
                <FileText className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">
                  {t("adminMisc.profile.noSubmissions")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {submissions.slice(0, 10).map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center ${
                          submission.status === "approved"
                            ? "bg-emerald-500/10"
                            : submission.status === "pending"
                              ? "bg-amber-500/10"
                              : "bg-white/5"
                        }`}
                      >
                        <FileText
                          className={`w-3.5 h-3.5 ${
                            submission.status === "approved"
                              ? "text-emerald-400"
                              : submission.status === "pending"
                                ? "text-amber-400"
                                : "text-[var(--text-tertiary)]"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[var(--text-primary)]">
                          {t("adminMisc.profile.deliverableNumber", { id: submission.document_id || submission.deliverable_id })}
                        </p>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                          {submission.created_at
                            ? new Date(submission.created_at).toLocaleDateString()
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          submission.status === "approved"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : submission.status === "pending"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-white/5 text-[var(--text-tertiary)]"
                        }`}
                      >
                        {submission.status || "draft"}
                      </span>
                      {submission.score > 0 && (
                        <span className="text-[10px] font-bold text-emerald-400">
                          {submission.score} pts
                        </span>
                      )}
                      {submission.file_url && (
                        <a
                          href={submission.file_url}
                          target="_blank"
                          className="text-[var(--brand-orange)] hover:underline" rel="noreferrer"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Save actions — at the bottom of the profile form */}
      <div className="space-y-3">
        {saveMessage && (
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold ${
              saveMessage.type === "success"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-rose-500/10 text-rose-400"
            }`}
          >
            {saveMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {saveMessage.text}
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all disabled:opacity-30"
          >
            <Save className="w-3.5 h-3.5" />{" "}
            {saving ? t("adminMisc.profile.saving") : t("adminMisc.profile.saveChanges")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
