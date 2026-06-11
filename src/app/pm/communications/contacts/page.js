"use client";
import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
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

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const uid = user.cid || user.id;
    if (!uid) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch PM's programs
        const progRes = await fetch(`/api/pm/programs?assigned_pm_id=${uid}`);
        const progData = await progRes.json();
        const myProgs = progData.programs || [];
        setPrograms(myProgs);

        if (myProgs.length === 0) {
          setLoading(false);
          return;
        }

        // Auto-select first program
        setSelectedProgram(myProgs[0].id);

        // 2. Fetch full state for each program
        const statePromises = myProgs.map((p) =>
          fetch(`/api/pm/full-state?id=${p.id}`).then((r) => r.json()),
        );
        const states = await Promise.all(statePromises);

        // 3. Organize by program
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
      } catch (err) {
        console.error(err);
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
    <DashboardLayout role="program_manager" activeTab="communication">
      <div className="h-[calc(100vh-80px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-[var(--border-primary)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-[var(--brand-orange)]" />
            <h1 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
              My Groups
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-tertiary text-[var(--text-secondary)] text-[8px] font-black">
              {programs.length} programs · {totalAcrossAll} contacts
            </span>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search..."
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
              <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                My Programs
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {programs.length === 0 ? (
                <p className="text-[10px] text-[var(--text-secondary)] italic text-center py-8">
                  No programs assigned
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
                        <p className="text-[7px] text-[var(--text-secondary)] mt-0.5">
                          {count} contact{count !== 1 ? "s" : ""}
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
                    Select a program
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1 opacity-50">
                    Choose a program from the sidebar to view its groups and
                    contacts
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
                        {currentProgram?.name || "Program"}
                      </h2>
                    </div>
                    <span className="text-[9px] text-[var(--text-secondary)]">
                      {filteredItems.length} item
                      {filteredItems.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 mt-3">
                    {[
                      {
                        id: "participants",
                        label: "Participants",
                        icon: Users,
                      },
                      { id: "teams", label: "Teams", icon: Layers },
                      { id: "staff", label: "Staff", icon: Shield },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                          tab === t.id
                            ? "bg-[var(--brand-orange)] text-black"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary",
                        )}
                      >
                        <t.icon className="w-3 h-3" />
                        {t.label}
                        <span className="opacity-50">
                          {t.id === "participants"
                            ? groups[selectedProgram]?.length || 0
                            : t.id === "teams"
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
                        No {tab} found
                      </p>
                      <p className="text-[9px] text-[var(--text-secondary)] mt-1 opacity-50">
                        {search
                          ? "Try a different search term"
                          : "This program has no assigned " + tab}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {filteredItems.map((item) => {
                        const name =
                          item.name || item.handler_name || "Unnamed";
                        const email = item.email || "";
                        const role =
                          tab === "participants"
                            ? item.group_name || "Participant"
                            : tab === "teams"
                              ? item.handler_name
                                ? `Lead: ${item.handler_name}`
                                : "Team"
                              : item.role || "Staff";
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
                                <p className="text-[8px] font-bold text-[var(--text-secondary)] mt-0.5 truncate">
                                  {role}
                                </p>
                                {email && (
                                  <a
                                    href={`mailto:${email}`}
                                    className="text-[8px] text-[var(--brand-orange)] mt-1 block truncate hover:underline"
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
                                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--brand-orange)] hover:border-[var(--brand-orange)]/20 transition-all text-[8px] font-black uppercase tracking-widest"
                                >
                                  <Mail className="w-3 h-3" />
                                  Email
                                </a>
                              )}
                              {phone && (
                                <a
                                  href={`tel:${phone}`}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-emerald-400 hover:border-emerald-500/20 transition-all text-[8px] font-black uppercase tracking-widest"
                                >
                                  <Phone className="w-3 h-3" />
                                  Call
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
    </DashboardLayout>
  );
}
