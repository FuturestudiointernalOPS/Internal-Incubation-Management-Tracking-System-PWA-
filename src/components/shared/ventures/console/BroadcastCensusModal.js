"use client";

import React, { useState } from "react";
import {
  Send,
  Link2,
  CheckCircle2,
  Copy,
  Check,
  Mail,
} from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import { useDialogs } from "@/components/ui/DialogProvider";

/**
 * BroadcastCensusModal
 * 
 * Allows Super Admin to:
 * 1. Paste link (e.g. https://impactos.futurestudio.bj/s/r619232621d)
 * 2. Target All Startups, Segments (incubation/acceleration/soft landing), or Custom select
 * 3. Activate on startup dashboards & optionally blast emails to lead founders
 */
export default function BroadcastCensusModal({ isOpen, onClose, ventures = [], onBroadcastCreated }) {
  const { alert } = useDialogs();
  // No default link: the field used to start with a demo slug, so pressing
  // Broadcast without editing it targeted a run that does not exist and mailed
  // every founder a dead link.
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("Future Studio Startup Performance & Impact Census");
  const [message, setMessage] = useState(
    "Please take 3-5 minutes to complete this performance & impact census for your startup. Unanswered or pre-stage metrics can be left blank."
  );
  const [targetScope, setTargetScope] = useState("all"); // "all", "segment", "custom"
  const [targetSegment, setTargetSegment] = useState("incubation");
  const [selectedVentureIds, setSelectedVentureIds] = useState([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [buttonText, setButtonText] = useState("Complete Census");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const activeVentures = ventures.filter((v) => v.status === "active" || !v.status);

  // `venture_id` (VNT-…) is what a founder's dashboard and the emailed link use
  // to identify itself. `vnt_id` never existed, so custom targeting used to
  // store the internal id and never matched the venture it was aimed at.
  const ventureKey = (v) => String(v.venture_id || v.id);

  const handleToggleVenture = (vId) => {
    setSelectedVentureIds((prev) =>
      prev.includes(vId) ? prev.filter((id) => id !== vId) : [...prev, vId]
    );
  };

  const handleSelectAllCustom = () => {
    if (selectedVentureIds.length === activeVentures.length) {
      setSelectedVentureIds([]);
    } else {
      setSelectedVentureIds(activeVentures.map(ventureKey));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!link.trim()) return;
    if (targetScope === "custom" && selectedVentureIds.length === 0) {
      await alert({ message: "Select at least one startup to broadcast to." });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/ventures/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          link,
          message,
          button_text: buttonText,
          target_scope: targetScope,
          target_segment: targetScope === "segment" ? targetSegment : null,
          target_venture_ids: targetScope === "custom" ? selectedVentureIds : [],
          send_email: sendEmail,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data);
        if (onBroadcastCreated) onBroadcastCreated(data);
      } else {
        await alert({ message: data.error || "Failed to broadcast form", tone: "danger" });
      }
    } catch (err) {
      await alert({ message: "Error broadcasting: " + err.message, tone: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Broadcast Census / Form to Startups"
      size="lg"
    >
      <div className="space-y-6 text-sm">
        {result ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-black">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-400">
                Form Successfully Broadcasted!
              </h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                The banner is now live on the dashboards of targeted startups. When they submit, it will auto-dismiss.
              </p>
            </div>

            {result.emailStats && (
              <div className="rounded-lg bg-black/20 p-3 text-xs text-left max-w-md mx-auto space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Emails Sent:</span>
                  <span className="font-bold text-emerald-400">{result.emailStats.sent} lead founders</span>
                </div>
                {result.emailStats.failed > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Failed / Missing Email:</span>
                    <span className="font-bold text-amber-400">{result.emailStats.failed}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-center gap-3">
              <AppButton variant="secondary" onClick={() => setResult(null)}>
                Broadcast Another
              </AppButton>
              <AppButton variant="primary" onClick={onClose}>
                Done
              </AppButton>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 1. Form Link */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Forms & Runs Short Link
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-3 h-4 w-4 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    required
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://impactos.futurestudio.bj/s/..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-2 border border-[var(--border-primary)] rounded-lg text-xs hover:bg-[var(--surface-2)] flex items-center gap-1.5 transition-colors"
                  title="Copy link"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedLink ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                The system will automatically stamp the exact startup&apos;s identity when they click.
              </p>
            </div>

            {/* 2. Banner Title & Button Text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Banner Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                  Button Label
                </label>
                <input
                  type="text"
                  required
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)]"
                />
              </div>
            </div>

            {/* 3. Description Note */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                Instruction / Note for Founders
              </label>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-orange)] resize-none"
              />
            </div>

            {/* 4. Target Startups Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                Target Startups
              </label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-[var(--surface-2)] rounded-lg border border-[var(--border-primary)]">
                <button
                  type="button"
                  onClick={() => setTargetScope("all")}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                    targetScope === "all"
                      ? "bg-[var(--brand-orange)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  All Startups ({activeVentures.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetScope("segment")}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                    targetScope === "segment"
                      ? "bg-[var(--brand-orange)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  By Program / Segment
                </button>
                <button
                  type="button"
                  onClick={() => setTargetScope("custom")}
                  className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                    targetScope === "custom"
                      ? "bg-[var(--brand-orange)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  Select Startups ({selectedVentureIds.length})
                </button>
              </div>

              {/* Segment Dropdown */}
              {targetScope === "segment" && (
                <div className="mt-3 p-3 bg-[var(--surface-1)] rounded-lg border border-[var(--border-primary)]">
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Select Program Segment:</label>
                  <select
                    value={targetSegment}
                    onChange={(e) => setTargetSegment(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-primary)] bg-[var(--surface-2)] text-[var(--text-primary)]"
                  >
                    <option value="incubation">Incubation Program</option>
                    <option value="acceleration">Acceleration Program</option>
                    <option value="soft_landing">Soft Landing Program</option>
                    <option value="partner_program">Partner Programs</option>
                    <option value="venture_building">Internal / Venture Building</option>
                  </select>
                </div>
              )}

              {/* Custom Checklist */}
              {targetScope === "custom" && (
                <div className="mt-3 p-3 bg-[var(--surface-1)] rounded-lg border border-[var(--border-primary)] space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border-primary)]">
                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {selectedVentureIds.length} of {activeVentures.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAllCustom}
                      className="text-xs text-[var(--brand-orange)] font-semibold hover:underline"
                    >
                      {selectedVentureIds.length === activeVentures.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {activeVentures.map((v) => {
                      const idStr = ventureKey(v);
                      const isChecked = selectedVentureIds.includes(idStr);
                      return (
                        <label
                          key={idStr}
                          className="flex items-center gap-2.5 p-1.5 rounded hover:bg-[var(--surface-2)] cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleVenture(idStr)}
                            className="rounded border-[var(--border-primary)] text-[var(--brand-orange)] focus:ring-0"
                          />
                          <span className="font-medium text-[var(--text-primary)]">
                            {v.company_name || v.name}
                          </span>
                          <span className="text-[10px] text-[var(--text-secondary)]">
                            ({v.venture_id || v.stage || "Active"})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Email Blast Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <h5 className="font-semibold text-xs text-[var(--text-primary)]">
                    Send Direct Email to Lead Founders
                  </h5>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Sends their personalized link directly to the primary email of each targeted startup.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-primary)] text-[var(--brand-orange)] focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border-primary)]">
              <AppButton variant="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </AppButton>
              <AppButton variant="primary" type="submit" disabled={loading} className="gap-2">
                <Send className="h-3.5 w-3.5" />
                {loading ? "Broadcasting..." : "Broadcast to Startups"}
              </AppButton>
            </div>
          </form>
        )}
      </div>
    </AppModal>
  );
}
