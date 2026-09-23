"use client";
import React, { useState } from "react";
import {
  Rocket,
  Search,
  CheckCircle,
  Loader2,
  X,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";

const RESPONSE_STATUS_LABELS = {
  pending_response: "crm.responses.statusPendingResponse",
};

// The shape the screen renders from, so a failed or malformed payload never
// reaches a `.length` / `.find` read. Module scope keeps the values and both
// normalisers stable for the hook (inline values would refetch on every render).
const EMPTY_RESPONSES = {
  campaignStats: [],
  detailedResponses: [],
  contactsDetailed: [],
  flaggedResponses: [],
};
const pickResponses = (payload) =>
  payload?.success
    ? {
        ...payload,
        campaignStats: payload.campaignStats || [],
        detailedResponses: payload.detailedResponses || [],
        contactsDetailed: payload.contactsDetailed || [],
        flaggedResponses: payload.flaggedResponses || [],
      }
    : EMPTY_RESPONSES;
const pickGlobalContacts = (payload) => (payload?.success ? payload.contacts || [] : []);

export default function ResponsesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const goBack = useSafeBack("/admin/crm");

  // Both reads' loaders — cache-first paint, discarding a stale response, the
  // background refresh — belong to the hook, so the screen keeps no data state
  // of its own and never sets state from an effect.
  const {
    data: responsesData,
    loading: responsesLoading,
    refresh: refreshResponses,
  } = useApi("/api/responses", { defaultValue: EMPTY_RESPONSES, transform: pickResponses });
  const {
    data: globalContacts,
    loading: contactsLoading,
    refresh: refreshContacts,
  } = useApi("/api/contacts", { defaultValue: [], transform: pickGlobalContacts });
  const loading = responsesLoading || contactsLoading;
  // Mutation flows must not read back from the cache, so both reads are refreshed
  // the way the old bypassCache argument did.
  const refreshAll = () => {
    refreshResponses();
    refreshContacts();
  };

  const [view, setView] = useState("analytics"); // analytics | review
  const [activeCampaignChoice, setActiveCampaignChoice] = useState(null);
  // The first campaign is the default by derivation rather than something the
  // loader writes into state, which is also what lets the choice survive a
  // refresh: the old effect reset it to the first campaign on every load.
  const activeCampaign = activeCampaignChoice ?? responsesData.campaignStats[0]?.id ?? null;
  const [filterMode, setFilterMode] = useState("all"); // all | yes | no | pending_response
  const [search, setSearch] = useState("");

  // Retargeting
  const [showRetargetModal, setShowRetargetModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");

  const resolveMatch = async (response_id, cid) => {
    if (!cid) return;
    try {
      const response = await fetch("/api/responses/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response_id, cid }),
      });
      const payload = await response.json();
      if (payload.success) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.responses.matched") },
          }),
        );
        refreshAll();
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "error", message: t(payload.error || "") || payload.error },
          }),
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getFilteredContacts = () => {
    if (!activeCampaign) return [];
    let list = responsesData.contactsDetailed.filter(
      (contact) => contact.campaign_id === activeCampaign,
    );
    if (filterMode !== "all") {
      list = list.filter(
        (contact) =>
          contact.status === filterMode ||
          (filterMode === "pending_response" && contact.status === "sent"),
      );
    }
    if (search) {
      list = list.filter(
        (contact) =>
          contact.name.toLowerCase().includes(search.toLowerCase()) ||
          contact.email.toLowerCase().includes(search.toLowerCase()),
      );
    }
    return list;
  };

  const executeRetarget = async (event) => {
    event.preventDefault();
    const targets = getFilteredContacts().map((contact) => contact.cid);
    if (targets.length === 0) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("crm.responses.noOneToFollowUp") },
        }),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCampaignName,
          form_id: "",
          cids: targets,
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.responses.followUpCampaignStarted") },
          }),
        );
        setShowRetargetModal(false);
        router.push("/admin/communications/campaigns");
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "error", message: t(payload.error || "") || payload.error },
          }),
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeStats = responsesData.campaignStats.find((campaign) => campaign.id === activeCampaign);
  const filteredList = getFilteredContacts();

  return (
    <>
      <div className="space-y-8 min-h-[60vh]">
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button onClick={goBack} className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("crm.backToPrevious")}
          </button>
          <Link href="/admin/crm" className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("crm.backToCrm")}
          </Link>
        </nav>
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">
              {t("crm.responses.title")}
            </h2>
            <p className="text-slate-400 font-bold tracking-tight">
              {t("crm.responses.subtitle")}
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setView("analytics")}
              className={`font-black text-[10px] tracking-widest uppercase px-6 py-3 rounded-xl transition-all ${view === "analytics" ? "bg-[#FF6600]/80 text-white shadow-[#FF6600]/20 shadow-lg" : "bg-white/5 text-slate-400 hover:text-white"}`}
            >
              {t("crm.responses.charts")}
            </button>
            <button
              onClick={() => setView("review")}
              className={`font-black text-[10px] tracking-widest uppercase px-6 py-3 rounded-xl transition-all flex items-center gap-2 ${view === "review" ? "bg-rose-500 text-white shadow-rose-600/20 shadow-lg" : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"}`}
            >
              {t("crm.responses.fixMatches")}
              {responsesData.flaggedResponses?.length > 0 && (
                <span className="bg-rose-900 border border-rose-500 px-2 rounded-full text-[10px]">
                  {responsesData.flaggedResponses.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="w-10 h-10 text-[#FF6600]/80 animate-spin" />
          </div>
        ) : view === "review" ? (
          <div className="space-y-4 text-left">
            {responsesData.flaggedResponses?.length === 0 ? (
              <div className="p-20 text-center bg-white/5 border border-dashed border-emerald-500/30 rounded-[3rem]">
                <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)] rounded-full" />
                <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">
                  {t("crm.responses.allMatchesCorrect")}
                </h4>
                <p className="text-slate-400 text-sm font-bold">
                  {t("crm.responses.noPeopleNeedMatching")}
                </p>
              </div>
            ) : (
              responsesData.flaggedResponses?.map((flaggedResponse) => (
                <div
                  key={flaggedResponse.response_id}
                  className="ios-card bg-rose-500/5 border border-rose-500/10 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center p-6"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="badge bg-rose-500 text-white uppercase font-bold text-[10px]">
                        {t("crm.responses.needsMatch")}
                      </span>
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                        {t("crm.responses.similarity", { score: flaggedResponse.confidence_score })}
                      </span>
                    </div>
                    <p className="font-extrabold text-white text-lg">
                      {t("crm.responses.input")}{" "}
                      {(flaggedResponse.answers && (flaggedResponse.answers.name || flaggedResponse.answers.email)) ||
                        t("crm.responses.unknown")}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black inline-flex items-center gap-2">
                      {t("crm.responses.dataFound")}{" "}
                      <span className="text-white border px-1.5 rounded bg-white/5">
                        {JSON.stringify(flaggedResponse.answers)}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col md:items-end gap-2 w-full md:w-auto">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {t("crm.responses.matchWithPerson")}
                    </label>
                    <select
                      onChange={(event) =>
                        resolveMatch(flaggedResponse.response_id, event.target.value)
                      }
                      defaultValue=""
                      className="w-full md:w-[300px] bg-[#0d0d18] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#FF6600]/80/50 appearance-none font-bold"
                    >
                      <option value="" disabled>
                        {t("crm.responses.choosePerson")}
                      </option>
                      {globalContacts.map((contact) => (
                        <option key={contact.cid} value={contact.cid}>
                          {contact.name} ({contact.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : responsesData.campaignStats.length === 0 ? (
          <div className="p-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
            <BarChart3 className="w-16 h-16 text-slate-500 mx-auto mb-6 opacity-50" />
            <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">
              {t("crm.responses.noDataYet")}
            </h4>
            <p className="text-slate-400 text-sm font-bold">
              {t("crm.responses.startCampaignToSeeResponses")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 text-left">
            <div className="w-full lg:w-1/3 xl:w-1/4 space-y-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                {t("crm.responses.selectCampaign")}
              </h3>
              <div className="space-y-2">
                {responsesData.campaignStats.map((campaign) => (
                  <button
                    key={campaign.id}
                    onClick={() => {
                      setActiveCampaignChoice(campaign.id);
                      setFilterMode("all");
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${activeCampaign === campaign.id ? "bg-[#FF6600]/80/10 border-[#FF6600]/80 text-white" : "bg-white/5 border-white/5 hover:bg-white/10 text-slate-400"}`}
                  >
                    <p className="font-black uppercase tracking-tighter text-sm truncate mb-1">
                      {campaign.name}
                    </p>
                    <p className="text-[10px] font-bold opacity-70 border-t border-white/10 pt-2 flex items-center justify-between">
                      <span>{t("crm.responses.totalWithCount", { count: campaign.total })}</span>
                      {activeCampaign === campaign.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6600]/80 shadow-[0_0_8px_rgba(99,102,241,1)]" />
                      )}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-6">
              {activeStats && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div
                      onClick={() => setFilterMode("all")}
                      className={`ios-card !p-5 cursor-pointer transition-all border-2 ${filterMode === "all" ? "border-white !bg-white/10 shadow-lg" : "border-transparent"}`}
                    >
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        {t("crm.responses.total")}
                      </p>
                      <p className="text-3xl font-black text-white">
                        {activeStats.total}
                      </p>
                    </div>
                    <div
                      onClick={() => setFilterMode("yes")}
                      className={`ios-card !p-5 cursor-pointer transition-all border-2 ${filterMode === "yes" ? "border-emerald-500 !bg-emerald-500/10 shadow-lg" : "border-transparent"}`}
                    >
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        {t("crm.responses.yesApproved")}
                      </p>
                      <p className="text-3xl font-black text-white">
                        {activeStats.yes_count}
                      </p>
                    </div>
                    <div
                      onClick={() => setFilterMode("no")}
                      className={`ios-card !p-5 cursor-pointer transition-all border-2 ${filterMode === "no" ? "border-rose-500 !bg-rose-500/10 shadow-lg" : "border-transparent"}`}
                    >
                      <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        {t("crm.responses.noDeclined")}
                      </p>
                      <p className="text-3xl font-black text-white">
                        {activeStats.no_count}
                      </p>
                    </div>
                    <div
                      onClick={() => setFilterMode("pending_response")}
                      className={`ios-card !p-5 cursor-pointer transition-all border-2 ${filterMode === "pending_response" ? "border-amber-500 !bg-amber-500/10 shadow-lg" : "border-transparent"}`}
                    >
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                        {t("crm.responses.waiting")}
                      </p>
                      <p className="text-3xl font-black text-white">
                        {activeStats.pending_response}
                      </p>
                    </div>
                  </div>

                  <div className="ios-card bg-transparent border-white/5 space-y-6 !p-0 overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 border-b border-white/5">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                          type="text"
                          placeholder={t("crm.responses.searchList")}
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-sm text-white outline-none focus:border-[#FF6600]/80/50 transition-colors font-bold"
                        />
                      </div>
                      <button
                        onClick={() => setShowRetargetModal(true)}
                        className="flex items-center justify-center gap-2 py-3 px-6 bg-[#FF6600]/80 text-white rounded-xl font-bold text-sm uppercase tracking-wide shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:scale-105 transition-all w-full md:w-auto"
                      >
                        <Rocket className="w-4 h-4" /> {t("crm.responses.sendFollowUp")}
                      </button>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left">
                        <thead className="bg-[#0d0d18]">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              {t("crm.responses.name")}
                            </th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              {t("crm.responses.status")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredList.map((contact) => (
                            <tr
                              key={contact.cid}
                              className="hover:bg-white/[0.02] transition-colors"
                            >
                              <td className="px-6 py-5">
                                <p className="font-black text-white text-sm uppercase -tracking-wider mb-0.5">
                                  {contact.name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold">
                                  {contact.email}
                                </p>
                              </td>
                              <td className="px-6 py-5">
                                {contact.status === "yes" && (
                                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                    {t("crm.responses.approved")}
                                  </span>
                                )}
                                {contact.status === "no" && (
                                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">
                                    {t("crm.responses.declined")}
                                  </span>
                                )}
                                {contact.status === "sent" && (
                                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase">
                                    {t("crm.responses.waiting")}
                                  </span>
                                )}
                                {!["yes", "no", "sent"].includes(contact.status) && (
                                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-white/10 text-slate-400 border border-white/20 uppercase">
                                    {t(RESPONSE_STATUS_LABELS[contact.status] || "") || contact.status}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredList.length === 0 && (
                        <div className="py-20 text-center text-slate-500 font-bold text-sm">
                          {t("crm.responses.noResultsForFilter")}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showRetargetModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto">
            <div
              onClick={() => setShowRetargetModal(false)}
              className="absolute inset-0 bg-black/80"
            />
            <div className="relative w-full max-w-md ios-card !p-8 shadow-2xl bg-[#080810] border border-white/10 m-4 text-left">
              <button
                onClick={() => setShowRetargetModal(false)}
                className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="mb-8">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
                  {t("crm.responses.followUp")}
                </h3>
                <p className="text-sm text-slate-400 font-bold">
                  {t("crm.responses.newCampaignForPrefix")}{" "}
                  <span className="text-white font-black">
                    {filteredList.length}
                  </span>{" "}
                  {t("crm.responses.newCampaignForSuffix")}
                </p>
              </div>
              <form onSubmit={executeRetarget} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    {t("crm.responses.campaignName")}
                  </label>
                  <input
                    required
                    autoFocus
                    type="text"
                    value={newCampaignName}
                    onChange={(event) => setNewCampaignName(event.target.value)}
                    placeholder={t("crm.responses.campaignNamePlaceholder")}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pb-2 text-white outline-none focus:border-[#FF6600]/80/50 focus:bg-white/10 transition-colors font-bold"
                  />
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn-prime !py-4 shadow-[#FF6600]/20 text-sm disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Rocket className="w-4 h-4" />
                        <span>{t("crm.responses.startFollowUpList")}</span>
                      </div>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
