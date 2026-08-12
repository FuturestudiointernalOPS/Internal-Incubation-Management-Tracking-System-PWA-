"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { User, Clock, FileText, Briefcase, Rocket, MessageSquare, Upload, Plus, ArrowLeft, Check, X } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

const MODULE_COLORS = {
  forms: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  programs: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ventures: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  investors: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  communications: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  crm: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  system: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export default function CrmDetailPage({ params }) {
  const { cid } = use(params);
  const router = useRouter();
  const { t } = useI18n();

  const [contact, setContact] = useState(null);
  const [events, setEvents] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (!cid) return;
    async function load() {
      setLoading(true);
      try {
        const [contactRes, timelineRes, rolesRes] = await Promise.all([
          fetch("/api/contacts?cid=" + cid).then(r => r.json()),
          fetch(`/api/contacts/${cid}/timeline?limit=200${moduleFilter ? "&module=" + moduleFilter : ""}`).then(r => r.json()),
          fetch(`/api/contacts/${cid}/roles`).then(r => r.json()),
        ]);
        if (contactRes.contacts?.length > 0) setContact(contactRes.contacts[0]);
        if (timelineRes.success) setEvents(timelineRes.events || []);
        if (rolesRes.success) setRoles(rolesRes.roles || []);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    load();
  }, [cid, moduleFilter]);

  const currentRoles = roles.filter(r => r.is_current);
  const pastRoles = roles.filter(r => !r.is_current);

  // Group events by year
  const eventsByYear = {};
  for (const ev of events) {
    const year = new Date(ev.created_at).getFullYear();
    if (!eventsByYear[year]) eventsByYear[year] = [];
    eventsByYear[year].push(ev);
  }
  const sortedYears = Object.keys(eventsByYear).sort((a, b) => b - a);

  // Quick panel counts
  const panelCounts = {
    forms: events.filter(e => e.context_module === "forms").length,
    programs: events.filter(e => e.context_module === "programs").length,
    ventures: events.filter(e => e.context_module === "ventures").length,
    investors: events.filter(e => e.context_module === "investors").length,
    comms: events.filter(e => e.context_module === "communications").length,
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
      const res = await fetch(`/api/contacts/${cid}/timeline?limit=200`);
      const data = await res.json();
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
      const res = await fetch(`/api/contacts/${cid}/timeline?limit=200`);
      const data = await res.json();
      if (data.success) setEvents(data.events || []);
    } catch (_) {}
    setSavingMeeting(false);
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
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
            description: `Attached: ${file.name}`,
            metadata: { file_url: uploadData.url, file_name: file.name },
          }),
        });
        const res = await fetch(`/api/contacts/${cid}/timeline?limit=200`);
        const data = await res.json();
        if (data.success) setEvents(data.events || []);
      }
    } catch (_) {}
    setUploading(false);
  }

  if (loading) {
    return (
      <DashboardLayout role="super_admin" activeTab="crm">
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">{t("crm.people.loading")}</div>
      </DashboardLayout>
    );
  }

  if (!contact) {
    return (
      <DashboardLayout role="super_admin" activeTab="crm">
        <div className="p-8 text-center text-sm text-[var(--text-secondary)]">{t("crm.people.contactNotFound")}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="super_admin" activeTab="crm">
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* Back link */}
        <Link href="/admin/crm" className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)]">
          {t("crm.people.backToCrmDashboard")}
        </Link>

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
                {currentRoles.map(r => (
                  <span key={r.id} className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">
                    {r.role}
                  </span>
                ))}
                {pastRoles.length > 0 && (
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-tertiary text-[var(--text-secondary)]">
                    {t("crm.people.previousCount", { count: pastRoles.length })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--border-primary)] pb-0">
          {[
            { key: "timeline", label: t("crm.people.tabTimeline"), icon: Clock },
            { key: "notes", label: t("crm.people.tabNotes"), icon: FileText },
            { key: "meetings", label: t("crm.people.tabMeetings"), icon: Briefcase },
            { key: "documents", label: t("crm.people.tabDocuments"), icon: Upload },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider border-b-2 transition-colors ${
                tab === item.key
                  ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
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
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setModuleFilter(moduleFilter === p.key ? "" : p.key)}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    moduleFilter === p.key
                      ? "border-[var(--brand-orange)] bg-[var(--brand-orange)]/5"
                      : "border-[var(--border-primary)] hover:border-[var(--brand-orange)]/50"
                  }`}
                >
                  <p className="text-lg font-black">{p.count}</p>
                  <p className="text-[9px] font-bold uppercase text-[var(--text-secondary)]">{p.label}</p>
                </button>
              ))}
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {["", "forms", "programs", "ventures", "investors", "communications", "system"].map(f => (
                <button
                  key={f}
                  onClick={() => setModuleFilter(f)}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-colors ${
                    moduleFilter === f ? "bg-[var(--brand-orange)] text-black border-orange-600" : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]"
                  }`}
                >
                  {f || t("crm.people.all")}
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
                      {eventsByYear[year].map(ev => (
                        <div key={ev.id} className="relative pl-5 pb-3">
                          <div className="absolute left-[-23px] top-1.5 w-2 h-2 rounded-full bg-[var(--border-primary)] border-2 border-primary" />
                          <div className="bg-primary border border-[var(--border-primary)] rounded-xl p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold">{ev.description}</p>
                              {ev.context_module && (
                                <span className={`shrink-0 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full border ${MODULE_COLORS[ev.context_module] || MODULE_COLORS.system}`}>
                                  {ev.context_module}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                              {new Date(ev.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
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

        {/* Notes Tab */}
        {tab === "notes" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t("crm.people.notePlaceholder")}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddNote()}
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
              {events.filter(e => e.event_type === "note_added").map(ev => (
                <div key={ev.id} className="bg-primary border border-[var(--border-primary)] rounded-xl p-3">
                  <p className="text-sm">{ev.description}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {new Date(ev.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
              {events.filter(e => e.event_type === "note_added").length === 0 && (
                <p className="text-xs text-[var(--text-secondary)] italic py-4">{t("crm.people.noNotes")}</p>
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
                  onChange={e => setMeetingDate(e.target.value)}
                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
                />
                <input
                  type="text"
                  placeholder={t("crm.people.meetingSummaryPlaceholder")}
                  value={meetingSummary}
                  onChange={e => setMeetingSummary(e.target.value)}
                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
                />
                <input
                  type="text"
                  placeholder={t("crm.people.meetingAttendeesPlaceholder")}
                  value={meetingAttendees}
                  onChange={e => setMeetingAttendees(e.target.value)}
                  className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-orange)]"
                />
                <textarea
                  placeholder={t("crm.people.meetingOutcomePlaceholder")}
                  value={meetingOutcome}
                  onChange={e => setMeetingOutcome(e.target.value)}
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
              {events.filter(e => e.event_type === "meeting_held").map(ev => (
                <div key={ev.id} className="bg-primary border border-[var(--border-primary)] rounded-xl p-3">
                  <p className="text-sm font-bold">{ev.description}</p>
                  {ev.metadata && (
                    <div className="text-[10px] text-[var(--text-secondary)] mt-1 space-y-0.5">
                      {ev.metadata.date && <p>{t("crm.people.metaDate")} {ev.metadata.date}</p>}
                      {ev.metadata.attendees && <p>{t("crm.people.metaAttendees")} {ev.metadata.attendees}</p>}
                      {ev.metadata.outcome && <p>{t("crm.people.metaOutcome")} {ev.metadata.outcome}</p>}
                    </div>
                  )}
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {new Date(ev.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
              {events.filter(e => e.event_type === "meeting_held").length === 0 && (
                <p className="text-xs text-[var(--text-secondary)] italic py-4">{t("crm.people.noMeetings")}</p>
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
              {events.filter(e => e.event_type === "document_attached").map(ev => (
                <div key={ev.id} className="bg-primary border border-[var(--border-primary)] rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{ev.description}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      {new Date(ev.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  {ev.metadata?.file_url && (
                    <a href={ev.metadata.file_url} target="_blank" className="text-[10px] font-bold text-[var(--brand-orange)] uppercase">
                      {t("crm.people.download")}
                    </a>
                  )}
                </div>
              ))}
              {events.filter(e => e.event_type === "document_attached").length === 0 && (
                <p className="text-xs text-[var(--text-secondary)] italic py-4">{t("crm.people.noDocuments")}</p>
              )}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
