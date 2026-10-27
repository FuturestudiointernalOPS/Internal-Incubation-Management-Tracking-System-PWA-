"use client";

import React, { useState } from "react";
import { Clock, FileText, Briefcase, Rocket, Upload, Mail, GraduationCap, Building2 } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import MembershipSection from "@/components/membership/MembershipSection";
import { useApi } from "@/lib/hooks/useApi";
import { useCrmCapabilities } from "@/components/crm/useCrmCapabilities";
import PersonHeader from "@/components/crm/people-detail/PersonHeader";
import PersonTabs from "@/components/crm/people-detail/PersonTabs";
import TimelineTab from "@/components/crm/people-detail/TimelineTab";
import EmailsTab from "@/components/crm/people-detail/EmailsTab";
import NotesTab from "@/components/crm/people-detail/NotesTab";
import MeetingsTab from "@/components/crm/people-detail/MeetingsTab";
import DocumentsTab from "@/components/crm/people-detail/DocumentsTab";
import ProgramsTab from "@/components/crm/people-detail/ProgramsTab";
import LearningTab from "@/components/crm/people-detail/LearningTab";
import {
  TIMELINE_LIMIT,
  pickContact,
  pickTimeline,
  pickRoles,
  pickProgramHistory,
  pickLearning,
  pickEmails,
} from "@/components/crm/people-detail/constants";

const EMPTY_EDIT = { name: "", email: "", phone: "", address: "" };

/**
 * PERSON RECORD — the one dossier, reachable from two doors.
 *
 * Rendered by the administration route and by the CRM workspace route; only
 * `basePath` differs (the back links). A person exists once, and the advanced
 * CRM must never grow a second record of the same human being.
 *
 * WHAT IS PROTECTED BY WHICH RIGHT (all existing, none invented):
 *  - reading the record and its person-domain tabs → `contacts.view`
 *  - the membership tab → `org_membership.view` (its endpoint's own floor)
 *  - correcting the coordinates → `contacts.edit`
 *  - inviting the person → `contacts.create`
 * Every API re-authorizes; these gates only keep the screen free of impossible
 * actions.
 */
