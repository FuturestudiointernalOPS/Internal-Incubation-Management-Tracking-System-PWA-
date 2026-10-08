"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FolderKanban, Users, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { notify } from "./notify";

// Module scope: the data hook keys its read on these.
const pickProjects = (payload) => (payload?.success ? payload.projects || [] : []);
const pickInvitations = (payload) => (payload?.success ? payload.invitations || [] : []);
const EMPTY = [];

const STATUS_LABELS = {
  Active: "staffMisc.projects.statusActive",
  Completed: "staffMisc.projects.statusCompleted",
  Paused: "staffMisc.projects.statusPaused",
};
const STATUS_TONE = { Active: "g", Completed: "b", Paused: "w" };

/**
 * MY PROJECTS — the projects the signed-in staff member belongs to, and the
 * invitations waiting for an answer.
 *
 * Reads:   GET /api/projects?user_cid=…                     (the projects)
 *          GET /api/projects/invitations?invitee_id=…        (the pending invitations)
 * Writes:  POST /api/projects/invitations/respond            (accept / decline)
 * Accepting an invitation re-reads the projects, so the project the person just
 * joined is in the list without a reload.
 */
export default function ProjectsView() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { cid } = useSessionUser();
  const [search, setSearch] = useState("");
  const [responding, setResponding] = useState(null);
  const [answered, setAnswered] = useState(() => new Set());

  const projectsRead = useApi(cid ? `/api/projects?user_cid=${encodeURIComponent(cid)}` : null, {
    defaultValue: EMPTY,
    transform: pickProjects,
    deps: [cid],
  });
  const invitationsRead = useApi(
    cid ? `/api/projects/invitations?invitee_id=${encodeURIComponent(cid)}&status=pending` : null,
    { defaultValue: EMPTY, transform: pickInvitations, deps: [cid] },
  );

  const projects = projectsRead.data;
  const invitations = invitationsRead.data.filter((invitation) => !answered.has(invitation.id));
  const loading = !cid || (projectsRead.loading && projects.length === 0);

  const respond = async (invitationId, action) => {
    setResponding(invitationId);
    try {
      const response = await fetch("/api/projects/invitations/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_id: invitationId, action }),
      });
      const data = await response.json();
      if (data.success) {
        setAnswered((previous) => new Set(previous).add(invitationId));
        if (action === "accept") projectsRead.refresh();
        invitationsRead.refresh();
      } else {
        notify("error", data.error || t("staffMisc.projects.failedToRespond"));
      }
    } catch {
      notify("error", t("staffMisc.projects.networkError"));
    } finally {
      setResponding(null);
    }
  };

  const needle = search.trim().toLowerCase();
  const visible = projects.filter(
    (project) => !needle || project.name?.toLowerCase().includes(needle) || (project.meta?.description || "").toLowerCase().includes(needle),
  );
  const isLead = (project) => project.members?.some((member) => member.user_cid === cid && member.role === "lead");
  const tasksOf = (project) => ({ total: project.task_summary?.total || 0, done: project.task_summary?.completed || 0 });
  const shortDate = (value) => (value ? new Date(value).toLocaleDateString(lang, { month: "short", day: "numeric" }) : "—");

  const kpis = [
    [t("staffMisc.front.projects.kpiProjects"), projects.length],
    [t("staffMisc.front.projects.kpiLead"), projects.filter(isLead).length],
    [t("staffMisc.front.projects.kpiInvitations"), invitations.length],
    [t("staffMisc.front.projects.kpiTasks"), projects.reduce((sum, project) => sum + tasksOf(project).total, 0)],
  ];

  return (
    <div className="stf" style={{ paddingBottom: 60 }}>
      <div className="stf-head">
        <div>
          <h1 className="stf-title">{t("staffMisc.projects.title")}</h1>
          <p className="stf-sub">{t("staffMisc.projects.subtitle")}</p>
        </div>
      </div>

      <div className="stf-grid">
        {kpis.map(([label, value]) => (
          <div key={label} className="stf-card stf-kpi">
            <div className="stf-k">
              <span>{label}</span>
              <FolderKanban size={15} />
            </div>
            <div className="big">{loading ? "…" : value}</div>
          </div>
        ))}
      </div>

      {invitations.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, margin: "0 0 10px", display: "flex", gap: 8, alignItems: "center" }}>
            <Users size={15} style={{ color: "var(--brand-orange)" }} />
            {t("staffMisc.projects.invitations", { count: invitations.length })}
          </h3>
          {invitations.map((invitation) => (
            <div key={invitation.id} className="stf-inv">
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{invitation.project_name || t("staffMisc.projects.defaultProject")}</b>
                <div className="stf-small">{t("staffMisc.projects.invitedYou")}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="stf-btn sm rj" disabled={responding === invitation.id} onClick={() => respond(invitation.id, "decline")}>
                  <X size={13} /> {t("staffMisc.projects.decline")}
                </button>
                <button type="button" className="stf-btn sm ok" disabled={responding === invitation.id} onClick={() => respond(invitation.id, "accept")}>
                  <Check size={13} /> {t("staffMisc.projects.accept")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="stf-bar">
        <input className="stf-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("common.search")} aria-label={t("common.search")} />
      </div>

      {loading ? (
        <div className="stf-empty">{t("common.loading")}</div>
      ) : visible.length === 0 ? (
        <div className="stf-card stf-empty">
          <FolderKanban size={30} />
          <b>{search ? t("common.noResults") : t("staffMisc.projects.noProjectsAssigned")}</b>
          {!search && <div className="stf-small">{t("staffMisc.projects.noProjectsHint")}</div>}
        </div>
      ) : (
        <div className="stf-grid g3">
          {visible.map((project) => {
            const { total, done } = tasksOf(project);
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;
            const lead = isLead(project);
            return (
              <button key={project.id} type="button" className="stf-pc" onClick={() => router.push(`/staff/projects/${project.id}`)}>
                <h4>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{project.name}</span>
                  <span className={`stf-tag ${STATUS_TONE[project.status] || "g"}`}>
                    {project.status ? t(STATUS_LABELS[project.status] || project.status) : t("staffMisc.projects.statusActive")}
                  </span>
                </h4>
                {project.meta?.description && <p>{project.meta.description}</p>}
                {total > 0 && (
                  <div>
                    <div className="stf-bar-prog"><i style={{ width: `${progress}%` }} /></div>
                    <div className="stf-small" style={{ marginTop: 0 }}>{t("staffMisc.projects.progress")} · {progress}%</div>
                  </div>
                )}
                <div className="ft">
                  <span title={t("staffMisc.projects.members")}><Users size={13} />{project.members?.length || 0}</span>
                  <span title={t("staffMisc.projects.tasks")}><Check size={13} />{done}/{total}</span>
                  <span title={t("staffMisc.projects.timeline")}>{shortDate(project.start_date)} → {shortDate(project.end_date)}</span>
                </div>
                <div className="ft">
                  {project.program_name && <span>{t("staffMisc.projects.program")}: {project.program_name}</span>}
                  <span className={`stf-tag ${lead ? "o" : ""}`} style={{ marginLeft: "auto" }}>
                    {lead ? t("staffMisc.projects.youAreLead") : t("staffMisc.projects.member")}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
