"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { notify } from "@/lib/notify";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";

// Platform roles that represent Future Studio staff/operators — the people who
// may carry a responsibility on a Venture. A Lead Manager is always one of
// them (same set the staff assignment page offers).
const STAFF_ROLES = new Set([
  "super_admin", "staff", "program_manager",
  "facilitator", "finance", "crm", "team",
]);

/**
 * AddLeadManagerModal — bind one staff member as the Lead Manager of a Venture,
 * from the Venture itself, without leaving the page.
 *
 * It is mounted only while open, so it starts clean every time. It writes a
 * single `lead_manager` assignment (venture-wide) through the same API the
 * assignment page uses, then closes. Everything else about a Venture's staff —
 * other responsibilities, scopes, removal — stays on that page, which this
 * dialog links to.
 */
export default function AddLeadManagerModal({ onClose, ventureId }) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (text) => {
    clearTimeout(timer.current);
    const value = String(text || "").trim();
    if (value.length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/contacts/search?q=${encodeURIComponent(value)}`);
        const payload = await response.json().catch(() => ({}));
        setResults(
          payload.success
            ? (payload.contacts || []).filter((contact) => STAFF_ROLES.has(contact.role))
            : [],
        );
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const assign = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/ventures/${ventureId}/staff-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_contact_id: picked.cid,
          responsibility_code: "lead_manager",
          scope_type: "venture_wide",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        notify("error", payload.error || t("vadmin.detail.addLeadManagerFailed"));
        return;
      }
      notify("success", t("vadmin.detail.addLeadManagerSuccess"));
      onClose?.();
    } catch {
      notify("error", t("vadmin.detail.addLeadManagerFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal isOpen onClose={onClose} title={t("vadmin.detail.addLeadManager")} size="sm">
      <div className="space-y-5">
        <p className="text-xs leading-relaxed -mt-2" style={{ color: "var(--text-secondary)" }}>
          {t("vadmin.detail.addLeadManagerSubtitle")}
        </p>

        {picked ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-surface-1">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                {picked.name || picked.email}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>
                {picked.email || picked.cid}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPicked(null);
                setQuery("");
                setResults([]);
              }}
              className="shrink-0 flex items-center gap-1 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              <X className="w-3 h-3" /> {t("venture.personField.clear")}
            </button>
          </div>
        ) : (
          <>
            <AppInput
              icon={Search}
              label={t("vadmin.detail.addLeadManagerFind")}
              placeholder={t("venture.staffAssign.searchPlaceholder")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                search(event.target.value);
              }}
            />

            {searching && (
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {t("common.loading")}
              </p>
            )}

            {!searching && results.length > 0 && (
              <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--border-primary)] bg-surface-1 divide-y divide-[var(--border-primary)]">
                {results.map((contact) => (
                  <button
                    key={contact.cid}
                    type="button"
                    onClick={() => {
                      setPicked(contact);
                      setResults([]);
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-2 transition-colors"
                  >
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {contact.name}
                    </span>
                    {contact.role && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded bg-surface-3 text-[8px] font-bold uppercase"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {contact.role}
                      </span>
                    )}
                    {contact.email && (
                      <span className="ml-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {contact.email}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                {t("venture.staffAssign.noStaffFound")}
              </p>
            )}
          </>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <AppButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </AppButton>
          <AppButton
            type="button"
            variant="primary"
            icon={UserPlus}
            loading={saving}
            disabled={!picked}
            onClick={assign}
          >
            {t("vadmin.detail.addLeadManagerSubmit")}
          </AppButton>
        </div>

        {/* Everything else about a Venture's staff — other responsibilities,
            scopes, removal — stays on the assignment page, reached from here. */}
        <div className="border-t border-[var(--border-primary)] pt-3">
          <button
            type="button"
            onClick={() => router.push(`/admin/ventures/${ventureId}/permissions`)}
            className="text-[10px] font-bold uppercase tracking-widest hover:text-[var(--text-primary)] transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("vadmin.detail.addLeadManagerManageAll")}
          </button>
        </div>
      </div>
    </AppModal>
  );
}
