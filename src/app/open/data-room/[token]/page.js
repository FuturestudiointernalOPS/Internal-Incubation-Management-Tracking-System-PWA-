"use client";

import { use, useEffect, useState } from "react";
import {
  ShieldCheck,
  FileText,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Eye,
  AlertTriangle,
  Lock,
} from "lucide-react";
import AppStatusBadge from "@/components/ui/AppStatusBadge";

export const dynamic = "force-dynamic";

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function PublicDataRoomPage({ params }) {
  const unwrappedParams = use(params);
  const token = unwrappedParams.token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    let active = true;
    if (!token) return;

    fetch(`/api/public/data-room/${token}`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (!json.success) throw new Error(json.error || "Failed to load Data Room");
        setData(json);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-4 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Loading Secure Data Room...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--surface-1)] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-2)]">
          <AlertTriangle size={36} className="mx-auto text-amber-500" />
          <h2 className="text-lg font-black text-[var(--text-primary)]">Link Expired or Unavailable</h2>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            This investor data room link has expired, been revoked, or is invalid. Please request a new link from the venture founding team.
          </p>
        </div>
      </div>
    );
  }

  const { venture, documents = [], link, investorPoolUrl } = data;

  const filteredDocs =
    activeCategory === "all"
      ? documents
      : documents.filter((d) => d.category === activeCategory);

  return (
    <div className="min-h-screen bg-[var(--surface-1)] text-[var(--text-primary)]">
      {/* ── Studio Investor Network Callout Banner ── */}
      <div
        className="border-b px-4 py-3 sm:px-6"
        style={{
          background: "linear-gradient(90deg, #18181b 0%, #27272a 100%)",
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2.5 text-center sm:text-left">
            <div className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-xs font-bold tracking-wide">
                Evaluating emerging startups across Africa & Emerging Markets?
              </p>
              <p className="text-[11px] text-zinc-400">
                Join the Future Studio Investor Pool to receive curated dealflow, co-investment rights, and direct introductions.
              </p>
            </div>
          </div>

          <a
            href={investorPoolUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-extrabold text-xs transition-colors shadow-lg"
          >
            <span>Apply to Join Investor Pool</span>
            <ArrowRight size={14} />
          </a>
        </div>
      </div>

      {/* ── Venture & Due Diligence Header ── */}
      <div className="border-b border-[var(--border-primary)] bg-[var(--surface-2)]">
        <div className="max-w-6xl mx-auto p-6 sm:py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0"
              style={{
                background: "color-mix(in srgb, var(--brand-orange) 15%, transparent)",
                color: "var(--brand-orange)",
              }}
            >
              {(venture?.name || "V").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-black text-[var(--text-primary)]">
                  {venture?.name || "Untitled Venture"}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-surface-3 border border-[var(--border-primary)]">
                  {venture?.stage || "Seed Stage"}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck size={12} /> Verified Data Room
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xl">
                {venture?.description || "Confidential investor diligence pack and materials."}
              </p>
              {venture?.website && (
                <a
                  href={venture.website.startsWith("http") ? venture.website : `https://${venture.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-orange)] mt-1.5 hover:underline"
                >
                  <ExternalLink size={12} /> {venture.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1.5 text-xs text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
              <Lock size={13} className="text-emerald-400" /> Read-Only Investor Session
            </span>
            <span>Link: {link?.name || "Institutional Review"}</span>
            {link?.expires_at && (
              <span className="text-[11px]">
                Expires: {new Date(link.expires_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Data Room Explorer ── */}
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeCategory === "all"
                ? "bg-[var(--brand-orange)] text-black"
                : "bg-surface-2 text-[var(--text-secondary)] hover:bg-surface-3"
            }`}
          >
            All Documents ({documents.length})
          </button>
        </div>

        {/* Documents Grid / List */}
        {filteredDocs.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-[var(--border-primary)] bg-surface-2">
            <FileText size={32} className="mx-auto text-[var(--text-secondary)] mb-2" />
            <p className="text-sm font-bold">No documents available in this view</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-4 rounded-2xl border border-[var(--border-primary)] bg-surface-2 hover:border-[var(--brand-orange)]/40 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] shrink-0">
                        <FileText size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">
                          {doc.title}
                        </h3>
                        <p className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-secondary)]">
                          {doc.category?.replace(/_/g, " ")} {doc.file_size ? `· ${formatBytes(doc.file_size)}` : ""}
                        </p>
                      </div>
                    </div>
                    <AppStatusBadge status={doc.status || "verified"} />
                  </div>

                  {doc.description && (
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-2">
                      {doc.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border-primary)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Version {doc.current_version || 1}
                  </span>

                  <div className="flex items-center gap-2">
                    {doc.file_url_signed && (
                      <a
                        href={doc.file_url_signed}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--brand-orange)] text-black hover:opacity-90 transition-opacity"
                      >
                        <Eye size={13} /> View Document
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ImpactOS Platform Footer ── */}
        <div className="pt-12 text-center text-xs text-[var(--text-secondary)] border-t border-[var(--border-primary)] space-y-2">
          <p className="font-semibold text-[var(--text-primary)]">
            Powered by Future Studio & ImpactOS Diligence Engine
          </p>
          <p>
            Secure, watermarked view granted exclusively for evaluating investor due diligence.
          </p>
        </div>
      </div>
    </div>
  );
}
