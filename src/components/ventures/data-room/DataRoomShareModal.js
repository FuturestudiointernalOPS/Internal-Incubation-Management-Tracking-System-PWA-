"use client";

import { useEffect, useState } from "react";
import {
  Share2,
  Copy,
  Check,
  Link,
  Trash2,
  Clock,
  Eye,
  Loader2,
  X,
} from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";

export default function DataRoomShareModal({ ventureId, isOpen, onClose }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Form states
  const [linkName, setLinkName] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [newlyCreatedUrl, setNewlyCreatedUrl] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    if (!isOpen) return;

    fetch(`/api/ventures/${ventureId}/data-room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list_share_links" }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          setLoading(false);
          if (data.success) {
            setLinks(data.links || []);
          }
        }
      })
      .catch(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [isOpen, ventureId, reloadTrigger]);

  const handleCreateLink = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const res = await fetch(`/api/ventures/${ventureId}/data-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_share_link",
          name: linkName || "General Investor Review",
          expires_in_days: expiryDays ? Number(expiryDays) : null,
        }),
      });
      const data = await res.json();
      if (data.success && data.link) {
        const fullUrl = `${window.location.origin}/open/data-room/${data.link.token}`;
        setNewlyCreatedUrl(fullUrl);
        setLinkName("");
        setReloadTrigger((v) => v + 1);
      }
    } catch {
      // Ignored
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (linkId) => {
    try {
      await fetch(`/api/ventures/${ventureId}/data-room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke_share_link",
          link_id: linkId,
        }),
      });
      setReloadTrigger((v) => v + 1);
    } catch {
      // Ignored
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Data Room with Outside Investors"
      size="lg"
    >
      <div className="space-y-6">
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Create secure, read-only diligence links for investors, VCs, and angels outside our platform.
          Outside investors will be able to review verified documents, and invited to join the Future Studio Investor Network.
        </p>

        {/* ── Success banner after link creation ── */}
        {newlyCreatedUrl && (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Check size={14} /> Link Ready to Share!
              </span>
              <button
                type="button"
                onClick={() => setNewlyCreatedUrl(null)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={newlyCreatedUrl}
                className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-surface-1 text-[var(--text-primary)]"
              />
              <AppButton
                size="sm"
                variant="primary"
                icon={copiedId === "new" ? Check : Copy}
                onClick={() => copyToClipboard(newlyCreatedUrl, "new")}
              >
                {copiedId === "new" ? "Copied" : "Copy"}
              </AppButton>
            </div>
          </div>
        )}

        {/* ── Create New Share Link Form ── */}
        <form onSubmit={handleCreateLink} className="p-4 rounded-xl border border-[var(--border-primary)] bg-surface-2 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
            <Link size={14} className="text-[var(--brand-orange)]" /> Generate New Diligence Link
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-[var(--text-secondary)] block mb-1">
                Recipient / Audience Tag
              </label>
              <input
                type="text"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="e.g. Sequoia Capital, Seed Round Syndicate, YC"
                className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-surface-1 text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--text-secondary)] block mb-1">
                Link Expiration
              </label>
              <select
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-surface-1 text-[var(--text-primary)]"
              >
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
                <option value="30">30 Days (Standard)</option>
                <option value="90">90 Days</option>
                <option value="0">Never Expires</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <AppButton
              type="submit"
              size="sm"
              variant="primary"
              loading={creating}
              icon={Share2}
            >
              Generate Secure Link
            </AppButton>
          </div>
        </form>

        {/* ── Active Links & View Analytics ── */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Active Investor Links ({links.filter((l) => l.is_active).length})
          </h3>

          {loading ? (
            <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
              <Loader2 className="animate-spin mx-auto text-[var(--brand-orange)] mb-2" size={18} />
              Loading share links...
            </div>
          ) : links.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] italic">
              No investor links generated yet. Generate a link above to start sharing your Data Room.
            </p>
          ) : (
            <div className="space-y-2">
              {links.map((link) => {
                const linkUrl = typeof window !== "undefined" ? `${window.location.origin}/open/data-room/${link.token}` : "";
                const isCopied = copiedId === link.id;

                return (
                  <div
                    key={link.id}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                      link.is_active ? "border-[var(--border-primary)] bg-surface-1" : "border-zinc-800 bg-zinc-900/50 opacity-60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text-primary)]">{link.name}</span>
                        {link.is_active ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400">
                            Revoked
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)] mt-1">
                        <span className="flex items-center gap-1">
                          <Eye size={12} /> {link.views_count || 0} views
                        </span>
                        {link.expires_at && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> Expires: {new Date(link.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {link.is_active && (
                      <div className="flex items-center gap-2 shrink-0">
                        <AppButton
                          size="xs"
                          variant="ghost"
                          icon={isCopied ? Check : Copy}
                          onClick={() => copyToClipboard(linkUrl, link.id)}
                        >
                          {isCopied ? "Copied" : "Copy Link"}
                        </AppButton>

                        <button
                          type="button"
                          title="Revoke access immediately"
                          onClick={() => handleRevoke(link.id)}
                          className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppModal>
  );
}
