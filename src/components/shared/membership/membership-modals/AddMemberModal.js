"use client";

import { useState, useMemo } from "react";
import { Search, UserPlus, Shield } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppModal from "@/components/ui/AppModal";
import { runMembershipAction } from "./shared";

/* ── Add Member ─────────────────────────────────────────────────────────── */

export function AddMemberModal({ groups, defaultGroup, isProtected, existing, t, lang, onClose, onAdded }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [contactGroups, setContactGroups] = useState([]);
  const [group, setGroup] = useState(defaultGroup);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);

  const fmt = (value) =>
    value
      ? new Date(value).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  const runSearch = async () => {
    const searchText = query.trim();
    if (searchText.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(searchText)}`);
      const data = await res.json();
      setResults(data.success ? data.contacts || [] : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pick = async (candidate) => {
    setSelected({ ...candidate, role: "", status: "", group_name: "" });
    setContactGroups([]);
    try {
      const [contactResponse, groupsResponse] = await Promise.all([
        fetch(`/api/contacts?cid=${encodeURIComponent(candidate.cid)}`),
        fetch(`/api/user-groups?user_cid=${encodeURIComponent(candidate.cid)}`),
      ]);
      const contactData = await contactResponse.json();
      const groupsData = await groupsResponse.json();
      const contact = Array.isArray(contactData.contacts) ? contactData.contacts[0] : contactData.contact || contactData;
      setSelected({
        cid: candidate.cid,
        name: contact.name || candidate.name,
        email: contact.email || candidate.email,
        role: contact.role || "",
        status: contact.status || "",
        group_name: contact.group_name || "",
      });
      setContactGroups((groupsData.groups || []).filter((entry) => entry));
    } catch {
      /* keep minimal selection */
    }
  };

  const alreadyMember = useMemo(
    () =>
      selected && group
        ? existing.some((membership) => membership.user_cid === selected.cid && membership.group_name === group)
        : false,
    [selected, group, existing],
  );

  const confirm = async () => {
    if (!selected || !group || busy) return;
    setBusy(true);
    try {
      const ok = await runMembershipAction(
        { user_cid: selected.cid, group_name: group },
        "joined",
        t,
        { expires_at: expires ? new Date(expires).toISOString() : null },
      );
      if (ok) onAdded();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal isOpen onClose={onClose} title={t("membership.add.title")} size="lg">
      <div className="space-y-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>
            {t("membership.add.searchLabel")}
          </p>
          <div className="flex gap-2">
            <AppInput
              icon={Search}
              placeholder={t("membership.add.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && runSearch()}
            />
            <AppButton variant="secondary" size="md" loading={searching} onClick={runSearch}>
              {t("common.search")}
            </AppButton>
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "var(--text-tertiary)" }}>
            {t("membership.add.searchHint")}
          </p>
        </div>

        {results.length > 0 && !selected && (
          <div
            className="max-h-40 overflow-y-auto rounded-xl divide-y"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
          >
            {results.map((contact) => (
              <button
                key={contact.cid}
                onClick={() => pick(contact)}
                className="w-full text-left px-4 py-2.5 hover:opacity-80 transition-all flex items-center justify-between"
              >
                <span>
                  <span className="block text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    {contact.name}
                  </span>
                  <span className="block text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    {contact.email}
                  </span>
                </span>
                <UserPlus className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
              </button>
            ))}
          </div>
        )}
        {!searching && query.trim().length >= 2 && results.length === 0 && !selected && (
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {t("membership.add.noResults")}
          </p>
        )}

        {selected && (
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                  {selected.name}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {selected.email}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelected(null);
                  setResults([]);
                }}
                className="text-[10px] font-bold uppercase tracking-wider hover:opacity-70"
                style={{ color: "var(--brand-orange)" }}
              >
                {t("common.change")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]" style={{ color: "var(--text-secondary)" }}>
              <span>
                {t("membership.columns.role")}: <b>{selected.role || "—"}</b>
              </span>
              <span>
                {t("membership.columns.accountStatus")}: <b>{selected.status || "—"}</b>
              </span>
              <span className="col-span-2">
                {t("membership.page.groupLabel")}: <b>{contactGroups.join(", ") || "—"}</b>
              </span>
            </div>
          </div>
        )}

        {selected && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <AppSelect
                label={t("membership.add.groupLabel")}
                value={group}
                onChange={(event) => setGroup(event.target.value)}
                options={groups.map((groupOption) => ({
                  value: groupOption.name,
                  label: groupOption.isProtected ? `${groupOption.name} (${t("membership.page.protected")})` : groupOption.name,
                }))}
              />
              <AppInput
                label={t("membership.add.startLabel")}
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
              <AppInput
                label={t("membership.add.expiresLabel")}
                type="date"
                value={expires}
                onChange={(event) => setExpires(event.target.value)}
              />
            </div>
            {isProtected(group) && (
              <div
                className="rounded-xl p-3 space-y-1.5"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}
              >
                <p className="text-[10px] flex items-center gap-1.5" style={{ color: "#F59E0B" }}>
                  <Shield className="w-3.5 h-3.5" /> {t("membership.page.protected")}
                </p>
                <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {t("membership.add.protectedConfirm")}
                </p>
              </div>
            )}
            {alreadyMember && (
              <p className="text-[10px]" style={{ color: "#F59E0B" }}>
                {t("membership.add.alreadyMember")}
              </p>
            )}

            <div
              className="rounded-xl p-4 space-y-1.5"
              style={{ background: "var(--surface-3)", border: "1px solid var(--border-primary)" }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--text-primary)" }}>
                {t("membership.add.summaryTitle")}
              </p>
              <p className="text-xs" style={{ color: "var(--text-primary)" }}>
                {t("membership.add.summaryAdd")}: <b>{selected.name}</b>
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("membership.add.summaryGroup")}: <b>{group}</b>
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("membership.add.summaryStart")}: <b>{fmt(startDate)}</b>
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("membership.add.summaryExpires")}:{" "}
                <b>{expires ? fmt(expires) : t("membership.status.never")}</b>
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <AppButton variant="ghost" onClick={onClose}>
                {t("membership.actions.cancel")}
              </AppButton>
              <AppButton variant="primary" loading={busy} onClick={confirm}>
                {t("membership.add.confirmMembership")}
              </AppButton>
            </div>
          </>
        )}
      </div>
    </AppModal>
  );
}
