"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Plus,
  Users,
  Mail,
  Phone,
  Search,
  X,
  Loader2,
  CheckCircle,
  Edit3,
  Shield,
  Key,
  MessageCircle,
  Send,
  Globe,
  Archive,
  ArrowLeft,
  RefreshCw,
  Link as LinkIcon,
  Copy,
  Check,
  UserCheck,
  UserX,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TableSkeleton } from "@/components/ui/Skeleton";

function ContactsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const roleParam = searchParams.get("role");

  const [contacts, setContacts] = useState([]);
  const [families, setFamilies] = useState([]);
  const [teams, setTeams] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("All Contacts");
  const [selectedTeamTab, setSelectedTeamTab] = useState("All Teams");
  const [showArchived, setShowArchived] = useState(false);
  const [copiedGroup, setCopiedGroup] = useState(null);
  const [isCsvUploading, setIsCsvUploading] = useState(false);

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [contactPrograms, setContactPrograms] = useState([]);
  const [showBulkProgramModal, setShowBulkProgramModal] = useState(false);
  const [bulkSelected, setBulkSelected] = useState([]);

  // Forms
  const [form, setForm] = useState({
    cid: "",
    name: "",
    email: "",
    phone: "",
    group_name: "",
    password: "",
  });
  const [credsForm, setCredsForm] = useState({
    cid: "",
    name: "",
    email: "",
    password: "",
  });
  const [showGroupModal, setShowGroupModal] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState("individual");
  const [newGroupProgramId, setNewGroupProgramId] = useState("");

  // Group Keys
  const [showGroupKeysModal, setShowGroupKeysModal] = useState(null);
  const [groupKeysForm, setGroupKeysForm] = useState({
    id: "",
    name: "",
    shared_email: "",
    shared_password_read: "",
    shared_password_edit: "",
  });

  // Feedback
  const [notification, setNotification] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All"); // All, Active, Inactive, Pending

  useEffect(() => {
    if (roleParam) {
      const normalized =
        roleParam.toLowerCase() === "staff" ? "Future Studio" : roleParam;
      setSelectedGroup(normalized);
    }
  }, [roleParam]);

  useEffect(() => {
    setSelectedTeamTab("All Teams");
  }, [selectedGroup]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [contRes, progRes] = await Promise.all([
        fetch("/api/contacts/full-state"),
        fetch("/api/pm/programs"),
      ]);
      const [contData, progData] = await Promise.all([
        contRes.json(),
        progRes.json(),
      ]);

      if (contData.success) {
        setContacts(contData.contacts || []);
        setFamilies(contData.families || []);
        setTeams(contData.teams || []);
      }
      if (progData.success) setPrograms(progData.programs || []);
    } catch (e) {
      console.error("Registry Sync Failure:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const generatePassword = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    return Array.from({ length: 10 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join("");
  };

  const toggleStatus = async (cid, currentStatus, currentGroup) => {
    const newStatus =
      currentStatus === "active" || currentStatus === "approved"
        ? "inactive"
        : "active";
    const payload = { cid, status: newStatus };
    // Role is auto-derived by the API from group membership
    try {
      await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveContact = async () => {
    setIsProcessing(true);
    try {
      const payload = { ...form, program_ids: contactPrograms };
      // Role is auto-derived by the API from group membership
      delete payload.role;
      const method = form.cid ? "PUT" : "POST";
      // Manual creation by super admin is implicit approval — set active
      if (method === "POST") payload.status = "active";
      const res = await fetch("/api/contacts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: "success", message: "Identity saved." });
        setShowManualModal(false);
        fetchData();
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleSaveGroup = async () => {
    if (!newGroupName.trim()) return;
    setIsProcessing(true);
    try {
      const isEdit = showGroupModal && typeof showGroupModal === "object";
      const res = await fetch("/api/families", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEdit ? showGroupModal.id : undefined,
          name: newGroupName.trim(),
          type: newGroupType,
          program_id: newGroupProgramId || null,
        }),
      });
      if ((await res.json()).success) {
        setNotification({ type: "success", message: "Segment synced." });
        setShowGroupModal(null);
        fetchData();
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleSaveGroupKeys = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/families", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupKeysForm),
      });
      if ((await res.json()).success) {
        setNotification({ type: "success", message: "Keys synced." });
        setShowGroupKeysModal(null);
        fetchData();
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleResetPassword = async (c) => {
    const newPass = generatePassword();
    setIsProcessing(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: c.cid, password: newPass }),
      });
      if ((await res.json()).success) {
        setCredsForm({ ...c, password: newPass });
        setShowCredsModal(true);
      } else {
        setNotification({
          type: "error",
          message: "Failed to reset password.",
        });
      }
    } catch (e) {
      setNotification({ type: "error", message: "Network error." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkApprove = async (mode = "selected") => {
    const targets =
      mode === "all"
        ? filtered.filter((c) => c.status === "pending").map((c) => c.cid)
        : selectedContacts;
    if (targets.length === 0) return;

    setIsProcessing(true);
    try {
      await Promise.all(
        targets.map((cid) =>
          fetch("/api/contacts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cid, status: "approved" }),
          }),
        ),
      );
      setNotification({
        type: "success",
        message: `${targets.length} members approved.`,
      });
      setSelectedContacts([]);
      fetchData();
    } catch (e) {
      console.error("Approval Failure:", e);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsCsvUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split("\n").filter((r) => r.trim());
        const headers = rows[0].split(",").map((h) => h.trim().toLowerCase());

        const nameIdx =
          headers.indexOf("name") !== -1
            ? headers.indexOf("name")
            : headers.indexOf("fullname");
        const emailIdx = headers.indexOf("email");

        if (emailIdx === -1)
          throw new Error("CSV must contain an 'email' column.");

        const payload = rows
          .slice(1)
          .map((row) => {
            const cells = row.split(",");
            return {
              name: nameIdx !== -1 ? cells[nameIdx]?.trim() : "CSV Member",
              email: cells[emailIdx]?.trim(),
              role: "participant",
              group_name:
                selectedGroup === "All Contacts" ? "UNASSIGNED" : selectedGroup,
              status: "pending",
            };
          })
          .filter((c) => c.email);

        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if ((await res.json()).success) {
          setNotification({
            type: "success",
            message: `${payload.length} members uploaded as PENDING.`,
          });
          fetchData();
        }
      } catch (err) {
        setNotification({ type: "error", message: err.message });
      } finally {
        setIsCsvUploading(false);
      }
    };
    reader.readAsText(file);
  };

  const toggleSelection = (cid) => {
    setSelectedContacts((prev) =>
      prev.includes(cid) ? prev.filter((id) => id !== cid) : [...prev, cid],
    );
  };

  const copyJoinLink = (groupName) => {
    const link = `${window.location.origin}/register-staff?group=${encodeURIComponent(groupName)}`;
    navigator.clipboard.writeText(link);
    setCopiedGroup(groupName);
    setTimeout(() => setCopiedGroup(null), 2000);
  };

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchesGroup =
      selectedGroup === "All Contacts" ||
      c.group_name?.toUpperCase() === selectedGroup.toUpperCase();

    // Nested Sub-team Filter
    const matchesTeam =
      selectedTeamTab === "All Teams" || c.v2_team_id === selectedTeamTab;

    let matchesStatus = true;
    if (statusFilter === "Active")
      matchesStatus = c.status === "active" || c.status === "approved";
    else if (statusFilter === "Inactive")
      matchesStatus = c.status === "inactive";
    else if (statusFilter === "Pending") matchesStatus = c.status === "pending";

    return (
      matchesSearch &&
      matchesGroup &&
      matchesTeam &&
      matchesStatus &&
      (!showArchived ? !c.deleted : !!c.deleted)
    );
  });

  const getPortalUrl = (c) => {
    const isStaff =
      c.role?.toLowerCase() === "staff" ||
      c.group_name?.toUpperCase() === "FUTURE STUDIO";
    return `${window.location.origin}${isStaff ? "/login" : "/login"}`;
  };

  const buildWelcomeMessage = (c, pass) => {
    const portalUrl = getPortalUrl(c);
    return `Welcome to ImpactOS, ${c.name}!\n\nYour account has been created. Use the credentials below to log in and access your dashboard.\n\n🔗 Login URL: ${portalUrl}\n📧 Email: ${c.email}\n🔑 Password: ${pass || "N/A"}\n\nFor security, please change your password after your first login.\n\nBest regards,\nThe ImpactOS Team`;
  };

  const [copiedMessage, setCopiedMessage] = useState(false);

  const copyWelcomeMessage = (c, pass) => {
    const msg = buildWelcomeMessage(c, pass);
    navigator.clipboard.writeText(msg);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const getWhatsAppLink = (c, pass) => {
    const phone = c.phone?.replace(/[^0-9]/g, "");
    if (!phone) return "#";
    const msg = buildWelcomeMessage(c, pass);
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const getEmailLink = (c, pass) => {
    const portalUrl = getPortalUrl(c);
    const subject = encodeURIComponent("Your ImpactOS Account Credentials");
    const body = encodeURIComponent(buildWelcomeMessage(c, pass));
    return `mailto:${c.email}?subject=${subject}&body=${body}`;
  };

  const handlePivotToEntity = async (c) => {
    if (
      !confirm(
        `Initialize Pivot Protocol for ${c.name}? This will convert them to a Business Entity.`,
      )
    )
      return;
    setIsProcessing(true);
    try {
      const entityName = `${c.name} Entity`;
      await fetch("/api/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: entityName,
          type: "company",
          program_id: null,
        }),
      });
      await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: c.cid, group_name: entityName }),
      });
      setNotification({ type: "success", message: "Entity Pivot Successful." });
      fetchData();
    } catch (e) {
      console.error("Pivot Error:", e);
    } finally {
      setIsProcessing(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <DashboardLayout role="super_admin" activeTab="communication">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-8 left-1/2 -translate-x-1/2 z-[600] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 ${notification.type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}
          >
            {notification.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )}
            <span className="text-xs font-bold uppercase tracking-widest">
              {notification.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-10 pb-20 animate-in text-left">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-[var(--border-primary)] pb-10">
          <div className="space-y-4">
            <button
              onClick={() => router.push("/admin")}
              className="group flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-orange)] transition-all font-bold text-[9px] uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />{" "}
              Dashboard
            </button>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--brand-orange)]" />
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.4em]">
                  Contact
                </span>
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-[var(--text-primary)]">
                CONTACTS
              </h1>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <button
                disabled={isCsvUploading}
                className="btn btn-secondary gap-2 border-emerald-500/30 text-emerald-500"
              >
                {isCsvUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                Bulk CSV
              </button>
            </div>
            <button
              onClick={() => {
                setForm({
                  cid: "",
                  name: "",
                  email: "",
                  phone: "",
                  group_name: "",
                  password: "",
                  program_id: "",
                });
                setContactPrograms([]);
                setShowManualModal(true);
              }}
              className="btn btn-primary gap-2"
            >
              <Plus className="w-4 h-4" /> Add Member
            </button>
            <button
              onClick={() => setShowBulkProgramModal(true)}
              className="btn btn-secondary gap-2"
            >
              <Users className="w-4 h-4" /> Bulk Assign
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-1 space-y-6">
            <div className="card space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter identities..."
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-2 mb-3">
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    Segments
                  </p>
                  <button
                    onClick={() => setShowGroupModal(true)}
                    className="text-[10px] font-bold text-[var(--brand-orange)] hover:opacity-80 uppercase tracking-widest flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> New
                  </button>
                </div>
                {["All Contacts", ...families].map((f) => {
                  const name = typeof f === "string" ? f : f.name;
                  const isAll = name === "All Contacts";
                  return (
                    <div key={name} className="flex gap-2 group items-center">
                      <button
                        onClick={() => setSelectedGroup(name)}
                        className={`flex-1 text-left px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${selectedGroup === name ? "bg-[var(--brand-orange)] text-black" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-primary"}`}
                      >
                        {name} {!!f.is_archived && "(ARCHIVED)"}
                      </button>
                      {!isAll && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setNewGroupName(f.name);
                              setNewGroupType(f.type);
                              setNewGroupProgramId(f.program_id);
                              setShowGroupModal(f);
                            }}
                            title="Edit Segment"
                            className="p-2.5 rounded-lg border border-[var(--border-primary)] bg-primary text-slate-500 hover:text-[var(--brand-orange)]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setGroupKeysForm({ ...f });
                              setShowGroupKeysModal(f);
                            }}
                            title="Access Keys"
                            className="p-2.5 rounded-lg border border-[var(--border-primary)] bg-primary text-slate-500 hover:text-blue-500"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => copyJoinLink(name)}
                            title="Copy Join Link"
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

          <div className="xl:col-span-3 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex bg-secondary p-1 rounded-xl border border-[var(--border-primary)]">
                {["All", "Active", "Inactive", "Pending"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === status ? "bg-[var(--brand-orange)] text-black shadow-lg shadow-orange-500/20" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                {selectedContacts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl"
                  >
                    <span className="text-[10px] font-black text-emerald-500 uppercase">
                      {selectedContacts.length} Selected
                    </span>
                    <button
                      onClick={() => handleBulkApprove("selected")}
                      className="btn btn-primary !bg-emerald-500 !py-2 !text-[9px] gap-2"
                    >
                      <UserCheck className="w-3 h-3" /> Approve Selected
                    </button>
                    <button
                      onClick={() => setSelectedContacts([])}
                      className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                {statusFilter === "Pending" && filtered.length > 0 && (
                  <button
                    onClick={() => handleBulkApprove("all")}
                    className="px-6 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[10px] font-black text-blue-500 uppercase hover:bg-blue-500 hover:text-white transition-all"
                  >
                    Approve All ({filtered.length})
                  </button>
                )}
              </div>
            </div>

            {/* SUB-TEAM TABS (Only shown when a group is selected) */}
            {selectedGroup !== "All Contacts" && (
              <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1">
                <button
                  onClick={() => setSelectedTeamTab("All Teams")}
                  className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${selectedTeamTab === "All Teams" ? "bg-blue-500 text-white border-blue-500" : "bg-transparent text-[var(--text-secondary)] border-[var(--border-primary)] opacity-40 hover:opacity-100"}`}
                >
                  All Teams
                </button>
                {teams
                  .filter(
                    (t) =>
                      t.group_name?.toUpperCase() ===
                      selectedGroup.toUpperCase(),
                  )
                  .map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamTab(team.id)}
                      className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${selectedTeamTab === team.id ? "bg-blue-500 text-white border-blue-500" : "bg-transparent text-[var(--text-secondary)] border-[var(--border-primary)] opacity-40 hover:opacity-100"}`}
                    >
                      {team.name}
                    </button>
                  ))}
              </div>
            )}

            {loading ? (
              <TableSkeleton rows={8} />
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-10">
                        <input
                          type="checkbox"
                          checked={
                            selectedContacts.length === filtered.length &&
                            filtered.length > 0
                          }
                          onChange={() => {
                            if (selectedContacts.length === filtered.length)
                              setSelectedContacts([]);
                            else
                              setSelectedContacts(filtered.map((c) => c.cid));
                          }}
                          className="w-4 h-4 rounded border-[var(--border-primary)] bg-primary accent-[var(--brand-orange)]"
                        />
                      </th>
                      <th>Identity</th>
                      <th>Group / Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr
                        key={c.cid}
                        className={`group ${selectedContacts.includes(c.cid) ? "bg-[var(--brand-orange)]/5" : ""}`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedContacts.includes(c.cid)}
                            onChange={() => toggleSelection(c.cid)}
                            className="w-4 h-4 rounded border-[var(--border-primary)] bg-primary accent-[var(--brand-orange)]"
                          />
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-tight">
                              {c.name}
                            </span>
                            <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                              {c.email}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-primary border border-[var(--border-primary)] rounded text-[9px] font-black uppercase text-[var(--brand-orange)]">
                                {c.group_name || "Individual"}
                              </span>
                              {c.v2_team_id && (
                                <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-black uppercase text-blue-500">
                                  {teams.find((t) => t.id === c.v2_team_id)
                                    ?.name || "Sub-team"}
                                </span>
                              )}
                            </div>
                            <span
                              className={`w-fit px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                c.status === "pending"
                                  ? "bg-orange-500/10 text-orange-400"
                                  : c.status === "inactive"
                                    ? "bg-rose-500/10 text-rose-400"
                                    : "bg-emerald-500/10 text-emerald-400"
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() =>
                                toggleStatus(c.cid, c.status, c.group_name)
                              }
                              title={
                                c.status === "active"
                                  ? "Deactivate"
                                  : "Activate"
                              }
                              className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-emerald-500 transition-all"
                            >
                              {c.status === "active" ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                setForm(c);
                                setContactPrograms(c.program_ids || []);
                                // Fetch actual program assignments
                                fetch(
                                  "/api/participant-programs?participant_id=" +
                                    (c.cid || c.id),
                                )
                                  .then((r) => r.json())
                                  .then((d) => {
                                    if (d.success)
                                      setContactPrograms(
                                        d.assignments.map((a) => a.program_id),
                                      );
                                  })
                                  .catch(() => {});
                                setShowManualModal(true);
                              }}
                              title="Edit Contact"
                              className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-[var(--brand-orange)]"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePivotToEntity(c)}
                              title="Pivot to Entity"
                              className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-emerald-500"
                            >
                              <TrendingUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleResetPassword(c)}
                              title="Reset Password"
                              className="p-2.5 rounded-lg border border-[var(--border-primary)] hover:text-blue-500"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showManualModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-xl space-y-6 border-[var(--brand-orange)]/30">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase">Identity Profile</h3>
              <button onClick={() => setShowManualModal(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full Name"
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Email"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
                />
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
              <select
                value={form.group_name}
                onChange={(e) =>
                  setForm({ ...form, group_name: e.target.value })
                }
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="">Select Segment...</option>
                {families.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name.toUpperCase()}
                  </option>
                ))}
              </select>
              {/* Access auto-derived from group membership */}
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-left">
                <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">
                  ⓘ Access Auto-Derived
                </p>
                <p className="text-[8px] text-[var(--text-secondary)] leading-relaxed">
                  Adding to <strong>Future Studio</strong> group → Staff access.
                  Adding to a <strong>Program group</strong> → Participant
                  access. Program Manager & Teacher are assigned per-program
                  from the program dashboard.
                </p>
              </div>
              {/* Program Assignments */}
              <div className="space-y-2">
                <label className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-1">
                  Program Assignment
                </label>
                <p className="text-[8px] text-[var(--text-secondary)] ml-1 mb-1 opacity-60">
                  Select the program for this user.
                </p>
                <select
                  value={contactPrograms[0] || ""}
                  onChange={(e) =>
                    setContactPrograms(e.target.value ? [e.target.value] : [])
                  }
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
                >
                  <option value="">Select Program...</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSaveContact}
                className="btn btn-primary w-full py-5 font-bold uppercase tracking-widest"
              >
                Save Identity
              </button>
            </div>
          </div>
        </div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-sm space-y-6 border-[var(--brand-orange)]/30">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase">
                {typeof showGroupModal === "object"
                  ? "Edit Segment"
                  : "New Segment"}
              </h3>
              <button onClick={() => setShowGroupModal(null)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Segment Name"
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
              />
              <select
                value={newGroupType}
                onChange={(e) => setNewGroupType(e.target.value)}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="individual">Individual Focus</option>
                <option value="company">Entity Focus</option>
              </select>
              <select
                value={newGroupProgramId}
                onChange={(e) => setNewGroupProgramId(e.target.value)}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
              >
                <option value="">Select Program...</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleSaveGroup}
                className="btn btn-primary w-full py-4 font-bold uppercase"
              >
                Sync Segment
              </button>
            </div>
          </div>
        </div>
      )}

      {showGroupKeysModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-sm space-y-6 border-blue-500/30">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold uppercase">Key Management</h3>
              <button onClick={() => setShowGroupKeysModal(null)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4 text-left">
              <input
                value={groupKeysForm.shared_email}
                onChange={(e) =>
                  setGroupKeysForm({
                    ...groupKeysForm,
                    shared_email: e.target.value,
                  })
                }
                placeholder="Shared Email"
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  value={groupKeysForm.shared_password_read}
                  onChange={(e) =>
                    setGroupKeysForm({
                      ...groupKeysForm,
                      shared_password_read: e.target.value,
                    })
                  }
                  placeholder="Read Key"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-emerald-500 outline-none focus:border-emerald-500"
                />
                <input
                  value={groupKeysForm.shared_password_edit}
                  onChange={(e) =>
                    setGroupKeysForm({
                      ...groupKeysForm,
                      shared_password_edit: e.target.value,
                    })
                  }
                  placeholder="Edit Key"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold text-blue-500 outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleSaveGroupKeys}
                className="btn btn-primary bg-blue-600 hover:bg-blue-700 w-full py-4 font-bold uppercase"
              >
                Sync Keys
              </button>
            </div>
          </div>
        </div>
      )}

      {showCredsModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-lg border-blue-500/30 animate-in flex flex-col max-h-[90vh]">
            {/* Scrollable Content Area */}
            <div className="overflow-y-auto p-6 pb-2 space-y-6">
              {/* Header */}
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500">
                  <Key className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">
                    {credsForm.name}
                  </h3>
                  <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">
                    Account Credentials
                  </p>
                </div>
              </div>

              {/* Credentials Card */}
              <div className="bg-primary border border-blue-500/20 rounded-2xl p-6 space-y-4 text-left">
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                      Login URL
                    </label>
                    <div className="flex items-center gap-2 mt-1 p-3 bg-black/40 rounded-xl border border-white/5">
                      <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                      <code className="text-xs font-mono text-blue-400 font-bold break-all">
                        {getPortalUrl(credsForm)}
                      </code>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        Email
                      </label>
                      <div className="flex items-center gap-2 mt-1 p-3 bg-black/40 rounded-xl border border-white/5">
                        <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                        <code className="text-xs font-mono text-emerald-400 font-bold truncate">
                          {credsForm.email}
                        </code>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                        Password
                      </label>
                      <div className="flex items-center gap-2 mt-1 p-3 bg-black/40 rounded-xl border border-amber-500/20">
                        <Shield className="w-4 h-4 text-amber-500 shrink-0" />
                        <code className="text-xs font-mono text-amber-400 font-bold">
                          {credsForm.password}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Welcome Message Preview */}
                <div className="pt-3 border-t border-white/5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                    Welcome Message Preview
                  </label>
                  <div className="p-4 bg-black/60 rounded-xl border border-white/5 text-[11px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">
                    {buildWelcomeMessage(credsForm, credsForm.password)}
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="p-6 pt-2 border-t border-white/5 shrink-0">
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() =>
                      copyWelcomeMessage(credsForm, credsForm.password)
                    }
                    className="btn btn-secondary flex items-center justify-center gap-2 uppercase font-bold"
                  >
                    {copiedMessage ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copy All
                      </>
                    )}
                  </button>
                  {credsForm.phone && (
                    <a
                      href={getWhatsAppLink(credsForm, credsForm.password)}
                      target="_blank"
                      className="btn btn-primary bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center gap-2 uppercase font-bold"
                    >
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </a>
                  )}
                  <a
                    href={getEmailLink(credsForm, credsForm.password)}
                    target="_blank"
                    className="btn btn-primary bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2 uppercase font-bold"
                  >
                    <Mail className="w-4 h-4" /> Email
                  </a>
                </div>
                <button
                  onClick={() => setShowCredsModal(false)}
                  className="btn btn-secondary w-full uppercase font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BULK PROGRAM ASSIGNMENT MODAL */}
      {showBulkProgramModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-2xl space-y-6 border-[var(--brand-orange)]/30">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold uppercase">
                Bulk Program Assignment
              </h3>
              <button
                onClick={() => {
                  setShowBulkProgramModal(false);
                  setBulkSelected([]);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Program Selector */}
              <select
                id="bulk-program-select"
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
                defaultValue=""
              >
                <option value="" disabled>
                  Select Program...
                </option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              {/* Action Type */}
              <div className="flex gap-2">
                <button
                  id="bulk-action-add"
                  className="flex-1 py-2 rounded-lg bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30 text-[var(--brand-orange)] text-[10px] font-black uppercase tracking-wider"
                >
                  Add to Program
                </button>
                <button
                  id="bulk-action-remove"
                  className="flex-1 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[10px] font-black uppercase tracking-wider"
                >
                  Remove from Program
                </button>
              </div>

              {/* Select All / Clear */}
              <div className="flex items-center justify-between border-b border-[var(--border-primary)] pb-2">
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Select Participants ({bulkSelected.length} selected)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const parts = contacts.filter(
                        (c) => c.role === "participant",
                      );
                      setBulkSelected(
                        parts.map((c) => c.cid || c.id).filter(Boolean),
                      );
                    }}
                    className="text-[8px] font-bold text-blue-400 uppercase tracking-wider hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setBulkSelected([])}
                    className="text-[8px] font-bold text-rose-400 uppercase tracking-wider hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Participant List */}
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                {contacts
                  .filter(
                    (c) => c.role === "participant" || c.role === "unassigned",
                  )
                  .map((c) => {
                    const cid = c.cid || c.id;
                    const isSelected = bulkSelected.includes(cid);
                    return (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => {
                          setBulkSelected((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== cid)
                              : [...prev, cid],
                          );
                        }}
                        className={`flex items-center gap-2 p-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all text-left ${
                          isSelected
                            ? "bg-[var(--brand-orange)]/10 border border-[var(--brand-orange)]/30 text-[var(--brand-orange)]"
                            : "bg-tertiary border border-transparent text-[var(--text-secondary)] hover:border-[var(--border-primary)]"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-[var(--brand-orange)] border-[var(--brand-orange)]"
                              : "border-[var(--border-primary)]"
                          }`}
                        >
                          {isSelected && (
                            <span className="text-[8px] text-black font-black">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate">{c.name || "Unknown"}</p>
                          <p className="text-[7px] opacity-50 truncate">
                            {c.email || cid}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                {contacts.filter((c) => c.role === "participant").length ===
                  0 && (
                  <p className="text-[10px] text-slate-500 italic col-span-2 py-8 text-center">
                    No participants found.
                  </p>
                )}
              </div>

              {/* Apply Button */}
              <button
                onClick={async () => {
                  const programId = document.getElementById(
                    "bulk-program-select",
                  ).value;
                  const actionEl = document.querySelector(
                    "#bulk-action-add.bg-\[var\(--brand-orange\)\/10\]",
                  );
                  const isAdd = true; // default to add
                  if (!programId || !bulkSelected.length) return;
                  setIsProcessing(true);
                  try {
                    const res = await fetch("/api/participant-programs/bulk", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        participant_ids: bulkSelected,
                        program_id: programId,
                        action: "add",
                        assigned_by: "sa",
                        source: "bulk_assignment",
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setNotification({
                        type: "success",
                        message: `Updated ${data.count || bulkSelected.length} participant(s).`,
                      });
                      setShowBulkProgramModal(false);
                      setBulkSelected([]);
                      fetchData();
                    }
                  } catch (e) {
                    setNotification({
                      type: "error",
                      message: "Bulk assignment failed.",
                    });
                  } finally {
                    setIsProcessing(false);
                    setTimeout(() => setNotification(null), 3000);
                  }
                }}
                disabled={isProcessing || !bulkSelected.length}
                className="w-full py-4 rounded-xl bg-[var(--brand-orange)] text-black text-[11px] font-black uppercase tracking-wider disabled:opacity-50 hover:brightness-110 transition-all"
              >
                {isProcessing
                  ? "Processing..."
                  : `Assign ${bulkSelected.length} Participant(s) to Program`}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={10} />}>
      <ContactsPageContent />
    </Suspense>
  );
}
