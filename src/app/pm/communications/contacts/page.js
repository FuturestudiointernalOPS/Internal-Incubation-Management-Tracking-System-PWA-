"use client";
import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Send,
  Shield,
  Briefcase,
  ChevronRight,
  Mail,
  Phone,
  MessageCircle,
  User,
  Layers,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/**
 * PM GROUPS — organized view of cohorts, teams, and staff assigned to the PM's programs.
 *
 * Left sidebar: program list (from PM's assignments)
 * Main area: grouped cards showing participants or teams per program
 */
export default function PMGroups() {
  const [programs, setPrograms] = useState([]);
  const [groups, setGroups] = useState({});
  const [teams, setTeams] = useState({});
  const [staff, setStaff] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("participants"); // 'participants' | 'teams' | 'staff'
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const uid = user.cid || user.id;
    if (!uid) return;

    const fetchData = async (bypassCache = false) => {
      setLoading(true);
      let painted = false;
      try {
        // 1. Fetch PM's programs
        const progsUrl = `/api/pm/programs?assigned_pm_id=${uid}`;

        // Sync all page state from the program list + per-program full states.
        const apply = (myProgs, states) => {
          setPrograms(myProgs);
          if (myProgs.length === 0) return;

          // Auto-select first program
          setSelectedProgram(myProgs[0].id);

          // Organize by program
          const groupsMap = {};
          const teamsMap = {};
          const staffMap = {};

          myProgs.forEach((p, i) => {
            const state = states[i];
            if (!state?.success) return;

            // Participants
            const participants = (state.participants || []).filter(
              (part) => part.name || part.email,
            );
            // Deduplicate by email
            const unique = Array.from(
              new Map(participants.map((part) => [part.email, part])).values(),
            );
            groupsMap[p.id] = unique;

            // Teams
            teamsMap[p.id] = state.teams || [];

            // Staff (assigned staff for this program)
            staffMap[p.id] = state.assignedStaff || [];
          });

          setGroups(groupsMap);
          setTeams(teamsMap);
          setStaff(staffMap);
        };

        // Cache-first paint: returning to this page renders instantly when the
        // program list and every program's full-state snapshot are all fresh;
        // the network refresh below converges.
        if (!bypassCache) {
          const cachedProgs = cacheGet(progsUrl);
          if (cachedProgs !== null && cachedProgs.success) {
            const progList = cachedProgs.programs || [];
            const cachedStates = progList.map((p) =>
              cacheGet(`/api/pm/full-state?id=${p.id}`),
            );
            if (cachedStates.every((c) => c !== null && c.success)) {
              apply(progList, cachedStates);
              painted = true;
              setLoading(false);
            }
          }
        }

        const progRes = await fetch(progsUrl);
        const progData = await progRes.json();
        const myProgs = progData.programs || [];
        if (progData.success) cacheSet(progsUrl, progData);

        if (myProgs.length === 0) {
          apply(myProgs, []);
          return;
        }

        // 2. Fetch full state for each program
        const stateUrls = myProgs.map((p) => `/api/pm/full-state?id=${p.id}`);
        const statePromises = stateUrls.map((u) =>
          fetch(u)
            .then((r) => r.json())
            .catch(() => ({ success: false })),
        );
        const states = await Promise.all(statePromises);

        // Distinct per-program URLs cache independently.
        stateUrls.forEach((u, i) => {
          if (states[i]?.success) cacheSet(u, states[i]);
        });

        apply(myProgs, states);
      } catch (err) {
        if (!painted) console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const currentProgram = programs.find((p) => p.id === selectedProgram);

  const currentItems =
    tab === "participants"
      ? groups[selectedProgram] || []
      : tab === "teams"
        ? teams[selectedProgram] || []
        : staff[selectedProgram] || [];

  const filteredItems = currentItems.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (item.name || "").toLowerCase().includes(q) ||
      (item.email || "").toLowerCase().includes(q) ||
      (item.role || "").toLowerCase().includes(q) ||
      (item.group_name || "").toLowerCase().includes(q) ||
      (item.handler_name || "").toLowerCase().includes(q)
    );
  });

  const totalAcrossAll =
    Object.values(groups).reduce((a, b) => a + b.length, 0) +
    Object.values(teams).reduce((a, b) => a + b.length, 0) +
    Object.values(staff).reduce((a, b) => a + b.length, 0);

  return (
    <>
      <div className="h-[calc(100vh-80px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-[var(--border-primary)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-[var(--brand-orange)]" />
            <h1 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
              {t("pmMisc.contacts.myGroups")}
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-tertiary text-[var(--text-secondary)] text-[10px] font-bold">
              {programs.length} {t("pmMisc.contacts.programs")} · {totalAcrossAll}{" "}
              {t("pmMisc.contacts.contacts")}
            </span>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder={t("pmMisc.contacts.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[11px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] transition-all"
            />
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* ───── Programs Sidebar ───── */}
          <div className="w-56 lg:w-64 flex-shrink-0 border-r border-[var(--border-primary)] bg-tertiary/20 flex flex-col">
            <div className="p-3 border-b border-[var(--border-primary)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("pmMisc.contacts.myPrograms")}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {programs.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] text-center py-8">
                  {t("pmMisc.contacts.noProgramsAssigned")}
                </p>
              ) : (
                programs.map((prog) => {
                  const isActive = selectedProgram === prog.id;
                  const count =
                    (groups[prog.id]?.length || 0) +
                    (teams[prog.id]?.length || 0) +
                    (staff[prog.id]?.length || 0);
                  return (
                    <button
                      key={prog.id}
                      onClick={() => setSelectedProgram(prog.id)}
                      className={cn(
                        "w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-2.5",
                        isActive
                          ? "bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/20"
                          : "hover:bg-tertiary border border-transparent",
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          isActive
                            ? "bg-[var(--brand-orange)]/20 text-[var(--brand-orange)]"
                            : "bg-tertiary text-[var(--text-secondary)]",
                        )}
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-[10px] truncate",
                            isActive
                              ? "font-black text-[var(--text-primary)]"
                              : "font-bold text-[var(--text-secondary)]",
                          )}
                        >
                          {prog.name}
                        </p>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                          {count}{" "}
                          {count !== 1
                            ? t("pmMisc.contacts.contacts")
                            : t("pmMisc.contacts.contact")}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ───── Main Content ───── */}
          <div className="flex-1 flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !selectedProgram ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center px-6">
                  <Users className="w-16 h-16 text-[var(--text-secondary)] mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-bold text-[var(--text-secondary)]">
                    {t("pmMisc.contacts.selectProgram")}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-50">
                    {t("pmMisc.contacts.selectProgramHint")}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Program header + tabs */}
                <div className="px-4 lg:px-6 py-3 border-b border-[var(--border-primary)] flex-shrink-0 bg-tertiary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
                      <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                        {currentProgram?.name || t("pmMisc.contacts.program")}
                      </h2>
                    </div>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {filteredItems.length}{" "}
                      {filteredItems.length !== 1
                        ? t("pmMisc.contacts.items")
                        : t("pmMisc.contacts.item")}
                    </span>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 mt-3">
                    {[
                      {
                        id: "participants",
                        label: t("pmMisc.contacts.tabParticipants"),
                        icon: Users,
                      },
                      {
                        id: "teams",
                        label: t("pmMisc.contacts.tabTeams"),
                        icon: Layers,
                      },
                      {
                        id: "staff",
                        label: t("pmMisc.contacts.tabStaff"),
                        icon: Shield,
                      },
                    ].map((tabItem) => (
                      <button
                        key={tabItem.id}
                        onClick={() => setTab(tabItem.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all",
                          tab === tabItem.id
                            ? "bg-[var(--brand-orange)] text-black"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary",
                        )}
                      >
                        <tabItem.icon className="w-3 h-3" />
                        {tabItem.label}
                        <span className="opacity-50">
                          {tabItem.id === "participants"
                            ? groups[selectedProgram]?.length || 0
                            : tabItem.id === "teams"
                              ? teams[selectedProgram]?.length || 0
                              : staff[selectedProgram]?.length || 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items grid */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-6">
                  {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Users className="w-12 h-12 text-[var(--text-secondary)] mb-3 opacity-20" />
                      <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                        {tab === "participants"
                          ? t("pmMisc.contacts.noParticipantsFound")
                          : tab === "teams"
                            ? t("pmMisc.contacts.noTeamsFound")
                            : t("pmMisc.contacts.noStaffFound")}
                      </p>
                      <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 opacity-50">
                        {search
                          ? t("pmMisc.contacts.tryDifferentSearch")
                          : tab === "participants"
                            ? t("pmMisc.contacts.noAssignedParticipants")
                            : tab === "teams"
                              ? t("pmMisc.contacts.noAssignedTeams")
                              : t("pmMisc.contacts.noAssignedStaff")}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {filteredItems.map((item) => {
                        const name =
                          item.name ||
                          item.handler_name ||
                          t("pmMisc.contacts.unnamed");
                        const email = item.email || "";
                        const role =
                          tab === "participants"
                            ? item.group_name || t("pmMisc.contacts.participant")
                            : tab === "teams"
                              ? item.handler_name
                                ? t("pmMisc.contacts.leadWithName", {
                                    name: item.handler_name,
                                  })
                                : t("pmMisc.contacts.team")
                              : item.role || t("pmMisc.contacts.staff");
                        const identifier = item.cid || item.id;
                        const phone = item.phone || "";

                        return (
                          <div
                            key={identifier || name}
                            className="p-4 rounded-xl bg-primary border border-[var(--border-primary)] hover:border-[var(--brand-orange)]/20 transition-all group"
                          >
                            <div className="flex items-start gap-3">
                              {/* Avatar */}
                              <div className="w-10 h-10 rounded-full bg-tertiary flex items-center justify-center text-[12px] font-black uppercase shrink-0 text-[var(--text-secondary)]">
                                {(name || "?").charAt(0)}
                              </div>

                              {/* Info */}
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-tight truncate">
                                  {name}
                                </p>
                                <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-0.5 truncate">
                                  {role}
                                </p>
                                {email && (
                                  <a
                                    href={`mailto:${email}`}
                                    className="text-[10px] text-[var(--brand-orange)] mt-1 block truncate hover:underline"
                                  >
                                    {email}
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-primary)] opacity-0 group-hover:opacity-100 transition-all">
                              {email && (
                                <a
                                  href={`mailto:${email}`}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--brand-orange)] hover:border-[var(--brand-orange)]/20 transition-all text-[10px] font-bold uppercase tracking-wide"
                                >
                                  <Mail className="w-3 h-3" />
                                  {t("pmMisc.contacts.email")}
                                </a>
                              )}
                              {phone && (
                                <a
                                  href={`tel:${phone}`}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-emerald-400 hover:border-emerald-500/20 transition-all text-[10px] font-bold uppercase tracking-wide"
                                >
                                  <Phone className="w-3 h-3" />
                                  {t("pmMisc.contacts.call")}
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