export default function PersonRecordScreen({ cid, basePath = "/admin/crm" }) {
  const { t, lang } = useI18n();
  const { alert } = useDialogs();
  const goBack = useSafeBack(basePath);
  const { holds, loaded: permissionsLoaded } = useCrmCapabilities();

  const canReadPeople = holds("contacts", "view");
  const canEditPeople = holds("contacts", "edit");
  const canInvitePeople = holds("contacts", "create");
  const canSeeMembership = holds("org_membership", "view");
  // Notes, meetings and documents are CRM-authored events, so they follow the
  // CRM right; programme and learning data follow their own domains. This is the
  // same rule the timeline applies to its events.
  const canSeeCrm = holds("crm", "view");
  const canSeePrograms = holds("programs", "view");
  const canSeeLearning = holds("lms", "view");

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

  // Coordinates
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [savingEdit, setSavingEdit] = useState(false);

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
    !permissionsLoaded ||
    contactLoading ||
    eventsLoading ||
    rolesLoading ||
    programsLoading ||
    learningLoading ||
    emailsLoading;

  const currentRoles = roles.filter(roleAssignment => roleAssignment.is_current);
  const pastRoles = roles.filter(roleAssignment => !roleAssignment.is_current);

  // Tab list. A tab whose domain right is missing is not shown: the record is
  // the person's, but each block of it belongs to the module that protects it.
  const tabs = [
    { key: "timeline", label: t("crm.people.tabTimeline"), icon: Clock, visible: canReadPeople },
    { key: "emails", label: t("crm.people.tabEmails"), icon: Mail, visible: canReadPeople },
    { key: "programs", label: t("crm.people.tabPrograms"), icon: Rocket, visible: canSeePrograms },
    { key: "learning", label: t("crm.people.tabLearning"), icon: GraduationCap, visible: canSeeLearning },
    { key: "membership", label: t("crm.people.tabMembership"), icon: Building2, visible: canSeeMembership },
    { key: "notes", label: t("crm.people.tabNotes"), icon: FileText, visible: canSeeCrm },
    { key: "meetings", label: t("crm.people.tabMeetings"), icon: Briefcase, visible: canSeeCrm },
    { key: "documents", label: t("crm.people.tabDocuments"), icon: Upload, visible: canSeeCrm },
  ].filter(tabItem => tabItem.visible);

  const visibleTabKeys = tabs.map(tabItem => tabItem.key);

  // Never land on a tab the reader's rights do not include. Derived, not
  // synchronised, so no effect has to correct the state after a render.
  const activeTab = visibleTabKeys.includes(tab) ? tab : (visibleTabKeys[0] ?? "timeline");

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
    crm: events.filter(event => event.context_module === "crm").length,
    forms: events.filter(event => event.context_module === "forms").length,
    programs: events.filter(event => event.context_module === "programs").length,
    ventures: events.filter(event => event.context_module === "ventures").length,
    investors: events.filter(event => event.context_module === "investors").length,
    comms: events.filter(event => event.context_module === "communications").length,
  };

  async function reloadTimeline() {
    const response = await fetch(`/api/contacts/${cid}/timeline?limit=200`);
    const data = await response.json();
    if (data.success) setEvents(data.events || []);
  }

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
      await reloadTimeline();
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
      await reloadTimeline();
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

  function openEdit() {
    setEditForm({
      name: contact?.name ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      address: contact?.address ?? "",
    });
    setShowEdit(true);
  }

  async function handleSaveEdit() {
    if (!editForm.name.trim() || !editForm.email.trim()) {
      await alert({ message: t("crm.people.nameAndEmailRequired") });
      return;
    }
    setSavingEdit(true);
    try {
      const response = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid,
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setShowEdit(false);
        refreshContact();
      } else {
        await alert({ message: t(data.error || "errors.somethingWrong") });
      }
    } catch {
      await alert({ message: t("errors.somethingWrong") });
    } finally {
      setSavingEdit(false);
    }
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
        await reloadTimeline();
      }
    } catch (_) {}
    setUploading(false);
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-[var(--text-secondary)]">{t("crm.people.loading")}</div>
    );
  }

  if (!contact) {
    return (
      <div className="p-8 text-center text-sm text-[var(--text-secondary)]">{t("crm.people.contactNotFound")}</div>
    );
  }

  const invitationStatus =
    contact.invitation_status ||
    (contact.status === "active" ? "activated" : "not_invited");

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <PersonHeader
        contact={contact}
        currentRoles={currentRoles}
        pastRoles={pastRoles}
        invitationStatus={invitationStatus}
        inviting={inviting}
        inviteMessage={inviteMessage}
        t={t}
        basePath={basePath}
        canInvite={canInvitePeople}
        canEdit={canEditPeople}
        onBack={goBack}
        onInvite={handleInviteUser}
        onEdit={openEdit}
      />

      <PersonTabs tabs={tabs} active={activeTab} onChange={setTab} />

      {activeTab === "timeline" && (
        <TimelineTab
          panelCounts={panelCounts}
          moduleFilter={moduleFilter}
          onModuleFilter={setModuleFilter}
          events={events}
          eventsByYear={eventsByYear}
          sortedYears={sortedYears}
          contact={contact}
          t={t}
          lang={lang}
        />
      )}

      {activeTab === "emails" && <EmailsTab emails={emails} t={t} lang={lang} />}

      {activeTab === "notes" && (
        <NotesTab
          noteText={noteText}
          onNoteTextChange={setNoteText}
          savingNote={savingNote}
          onAddNote={handleAddNote}
          events={events}
          t={t}
          lang={lang}
        />
      )}

      {activeTab === "meetings" && (
        <MeetingsTab
          showMeeting={showMeeting}
          onToggleForm={setShowMeeting}
          meetingDate={meetingDate}
          onMeetingDateChange={setMeetingDate}
          meetingSummary={meetingSummary}
          onMeetingSummaryChange={setMeetingSummary}
          meetingAttendees={meetingAttendees}
          onMeetingAttendeesChange={setMeetingAttendees}
          meetingOutcome={meetingOutcome}
          onMeetingOutcomeChange={setMeetingOutcome}
          savingMeeting={savingMeeting}
          onAddMeeting={handleAddMeeting}
          events={events}
          t={t}
          lang={lang}
        />
      )}

      {activeTab === "documents" && (
        <DocumentsTab uploading={uploading} onFileUpload={handleFileUpload} events={events} t={t} lang={lang} />
      )}

      {activeTab === "programs" && <ProgramsTab programs={programs} t={t} />}

      {activeTab === "learning" && <LearningTab learning={learning} t={t} />}

      {/* Membership Tab — organizational/group memberships (CRM relationship) */}
      {activeTab === "membership" && (
        <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-6">
          <MembershipSection cid={cid} t={t} lang={lang} />
        </div>
      )}

      <AppModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title={t("crm.people.editCoordinates")}
      >
        <div className="space-y-4">
          <AppInput
            label={t("crm.people.nameLabel")}
            value={editForm.name}
            onChange={event => setEditForm(form => ({ ...form, name: event.target.value }))}
          />
          <AppInput
            label={t("crm.people.emailLabel")}
            type="email"
            value={editForm.email}
            onChange={event => setEditForm(form => ({ ...form, email: event.target.value }))}
          />
          <AppInput
            label={t("crm.people.phoneLabel")}
            value={editForm.phone}
            onChange={event => setEditForm(form => ({ ...form, phone: event.target.value }))}
          />
          <AppInput
            label={t("crm.people.addressLabel")}
            value={editForm.address}
            onChange={event => setEditForm(form => ({ ...form, address: event.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <AppButton variant="ghost" onClick={() => setShowEdit(false)} disabled={savingEdit}>
              {t("common.cancel")}
            </AppButton>
            <AppButton onClick={handleSaveEdit} loading={savingEdit}>
              {t("common.save")}
            </AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
