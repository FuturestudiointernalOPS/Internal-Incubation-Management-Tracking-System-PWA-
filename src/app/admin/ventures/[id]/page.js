"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Send,
  Edit3,
  Layers,
  CheckCircle2,
  User,
  Trash2,
  Crown,
  Ban,
  RefreshCw,
  X,
  Flag,
  Activity,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { isSystemActor } from "@/lib/ventureActivity";
import VentureDetailView from "@/components/admin/ventures/VentureDetailView";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const pickVenture = (payload) => (payload?.success ? payload.venture || null : null);

/**
 * Who the Venture is made of — counted from the MEMBERSHIP list ONLY.
 *
 * The founder list on this Venture is an invitation ledger (email + invited /
 * accepted), so counting it made a Venture with a real founder report
 * "0 founders" and an empty team. The server sends the same summary; this
 * derivation is what keeps the screen honest on a cached payload.
 */
const summarizeMembers = (venture) => {
  if (venture?.member_summary) return venture.member_summary;
  const members = venture?.members || [];
  const isFounder = (member) => Boolean(member.is_founder) || member.member_type === "founder";
  return {
    total: members.length,
    founders: members.filter(isFounder).length,
    team: members.filter((member) => !isFounder(member)).length,
    suspended: members.filter((member) => member.status === "suspended").length,
    owner: members.find((member) => member.is_owner) || null,
    members,
  };
};

const STAGE_CONFIG = {
  idea: { label: "vadmin.detail.stageIdea", color: "text-blue-400 bg-blue-500/10", order: 1 },
  validation: { label: "vadmin.detail.stageValidation", color: "text-purple-400 bg-purple-500/10", order: 2 },
  early_traction: { label: "vadmin.detail.stageEarlyTraction", color: "text-amber-400 bg-amber-500/10", order: 3 },
  growth: { label: "vadmin.detail.stageGrowth", color: "text-emerald-400 bg-emerald-500/10", order: 4 },
  scaling: { label: "vadmin.detail.stageScaling", color: "text-[var(--brand-orange)] bg-brand-orange/10", order: 5 },
};

const ACTIVITY_ICONS = {
  VENTURE_CREATED: Rocket,
  FOUNDER_INVITED: Send,
  VENTURE_UPDATED: Edit3,
  PROFILE_WIZARD_INIT: Layers,
  VENTURE_REGISTERED: CheckCircle2,
  PROGRAM_PROMOTED: Rocket,
  PROMOTED: Rocket,
  PROFILE_SUBMITTED: CheckCircle2,
  FOUNDER_ACCEPTED: User,
  FOUNDER_REMOVED: Trash2,
  ROLE_UPDATED: Edit3,
  OWNERSHIP_TRANSFERRED: Crown,
  USER_SUSPENDED: Ban,
  USER_REACTIVATED: RefreshCw,
  VERIFICATION_SUBMITTED: Send,
  VERIFICATION_APPROVED: CheckCircle2,
  VERIFICATION_REJECTED: X,
  VERIFICATION_RESUBMITTED: RefreshCw,
  VERIFICATION_SUSPENDED: Ban,
  MILESTONE_CREATED: Flag,
  MILESTONE_UPDATED: Edit3,
  MILESTONE_COMPLETED: CheckCircle2,
  DELIVERABLE_SUBMITTED: Send,
  DELIVERABLE_APPROVED: CheckCircle2,
  DELIVERABLE_REJECTED: X,
};

const ACTIVITY_COLORS = {
  VENTURE_CREATED: "text-emerald-500 bg-emerald-500/10",
  FOUNDER_INVITED: "text-blue-500 bg-blue-500/10",
  VENTURE_UPDATED: "text-amber-500 bg-amber-500/10",
  PROFILE_WIZARD_INIT: "text-purple-500 bg-purple-500/10",
  VENTURE_REGISTERED: "text-emerald-500 bg-emerald-500/10",
  PROGRAM_PROMOTED: "text-indigo-500 bg-indigo-500/10",
  PROMOTED: "text-indigo-500 bg-indigo-500/10",
  PROFILE_SUBMITTED: "text-emerald-500 bg-emerald-500/10",
  FOUNDER_ACCEPTED: "text-emerald-500 bg-emerald-500/10",
  FOUNDER_REMOVED: "text-rose-500 bg-rose-500/10",
  ROLE_UPDATED: "text-amber-500 bg-amber-500/10",
  OWNERSHIP_TRANSFERRED: "text-amber-500 bg-amber-500/10",
  USER_SUSPENDED: "text-rose-500 bg-rose-500/10",
  USER_REACTIVATED: "text-emerald-500 bg-emerald-500/10",
  VERIFICATION_SUBMITTED: "text-blue-500 bg-blue-500/10",
  VERIFICATION_APPROVED: "text-emerald-500 bg-emerald-500/10",
  VERIFICATION_REJECTED: "text-rose-500 bg-rose-500/10",
  VERIFICATION_RESUBMITTED: "text-amber-500 bg-amber-500/10",
  VERIFICATION_SUSPENDED: "text-red-500 bg-red-500/10",
  MILESTONE_CREATED: "text-blue-500 bg-blue-500/10",
  MILESTONE_UPDATED: "text-amber-500 bg-amber-500/10",
  MILESTONE_COMPLETED: "text-emerald-500 bg-emerald-500/10",
  DELIVERABLE_SUBMITTED: "text-amber-500 bg-amber-500/10",
  DELIVERABLE_APPROVED: "text-emerald-500 bg-emerald-500/10",
  DELIVERABLE_REJECTED: "text-rose-500 bg-rose-500/10",
};

export default function VentureDetailPage({ params }) {
  const router = useRouter();
  const { id } = React.use(params);
  const { t, lang } = useI18n();
  const [activeTab, setActiveTab] = useState("dashboard");

  // The Venture, through the shared hook: it owns the cache, the cache-first
  // paint and the discarding of a stale answer, so the page keeps no copy of its
  // own and reads during render.
  const {
    data: venture,
    loading,
    error: readFailure,
  } = useApi(id ? `/api/ventures/${id}` : null, {
    defaultValue: null,
    transform: pickVenture,
    deps: [id],
  });

  // Which failure the panel below reports: a request that never got an answer is
  // the network's, and a read that came back without a Venture is the server's.
  const error = readFailure
    ? t("vadmin.detail.ventureLoadError")
    : !venture
      ? t("vadmin.detail.ventureNotFound")
      : null;

  const getStageConfig = (stage) => STAGE_CONFIG[stage] || STAGE_CONFIG.idea;
  const getActivityIcon = (action) => ACTIVITY_ICONS[action] || Activity;
  const getActivityColor = (action) => ACTIVITY_COLORS[action] || "text-slate-500 bg-slate-500/10";

  // The people of this Venture (membership), read once for the whole page.
  const memberSummary = summarizeMembers(venture);
  const members = memberSummary.members || [];

  /** "by <name>" — or "by the system" when the platform acted on its own. */
  const actorText = (name) =>
    isSystemActor(name)
      ? t("vadmin.activity.bySystem")
      : t("vadmin.detail.byActor", { name });
  const ctx = {
    loading,
    activeTab,
    actorText,
    error,
    getActivityColor,
    getActivityIcon,
    getStageConfig,
    id,
    lang,
    memberSummary,
    members,
    router,
    setActiveTab,
    t,
    venture,
  };

  return <VentureDetailView ctx={ctx} />;
}
