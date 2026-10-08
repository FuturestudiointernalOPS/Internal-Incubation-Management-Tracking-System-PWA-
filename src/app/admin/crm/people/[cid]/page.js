"use client";

import React, { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Clock, FileText, Briefcase, Rocket, Upload, Mail, GraduationCap, Building2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import MembershipSection from "@/components/membership/MembershipSection";
import { useApi } from "@/lib/hooks/useApi";
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

  const tabs = [
    { key: "timeline", label: t("crm.people.tabTimeline"), icon: Clock },
    { key: "emails", label: t("crm.people.tabEmails"), icon: Mail },
    { key: "programs", label: t("crm.people.tabPrograms"), icon: Rocket },
    { key: "learning", label: t("crm.people.tabLearning"), icon: GraduationCap },
    { key: "membership", label: t("crm.people.tabMembership"), icon: Building2 },
    { key: "notes", label: t("crm.people.tabNotes"), icon: FileText },
    { key: "meetings", label: t("crm.people.tabMeetings"), icon: Briefcase },
    { key: "documents", label: t("crm.people.tabDocuments"), icon: Upload },
  ];

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <PersonHeader
          contact={contact}
          currentRoles={currentRoles}
          pastRoles={pastRoles}
          invitationStatus={invitationStatus}
          inviting={inviting}
          inviteMessage={inviteMessage}
          t={t}
          onBack={goBack}
          onInvite={handleInviteUser}
        />

        <PersonTabs tabs={tabs} active={tab} onChange={setTab} />

        {tab === "timeline" && (
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

        {tab === "emails" && <EmailsTab emails={emails} t={t} lang={lang} />}

        {tab === "notes" && (
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

        {tab === "meetings" && (
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

        {tab === "documents" && (
          <DocumentsTab uploading={uploading} onFileUpload={handleFileUpload} events={events} t={t} lang={lang} />
        )}

        {tab === "programs" && <ProgramsTab programs={programs} t={t} />}

        {tab === "learning" && <LearningTab learning={learning} t={t} />}

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
