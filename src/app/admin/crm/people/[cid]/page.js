"use client";

import React, { useState, use } from "react";
import { useRouter } from "next/navigation";
import { User, Clock, FileText, Briefcase, Rocket, Upload, Plus, ArrowLeft, Send, Mail, GraduationCap, Building2 } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { formatLabel, formatLocaleDate } from "@/lib/constants";
import { useSafeBack } from "@/lib/useSafeBack";
import MembershipSection from "@/components/membership/MembershipSection";
import { useApi } from "@/lib/hooks/useApi";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const TIMELINE_LIMIT = 200;

const pickContact = (payload) =>
  payload?.contacts?.length > 0 ? payload.contacts[0] : null;
const pickTimeline = (payload) => (payload?.success ? payload.events || [] : []);
const pickRoles = (payload) => (payload?.success ? payload.roles || [] : []);
const pickProgramHistory = (payload) => (payload?.success ? payload.history || [] : []);
const pickLearning = (payload) => (payload?.success ? payload.learning || null : null);
const pickEmails = (payload) => (payload?.success ? payload.emails || [] : []);

const MODULE_COLORS = {
  forms: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  programs: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ventures: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  investors: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  communications: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  crm: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  system: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const ROLE_LABELS = {
  participant: "crm.roles.participant",
  staff: "crm.roles.staff",
  investor: "crm.roles.investor",
  finance: "crm.roles.finance",
  unassigned: "crm.roles.unassigned",
  team: "crm.roles.team",
  founder: "crm.roles.founder",
  pm: "crm.roles.pm",
};

const PROGRAM_ROLE_LABELS = {
  participant: "crm.roles.participant",
  facilitator: "crm.roles.facilitator",
  program_manager: "crm.roles.pm",
  assistant: "crm.roles.assistant",
  staff: "crm.roles.staff",
};

const INVITATION_STATUS_LABELS = {
  not_invited: "crm.contacts.invitationNotInvited",
  sent: "crm.contacts.invitationSent",
  activated: "crm.contacts.invitationActivated",
  expired: "crm.contacts.invitationExpired",
};

const MODULE_LABELS = {
  forms: "crm.modules.forms",
  programs: "crm.modules.programs",
  ventures: "crm.modules.ventures",
  investors: "crm.modules.investors",
  communications: "crm.modules.communications",
  system: "crm.modules.system",
};

// Every email type the SHARED delivery log can hold, so a person's history is
// labelled in the reader's language. An unknown type falls back to a humanized
// code rather than a raw key.
const EMAIL_TYPE_KEYS = [
  "activation", "access", "welcome", "password_reset", "approval_setup",
  "team_credentials", "campaign", "investor_registration", "investor_decision",
  "venture_approval", "venture_invitation", "venture_member_invitation",
  "venture_notification", "notification",
  "acknowledgement", "approval", "rejection", "manual", "result",
];

// Delivery statuses — the same vocabulary and colours the run email log uses.
const EMAIL_STATUS_STYLES = {
  sent: "bg-emerald-500/10 text-emerald-500",
  delivered: "bg-emerald-400/10 text-emerald-400",
  opened: "bg-sky-500/10 text-sky-500",
  clicked: "bg-indigo-500/10 text-indigo-500",
  delayed: "bg-amber-500/10 text-amber-500",
  complained: "bg-rose-500/10 text-rose-500",
  failed: "bg-rose-500/10 text-rose-500",
  bounced: "bg-amber-500/10 text-amber-500",
  cancelled: "bg-slate-500/10 text-slate-400",
  skipped: "bg-slate-500/10 text-slate-400",
  pending: "bg-amber-500/10 text-amber-400",
};
const EMAIL_STATUS_LABEL_KEYS = {
  sent: "platformMisc.runs.emailSent",
  delivered: "platformMisc.runs.emailDelivered",
  opened: "platformMisc.runs.emailOpened",
  clicked: "platformMisc.runs.emailClicked",
  delayed: "platformMisc.runs.emailDelayed",
  complained: "platformMisc.runs.emailComplained",
  failed: "platformMisc.runs.emailFailed",
  bounced: "platformMisc.runs.emailBounced",
  cancelled: "platformMisc.runs.emailCancelled",
  skipped: "platformMisc.runs.emailSkipped",
  pending: "platformMisc.runs.emailPending",
};

export default function CrmDetailPage({ params }) {
  const { cid } = use(params);
  const _router = useRouter();
  const { t, lang } = useI18n();
  const goBack = useSafeBack("/admin/crm");

  const [moduleFilter, setModuleFilter] = useState("");
  const [tab, setTab] = useState("timeline");

  // Note form
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Meeting form
  const [showMeeting, setShowMeeting] = useState(false);
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split("T")[0]);
  const [meetingSummary, setMeetingSummary] = useState("");
  const [meetingAttendees, setMeetingAttendees] = useState("");
  const [meetingOutcome, setMeetingOutcome] = useState("");
  const [savingMeeting, setSavingMeeting] = useState(false);

  // Upload
  const [uploading, setUploading] = useState(false);

  // Invite
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(null);

  // Reads of the same person, each through the shared hook: it owns the
  // cache, the cache-first paint and the discarding of a stale answer, so the
  // page keeps no copy of its own and reads its data during render.
  const { data: contact, loading: contactLoading, refresh: refreshContact } = useApi(
    cid ? `/api/contacts?cid=${cid}` : null,
    { defaultValue: null, transform: pickContact, deps: [cid] },
  );
  const { data: events, loading: eventsLoading, setData: setEvents } = useApi(
    cid
      ? `/api/contacts/${cid}/timeline?limit=${TIMELINE_LIMIT}${moduleFilter ? `&module=${moduleFilter}` : ""}`
      : null,
    { defaultValue: [], transform: pickTimeline, deps: [cid, moduleFilter] },
  );
  const { data: roles, loading: rolesLoading } = useApi(
    cid ? `/api/contacts/${cid}/roles` : null,
    { defaultValue: [], transform: pickRoles, deps: [cid] },
  );
  const { data: programs, loading: programsLoading } = useApi(
    cid ? `/api/contacts/${cid}/programs` : null,
    { defaultValue: [], transform: pickProgramHistory, deps: [cid] },
  );
  const { data: learning, loading: learningLoading } = useApi(
    cid ? `/api/contacts/${cid}/learning` : null,
    { defaultValue: null, transform: pickLearning, deps: [cid] },
  );
  const { data: emails, loading: emailsLoading } = useApi(
    cid ? `/api/contacts/${cid}/emails?limit=100` : null,
    { defaultValue: [], transform: pickEmails, deps: [cid] },
  );

  const loading =
    contactLoading ||
    eventsLoading ||
    rolesLoading ||
    programsLoading ||
    learningLoading ||
    emailsLoading;

  const currentRoles = roles.filter(roleAssignment => roleAssignment.is_current);
  const pastRoles = roles.filter(roleAssignment => !roleAssignment.is_current);

  // Group events by year
  const eventsByYear = {};
  for (const event of events) {
    const year = new Date(event.created_at).getFullYear();
    if (!eventsByYear[year]) eventsByYear[year] = [];
    eventsByYear[year].push(event);
  }
  const sortedYears = Object.keys(eventsByYear).sort((first, second) => second - first);

  // Quick panel counts
  const panelCounts = {
    forms: events.filter(event => event.context_module === "forms").length,
    programs: events.filter(event => event.context_module === "programs").length,
    ventures: events.filter(event => event.context_module === "ventures").length,
    investors: events.filter(event => event.context_module === "investors").length,
    comms: events.filter(event => event.context_module === "communications").length,
  };

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await fetch(`/api/contacts/${cid}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "note_added", description: noteText.trim() }),
      });
      setNoteText("");
      // Refresh timeline
      const response = await fetch(`/api/contacts/${cid}/timeline?limit=200`);
      const data = await response.json();
      if (data.success) setEvents(data.events || []);
    } catch (_) {}
    setSavingNote(false);
  }

  async function handleAddMeeting() {
    if (!meetingSummary.trim()) return;
    setSavingMeeting(true);
    try {
      await fetch(`/api/contacts/${cid}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "meeting_held",
          description: meetingSummary.trim(),
          metadata: { date: meetingDate, attendees: meetingAttendees, outcome: meetingOutcome },
        }),
      });
      setShowMeeting(false);
      setMeetingSummary("");
      setMeetingAttendees("");
      setMeetingOutcome("");
      const response = await fetch(`/api/contacts/${cid}/timeline?limit=200`);
      const data = await response.json();
      if (data.success) setEvents(data.events || []);
    } catch (_) {}
    setSavingMeeting(false);
  }

  async function handleInviteUser() {
    if (!contact?.email) return;
    setInviting(true);
    setInviteMessage(null);
    try {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contact.email,
          name: contact.name,
          role: contact.role || "participant",
        }),
      });
      const data = await response.json();
      if (data.success) {
        // The person was invited either way — but "sent" is only claimed when
        // the sender really sent it.
        setInviteMessage(
          data.email_sent === false
            ? { type: "error", text: t("crm.contacts.inviteEmailFailed", { error: data.email_error || t("crm.contacts.inviteFailed") }) }
            : { type: "success", text: t("crm.contacts.invitationSent") || "Invitation sent" },
        );
        // Re-read the person so the invitation state on screen is the server's.
        refreshContact();
      } else {
        setInviteMessage({ type: "error", text: data.error || "Failed to send invitation" });
      }
    } catch {
      setInviteMessage({ type: "error", text: "Error sending invitation" });
    }
    setInviting(false);
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (uploadData.url) {
        await fetch(`/api/contacts/${cid}/timeline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: "document_attached",
            description: `${t("crm.people.attached")} ${file.name}`,
            metadata: { file_url: uploadData.url, file_name: file.name },
          }),
        });
        const response = await fetch(`/api/contacts/${cid}/timeline?limit=200`);
        const data = await response.json();
        if (data.success) setEvents(data.events || []);
      }
    } catch (_) {}
    setUploading(false);
  }

  if (loading) {
    return (
      <>
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">{t("crm.people.loading")}</div>
      </>
    );
  }

  if (!contact) {
    return (
      <>
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">{t("crm.people.contactNotFound")}</div>
      </>
    );
  }

  const invitationStatus =
    contact.invitation_status ||
    (contact.status === "active" ? "activated" : "not_invited");

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* Back links */}
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button onClick={goBack} className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("crm.backToPrevious")}
          </button>
          <Link href="/admin/crm" className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("crm.people.backToCrmDashboard")}
          </Link>
        </nav>

        {/* Identity Header */}
        <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-14 h-14 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-[var(--brand-orange)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black uppercase tracking-tight">{contact.name}</h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {contact.email} {contact.phone ? "· " + contact.phone : ""}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {currentRoles.map(roleAssignment => (
                  <span key={roleAssignment.id} className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
                    {t(ROLE_LABELS[roleAssignment.role] || "") || roleAssignment.role}
                  </span>
                ))}
                {pastRoles.length > 0 && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-tertiary text-[var(--text-secondary)]">
                    {t("crm.people.previousCount", { count: pastRoles.length })}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <span
                className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                  invitationStatus === "activated"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : invitationStatus === "sent"
                      ? "bg-orange-500/10 text-orange-400"
                      : invitationStatus === "expired"
                        ? "bg-rose-500/10 text-rose-400"
                        : "bg-white/5 text-[var(--text-tertiary)]"
                }`}
              >
                {t(INVITATION_STATUS_LABELS[invitationStatus] || "") || invitationStatus}
              </span>

              {invitationStatus === "activated" ? (
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  {t("crm.contacts.invitationActivated") || "Activated"}
                </span>
              ) : (
                <button
                  onClick={handleInviteUser}
                  disabled={inviting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-40"
                >
                  {inviting ? <Clock className="w-3.5 h-3.5 animate-spin" /> : invitationStatus === "not_invited" ? <Send className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                  {inviting
                    ? t("crm.contacts.sending")
                    : invitationStatus === "not_invited"
                      ? t("crm.contacts.inviteUser") || "Invite User"
                      : t("crm.contacts.resendActivation") || "Resend Invitation"}
                </button>
              )}

              {inviteMessage && (
                <p
                  className={`text-[10px] font-bold ${
                    inviteMessage.type === "success" ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {inviteMessage.text}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--border-primary)] pb-0">
          {[
            { key: "timeline", label: t("crm.people.tabTimeline"), icon: Clock },
            { key: "emails", label: t("crm.people.tabEmails"), icon: Mail },
            { key: "programs", label: t("crm.people.tabPrograms"), icon: Rocket },
            { key: "learning", label: t("crm.people.tabLearning"), icon: GraduationCap },
            { key: "membership", label: t("crm.people.tabMembership"), icon: Building2 },
            { key: "notes", label: t("crm.people.tabNotes"), icon: FileText },
            { key: "meetings", label: t("crm.people.tabMeetings"), icon: Briefcase },
            { key: "documents", label: t("crm.people.tabDocuments"), icon: Upload },
          ].map(tabItem => (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider border-b-2 transition-colors ${
                tab === tabItem.key
                  ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <tabItem.icon className="w-3.5 h-3.5" />
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* Timeline Tab */}
        {tab === "timeline" && (
          <div className="space-y-4">
            {/* Quick panels */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { key: "forms", label: t("crm.people.panelForms"), count: panelCounts.forms, color: "border-purple-500/30" },
                { key: "programs", label: t("crm.people.panelPrograms"), count: panelCounts.programs, color: "border-blue-500/30" },
                { key: "ventures", label: t("crm.people.panelVentures"), count: panelCounts.ventures, color: "border-emerald-500/30" },
                { key: "investors", label: t("crm.people.panelInvestors"), count: panelCounts.investors, color: "border-amber-500/30" },
                { key: "communications", label: t("crm.people.panelComms"), count: panelCounts.comms, color: "border-cyan-500/30" },
              ].map(panel => (
                <button
                  key={panel.key}
                  onClick={() => setModuleFilter(moduleFilter === panel.key ? "" : panel.key)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    moduleFilter === panel.key
                      ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/5"
                      : "border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50"
                  }`}
                >
                  <p className="text-lg font-black">{panel.count}</p>
                  <p className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">{panel.label}</p>
                </button>
              ))}
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {["", "forms", "programs", "ventures", "investors", "communications", "system"].map(module => (
                <button
                  key={module}
                  onClick={() => setModuleFilter(module)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                    moduleFilter === module ? "bg-[var(--brand-orange)] text-black border-orange-600" : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]"
                  }`}
                >
                  {t(MODULE_LABELS[module] || "") || module || t("crm.people.all")}
                </button>
              ))}
            </div>

            {/* Timeline */}
            {events.length === 0 ? (
              <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-8 text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
                <p className="text-sm font-bold">{t("crm.people.noEvents")}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {t("crm.people.noEventsHint", { name: contact.name })}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedYears.map(year => (
                  <div key={year}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-orange)]" />
                      <h3 className="text-xs font-black uppercase tracking-widest text-[var(--brand-orange)]">{year}</h3>
                    </div>
                    <div className="space-y-1.5 pl-5 border-l-2 border-[var(--border-primary)]">
                      {eventsByYear[year].map(event => (
                        <div key={event.id} className="relative pl-5 pb-3">
                          <div className="absolute left-[-23px] top-1.5 w-2 h-2 rounded-full bg-[var(--border-primary)] border-2 border-primary" />
                          <div className="bg-primary border border-[var(--border-primary)] rounded-xl p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold">{event.description}</p>
                              {event.context_module && (
                                <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${MODULE_COLORS[event.context_module] || MODULE_COLORS.system}`}>
                                  {t(MODULE_LABELS[event.context_module] || "") || event.context_module}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                              {formatLocaleDate(event.created_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, lang)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Emails Tab — the person's history from the SHARED delivery log */}
        {tab === "emails" && (
          <div className="space-y-4">
            <p className="text-[11px] text-[var(--text-secondary)]">{t("crm.people.emailsDesc")}</p>
            {emails.length === 0 ? (
              <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-8 text-center">
                <Mail className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
                <p className="text-sm font-bold">{t("crm.people.emailsEmpty")}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {emails.map((email) => (
                  <div key={email.id} className="bg-primary border border-[var(--border-primary)] rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold">
                        {EMAIL_TYPE_KEYS.includes(email.email_type)
                          ? t(`crm.emailTypes.${email.email_type}`)
                          : formatLabel(email.email_type)}
                      </p>
                      <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${EMAIL_STATUS_STYLES[email.status] || "bg-white/5 text-[var(--text-secondary)]"}`}>
                        {EMAIL_STATUS_LABEL_KEYS[email.status] ? t(EMAIL_STATUS_LABEL_KEYS[email.status]) : formatLabel(email.status)}
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                      {email.recipient || t("crm.people.emailsNoRecipient")}
                      {email.provider ? ` · ${email.provider}` : ""}
                      {` · ${formatLocaleDate(email.sent_at || email.created_at, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }, lang)}`}
                    </p>
                    {email.error && (
                      <p className="text-[10px] text-rose-400 mt-1">{email.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes Tab */}
        {tab === "notes" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t("crm.people.notePlaceholder")}
                value={noteText}
                onChange={event => setNoteText(event.target.value)}
                onKeyDown={event => event.key === "Enter" && handleAddNote()}
                className="flex-1 bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
              />
              <button
                onClick={handleAddNote}
                disabled={savingNote || !noteText.trim()}
                className="px-4 py-2.5 bg-[var(--brand-orange)] text-black font-bold text-sm uppercase rounded-xl disabled:opacity-50"
              >
                {savingNote ? "..." : t("crm.people.add")}
              </button>
            </div>
            <div className="space-y-2">
              {events.filter(event => event.event_type === "note_added").map(noteEvent => (
                <div key={noteEvent.id} className="bg-primary border border-[var(--border-primary)] rounded-xl p-3">
                  <p className="text-sm">{noteEvent.description}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {formatLocaleDate(noteEvent.created_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, lang)}
                  </p>
                </div>
              ))}
              {events.filter(event => event.event_type === "note_added").length === 0 && (
                <p className="text-sm text-[var(--text-secondary)] py-4">{t("crm.people.noNotes")}</p>
              )}
            </div>
          </div>
        )}

        {/* Meetings Tab */}
        {tab === "meetings" && (
          <div className="space-y-4">
            {!showMeeting ? (
              <button
                onClick={() => setShowMeeting(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black font-bold text-sm uppercase rounded-xl"
              >
                <Plus className="w-3.5 h-3.5" /> {t("crm.people.recordMeeting")}
              </button>
            ) : (
              <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-5 space-y-3">
                <input
                  type="date"
                  value={meetingDate}
                  onChange={event => setMeetingDate(event.target.value)}
                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
                />
                <input
                  type="text"
                  placeholder={t("crm.people.meetingSummaryPlaceholder")}
                  value={meetingSummary}
                  onChange={event => setMeetingSummary(event.target.value)}
                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
                />
                <input
                  type="text"
                  placeholder={t("crm.people.meetingAttendeesPlaceholder")}
                  value={meetingAttendees}
                  onChange={event => setMeetingAttendees(event.target.value)}
                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
                />
                <textarea
                  placeholder={t("crm.people.meetingOutcomePlaceholder")}
                  value={meetingOutcome}
                  onChange={event => setMeetingOutcome(event.target.value)}
                  rows={2}
                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddMeeting}
                    disabled={savingMeeting || !meetingSummary.trim()}
                    className="px-4 py-2 bg-[var(--brand-orange)] text-black font-bold text-sm uppercase rounded-xl disabled:opacity-50"
                  >
                    {savingMeeting ? t("crm.people.saving") : t("crm.people.saveMeeting")}
                  </button>
                  <button onClick={() => setShowMeeting(false)} className="px-4 py-2 bg-tertiary font-bold text-sm uppercase rounded-xl">
                    {t("crm.people.cancel")}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {events.filter(event => event.event_type === "meeting_held").map(meetingEvent => (
                <div key={meetingEvent.id} className="bg-primary border border-[var(--border-primary)] rounded-xl p-3">
                  <p className="text-sm font-bold">{meetingEvent.description}</p>
                  {meetingEvent.metadata && (
                    <div className="text-[10px] text-[var(--text-secondary)] mt-1 space-y-0.5">
                      {meetingEvent.metadata.date && <p>{t("crm.people.metaDate")} {meetingEvent.metadata.date}</p>}
                      {meetingEvent.metadata.attendees && <p>{t("crm.people.metaAttendees")} {meetingEvent.metadata.attendees}</p>}
                      {meetingEvent.metadata.outcome && <p>{t("crm.people.metaOutcome")} {meetingEvent.metadata.outcome}</p>}
                    </div>
                  )}
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {formatLocaleDate(meetingEvent.created_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, lang)}
                  </p>
                </div>
              ))}
              {events.filter(event => event.event_type === "meeting_held").length === 0 && (
                <p className="text-sm text-[var(--text-secondary)] py-4">{t("crm.people.noMeetings")}</p>
              )}
            </div>
          </div>
        )}

        {/* Documents Tab */}
        {tab === "documents" && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)] text-black font-bold text-sm uppercase rounded-xl cursor-pointer w-fit">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? t("crm.people.uploading") : t("crm.people.uploadFile")}
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
            <div className="space-y-2">
              {events.filter(event => event.event_type === "document_attached").map(documentEvent => (
                <div key={documentEvent.id} className="bg-primary border border-[var(--border-primary)] rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{documentEvent.description}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      {formatLocaleDate(documentEvent.created_at, { month: "short", day: "numeric" }, lang)}
                    </p>
                  </div>
                  {documentEvent.metadata?.file_url && (
                    <a href={documentEvent.metadata.file_url} target="_blank" className="text-[10px] font-bold text-[var(--brand-orange)] uppercase" rel="noreferrer">
                      {t("crm.people.download")}
                    </a>
                  )}
                </div>
              ))}
              {events.filter(event => event.event_type === "document_attached").length === 0 && (
                <p className="text-sm text-[var(--text-secondary)] py-4">{t("crm.people.noDocuments")}</p>
              )}
            </div>
          </div>
        )}

        {/* Programs Tab */}
        {tab === "programs" && (
          <div className="space-y-6">
            {programs.length === 0 ? (
              <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-8 text-center">
                <Rocket className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
                <p className="text-sm font-bold">{t("crm.people.noPrograms")}</p>
              </div>
            ) : (
              <>
                {[
                  { title: t("crm.people.activeEngagements"), rows: programs.filter(program => program.status === "active") },
                  { title: t("crm.people.pastEngagements"), rows: programs.filter(program => program.status !== "active") },
                ].map(engagementGroup => engagementGroup.rows.length === 0 ? null : (
                  <div key={engagementGroup.title} className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[var(--brand-orange)]">{engagementGroup.title}</h3>
                    <div className="space-y-2">
                      {engagementGroup.rows.map((program) => (
                        <div key={`${program.program_id}-${program.role}`} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border-primary)] bg-primary">
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate">{program.program_name}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">
                              {t(PROGRAM_ROLE_LABELS[program.role] || "") || program.role}
                            </p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${program.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-tertiary text-[var(--text-secondary)] border-[var(--border-primary)]"}`}>
                            {program.status === "active" ? t("crm.people.activeStatus") : t("crm.people.completedStatus")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Learning Tab (Phase 7 — CRM trace) */}
        {tab === "learning" && (
          <div className="space-y-6">
            {learning === null ? (
              <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-8 text-center">
                <p className="text-sm font-bold">{t("crm.people.loading")}</p>
              </div>
            ) : learning.courses.length === 0 && learning.certificates.length === 0 ? (
              <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-8 text-center">
                <GraduationCap className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
                <p className="text-sm font-bold">{t("crm.people.noLearning")}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--brand-orange)]">
                    {t("crm.people.learningCourses")}
                  </h3>
                  {learning.courses.map((courseItem) => (
                    <div
                      key={courseItem.course.id}
                      className="flex items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border-primary)] bg-primary"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate">{courseItem.course.title}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">
                          {courseItem.progress?.percent || 0}% · {courseItem.progress?.completedLessons || 0} / {courseItem.progress?.totalLessons || 0}{" "}
                          {t("crm.people.lessons").toLowerCase()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            courseItem.progress?.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : courseItem.progress?.status === "in_progress"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-tertiary text-[var(--text-secondary)] border-[var(--border-primary)]"
                          }`}
                        >
                          {courseItem.progress?.status === "completed"
                            ? t("crm.people.completedStatus")
                            : courseItem.progress?.status === "in_progress"
                              ? t("status.inProgress")
                              : t("crm.people.notStarted")}
                        </span>
                        {courseItem.certificate && (
                          <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            {t("crm.people.certificate")} · {courseItem.certificate.certificate_number}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {learning.certificates.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[var(--brand-orange)]">
                      {t("crm.people.learningCertificates")}
                    </h3>
                    {learning.certificates.map((certificate) => (
                      <div
                        key={certificate.certificate_number}
                        className="flex items-center justify-between gap-3 p-4 rounded-xl border border-[var(--border-primary)] bg-primary"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{certificate.course_title}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-0.5">
                            {certificate.certificate_number} · {certificate.learner_name}
                          </p>
                        </div>
                        <span className="shrink-0 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          {certificate.status === "valid" ? t("crm.people.certificateValid") : t("crm.people.certificateRevoked")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Membership Tab — organizational/group memberships (CRM relationship) */}
        {tab === "membership" && (
          <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-6">
            <MembershipSection cid={cid} t={t} lang={lang} />
          </div>
        )}

      </div>
    </>
  );
}
