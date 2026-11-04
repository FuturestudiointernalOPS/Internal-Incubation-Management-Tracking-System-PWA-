"use client";

import { useState, useEffect } from "react";
import { History, Ban, CheckCircle2, Clock } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppEmptyState from "@/components/ui/AppEmptyState";

/* ── History ────────────────────────────────────────────────────────────── */

export function HistoryModal({ member, t, fmtDate, onClose }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/org-membership?user_cid=${encodeURIComponent(member.user_cid)}&group=${encodeURIComponent(
            member.group_name,
          )}&history=1`,
        );
        const data = await res.json();
        if (!cancelled) {
          if (data.success) setEvents(data.events || []);
          else setError(data.error || "—");
        }
      } catch {
        if (!cancelled) setError("—");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [member]);

  const eventLabel = (action, t) => {
    switch (action) {
      case "joined":
        return t("membership.detail.eventJoined");
      case "activated":
        return t("membership.detail.eventActivated");
      case "deactivated":
        return t("membership.detail.eventDeactivated");
      case "renewed":
        return t("membership.detail.eventRenewed");
      case "expired":
        return t("membership.detail.eventExpired");
      case "ended":
        return t("membership.detail.eventEnded");
      default:
        return action;
    }
  };

  const eventIcon = (action) => {
    switch (action) {
      case "joined":
      case "activated":
      case "renewed":
        return <CheckCircle2 className="w-4 h-4" style={{ color: "#10B981" }} />;
      case "deactivated":
      case "ended":
        return <Ban className="w-4 h-4" style={{ color: "#EF4444" }} />;
      case "expired":
        return <Clock className="w-4 h-4" style={{ color: "#F59E0B" }} />;
      default:
        return <History className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />;
    }
  };

  return (
    <AppModal isOpen onClose={onClose} title={t("membership.detail.membershipHistory")} size="lg">
      <div className="space-y-4">
        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
          {member.name || member.user_cid} — {member.group_name}
        </p>
        {error ? (
          <AppEmptyState title={t("membership.detail.noHistory")} icon={History} />
        ) : !events ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-12 rounded-lg animate-pulse" style={{ background: "var(--surface-3)" }} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <AppEmptyState title={t("membership.detail.noHistory")} icon={History} />
        ) : (
          <div
            className="rounded-xl divide-y overflow-hidden"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-primary)" }}
          >
            {events.map((event, index) => {
              const actor = event.actor_name || event.actor_cid;
              return (
                <div key={`${event.created_at}-${index}`} className="px-4 py-3 flex items-start gap-3">
                  <div className="mt-0.5">{eventIcon(event.action)}</div>
                  <div className="flex-1">
                    <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                      {eventLabel(event.action, t)}
                    </p>
                    {event.note && (
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                        {event.note}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                      {fmtDate(event.created_at)}
                    </p>
                    <p className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                      {actor && actor !== "system" && actor !== "admin"
                        ? `${t("membership.detail.by")}: ${actor}`
                        : t("membership.detail.bySystem")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppModal>
  );
}
