"use client";
import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  CheckSquare,
  AlignLeft,
  CheckCircle,
  Search,
  Save,
  X,
  Loader2,
  Copy,
  Edit3,
  Trash2,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { formatLocaleDate } from "@/lib/constants";

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop.
const pickForms = (payload) => (payload?.success ? payload.forms || [] : []);
const pickFamilies = (payload) => (payload?.success ? payload.families || [] : []);

export default function FormsPage() {
  const { t, lang } = useI18n();
  const goBack = useSafeBack("/admin/crm");

  // Both reads' loaders — cache-first paint, discarding a stale response, the
  // background refresh — belong to the hook, so the screen keeps no list state
  // of its own and never sets state from an effect. Only the form list drives the
  // spinner, exactly as before: the group list was always a background read.
  const { data: forms, loading, refresh: refreshForms } = useApi("/api/forms", {
    defaultValue: [],
    transform: pickForms,
  });
  const { data: families, refresh: refreshFamilies } = useApi("/api/families", {
    defaultValue: [],
    transform: pickFamilies,
  });

  // Modals & UI State
  const [view, setView] = useState("list"); // list, builder, responses
  const [selectedForm, setSelectedForm] = useState(null);
  const [responses, setResponses] = useState([]);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [showResponseDetails, setShowResponseDetails] = useState(false);
  const [searchForms, setSearchForms] = useState("");
  const [schema, setSchema] = useState([]);
  const [formName, setFormName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFormId, setEditFormId] = useState(null);
  const [copiedLink, setCopiedLink] = useState("");
  const [selectedGroupName, setSelectedGroupName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);

  const addField = (type) => {
    const newField = {
      id: Date.now().toString(),
      type,
      label: type === "text" ? t("crm.forms.questionTextPlaceholder") : t("crm.forms.questionYesNoPlaceholder"),
      required: true,
    };
    setSchema([...schema, newField]);
  };

  const updateField = (id, key, value) => {
    setSchema(schema.map((field) => (field.id === id ? { ...field, [key]: value } : field)));
  };

  const removeField = (id) => {
    setSchema(schema.filter((field) => field.id !== id));
  };

  const submitForm = async () => {
    if (!formName) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("crm.forms.formNeedsName") },
        }),
      );
      return;
    }
    if (schema.length === 0) {
      window.dispatchEvent(
        new CustomEvent("impactos:notify", {
          detail: { type: "error", message: t("crm.forms.addAtLeastOneQuestion") },
        }),
      );
      return;
    }

    setIsSubmitting(true);
    try {
      let finalGroupName = selectedGroupName;
      if (showNewGroupInput && newGroupName) {
        // Create new family/group
        await fetch("/api/families", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newGroupName }),
        });
        finalGroupName = newGroupName;
        refreshFamilies();
      }

      const response = await fetch("/api/forms", {
        method: editFormId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: editFormId,
          name: formName,
          schema,
          group_name: finalGroupName || null,
        }),
      });
      const payload = await response.json();
      if (payload.success) {
        setView("list");
        setEditFormId(null);
        setFormName("");
        setSchema([]);
        setSelectedGroupName("");
        setNewGroupName("");
        setShowNewGroupInput(false);
        refreshForms();
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.forms.saved") },
          }),
        );
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

  const deleteForm = async (formId) => {
    try {
      const response = await fetch("/api/forms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_id: formId }),
      });
      const payload = await response.json();
      if (payload.success) {
        refreshForms();
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: { type: "success", message: t("crm.forms.archived") },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("impactos:notify", {
            detail: {
              type: "error",
              message: t((payload.error || t("crm.forms.archiveFailed")) || "") || (payload.error || t("crm.forms.archiveFailed")),
            },
          }),
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  // The spinner this used to toggle is the form list's, and the responses view
  // never rendered through it — the flag had no visible effect here. It is left
  // out rather than given a second flag that nothing would read.
  const fetchResponses = async (formId) => {
    try {
      const response = await fetch(`/api/responses?form_id=${formId}`);
      const payload = await response.json();
      if (payload.success) {
        const filtered = payload.detailedResponses.filter(
          (responseRecord) => responseRecord.form_id === formId,
        );
        setResponses(filtered);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const openResponses = (form) => {
    setSelectedForm(form);
    fetchResponses(form.form_id);
    setView("responses");
  };

  const handleEdit = (form) => {
    setEditFormId(form.form_id);
    setFormName(form.name);
    setSchema(form.schema);
    setSelectedGroupName(form.group_name || "");
    setView("builder");
  };

  const copyLink = (formId) => {
    const url = `${window.location.origin}/form/${formId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(formId);
    window.dispatchEvent(
      new CustomEvent("impactos:notify", {
        detail: { type: "success", message: t("crm.forms.publicLinkCopied") },
      }),
    );
    setTimeout(() => setCopiedLink(""), 2000);
  };

  const filteredForms = forms.filter(
    (form) =>
      form.name.toLowerCase().includes(searchForms.toLowerCase()) ||
      form.form_id.toLowerCase().includes(searchForms.toLowerCase()),
  );

  return (
    <>
      <div className="space-y-8 min-h-[60vh]">
        {/* Back navigation */}
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("crm.forms.backToPrevious")}
          </button>
          <Link
            href="/admin/crm"
            className="inline-flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--brand-orange)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("crm.forms.backToCrm")}
          </Link>
        </nav>
        <header className="flex flex-col lg:flex-row justify-between items-start gap-6">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">
              {t("crm.forms.forms")}
            </h2>
            <p className="text-slate-400 font-bold tracking-tight">
              {t("crm.forms.formsSubtitle")}
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setEditFormId(null);
                setFormName("");
                setSchema([]);
                setView("builder");
              }}
              className="btn-prime !py-4 shadow-[#FF6600]/10"
            >
              <Plus className="w-5 h-5 mr-2" /> {t("crm.forms.newForm")}
            </button>
          </div>
        </header>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input
              type="text"
              placeholder={t("crm.forms.searchForms")}
              value={searchForms}
              onChange={(event) => setSearchForms(event.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white outline-none focus:border-[#FF6600]/80/30 transition-colors font-bold placeholder:text-slate-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="w-10 h-10 text-[#FF6600]/80 animate-spin" />
          </div>
        ) : forms.length === 0 ? (
          <div className="p-20 text-center bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
            <CheckSquare className="w-16 h-16 text-slate-500 mx-auto mb-6 opacity-50" />
            <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">
              {t("crm.forms.noForms")}
            </h4>
            <p className="text-slate-400 text-sm font-bold">
              {t("crm.forms.noFormsHint")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredForms.map((form) => (
              <div
                key={form.form_id}
                className="ios-card group hover:border-[#FF6600]/30 transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(form)}
                      className="p-2 rounded-lg bg-white/5 border border-white/5 text-slate-500 hover:text-[#FF6600] transition-all"
                      title={t("crm.forms.editStructure")}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteForm(form.form_id)}
                      className="p-2 rounded-lg bg-white/5 border border-white/5 text-slate-500 hover:text-rose-500 transition-all"
                      title={t("crm.forms.archiveForm")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="badge badge-glow-success uppercase text-[10px] font-bold h-fit ml-2">
                      {t("crm.forms.active")}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-1 truncate">
                  {form.name}
                </h3>
                <p className="text-xs text-slate-500 font-bold mb-6">
                  {t("crm.forms.idLabel")} {form.form_id}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      {t("crm.forms.questions")}
                    </p>
                    <p className="text-lg font-black text-white">
                      {form.schema.length}
                    </p>
                  </div>
                  <button
                    onClick={() => openResponses(form)}
                    className="bg-[#FF6600]/10 border border-[#FF6600]/20 rounded-2xl p-4 flex flex-col hover:bg-[#FF6600]/20 transition-all group/resp"
                  >
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover/resp:text-[#FF6600]">
                      {t("crm.forms.responses")}
                    </p>
                    <p className="text-lg font-black text-white">{t("crm.forms.viewList")}</p>
                  </button>
                </div>

                <button
                  onClick={() => copyLink(form.form_id)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-colors border border-white/10"
                >
                  {copiedLink === form.form_id ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copiedLink === form.form_id
                    ? t("crm.forms.linkCopied")
                    : t("crm.forms.copyFormLink")}
                </button>
              </div>
            ))}
          </div>
        )}

        {view === "responses" && selectedForm && (
          <div className="ios-card !p-0 overflow-hidden border-white/5 shadow-2xl bg-white/[0.01] animation-reveal">
            <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-[#0d0d18]/50">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setView("list")}
                  className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                    {selectedForm.name} — {t("crm.forms.responses")}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {t("crm.forms.submissionsFound", { count: responses.length })}
                  </p>
                </div>
              </div>
            </header>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="executive-table w-full">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="px-8 py-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left">
                      {t("crm.forms.respondent")}
                    </th>
                    <th className="px-8 py-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left">
                      {t("crm.forms.originGroup")}
                    </th>
                    <th className="px-8 py-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left">
                      {t("crm.forms.submissionDate")}
                    </th>
                    <th className="px-8 py-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">
                      {t("crm.forms.action")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((response) => (
                    <tr
                      key={response.id}
                      className="group hover:bg-white/[0.01] border-b border-white/[0.02]"
                    >
                      <td className="px-8 py-6">
                        <p className="font-bold text-white uppercase">
                          {response.name || t("crm.forms.anonymous")}
                        </p>
                        <p className="text-[10px] font-bold text-slate-500 font-mono">
                          {response.email || response.cid || t("crm.forms.na")}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-[10px] font-bold text-white uppercase">
                          {response.group_name || t("crm.forms.individual")}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-xs font-bold text-slate-400">
                          {formatLocaleDate(response.created_at, { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }, lang)}
                        </p>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() => {
                            setSelectedResponse(response);
                            setShowResponseDetails(true);
                          }}
                          className="px-4 py-2 bg-white/5 hover:bg-[#FF6600]/10 rounded-lg text-slate-400 hover:text-[#FF6600] transition-all border border-white/5 text-[10px] font-bold uppercase tracking-widest"
                        >
                          {t("crm.forms.viewDetails")}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {responses.length === 0 && (
                    <tr>
                      <td
                        colSpan="3"
                        className="px-8 py-20 text-center text-slate-500 font-bold uppercase text-sm tracking-widest"
                      >
                        {t("crm.forms.noResponsesYet")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showResponseDetails && selectedResponse && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <div
              onClick={() => setShowResponseDetails(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <div className="relative w-full max-w-2xl bg-[#0d0d18] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animation-pop">
              <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="text-xl font-black text-white uppercase">
                    {t("crm.forms.responseDetails")}
                  </h4>
                  <p className="text-[10px] font-bold text-[#FF6600] uppercase tracking-widest">
                    {selectedResponse.name || t("crm.forms.anonymousRespondent")}
                  </p>
                </div>
                <button
                  onClick={() => setShowResponseDetails(false)}
                  className="text-slate-500 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </header>
              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {Object.entries(selectedResponse.answers).map(
                  ([, answer], index) => (
                    <div key={index} className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {t("crm.forms.questionNumber", { n: index + 1 })}
                      </p>
                      <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                        <p className="text-sm font-bold text-white leading-relaxed">
                          {answer}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {view === "builder" && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-auto">
            <div
              onClick={() => setView("list")}
              className="absolute inset-0 bg-black/80"
            />
            <div className="relative w-full max-w-4xl h-[85vh] flex flex-col ios-card !p-0 shadow-2xl bg-[#080810] border border-white/10 m-4 overflow-hidden text-left">
              <header className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-[#0d0d18] flex-shrink-0">
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                    {editFormId ? t("crm.forms.modifyForm") : t("crm.forms.newForm")}
                  </h3>
                  <p className="text-sm text-slate-400 font-bold">
                    {editFormId
                      ? t("crm.forms.updateQuestionNodes")
                      : t("crm.forms.addQuestionsToNewForm")}
                  </p>
                </div>
                <button
                  onClick={() => setView("list")}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </header>

              <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                <div className="max-w-2xl mx-auto space-y-8">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3">
                      {t("crm.forms.formNameLabel")}
                    </label>
                    <input
                      type="text"
                      placeholder={t("crm.forms.formNamePlaceholder")}
                      value={formName}
                      onChange={(event) => setFormName(event.target.value)}
                      className="w-full bg-transparent border-b-2 border-white/10 py-2 text-3xl font-black text-white outline-none focus:border-[#FF6600]/80/50 transition-colors placeholder:text-slate-700 mb-6"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                      {t("crm.forms.deploymentContext")}
                    </label>
                    <div className="flex gap-4">
                      <select
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none font-bold appearance-none cursor-pointer"
                        value={showNewGroupInput ? "NEW" : selectedGroupName}
                        onChange={(event) => {
                          if (event.target.value === "NEW") {
                            setShowNewGroupInput(true);
                          } else {
                            setShowNewGroupInput(false);
                            setSelectedGroupName(event.target.value);
                          }
                        }}
                      >
                        <option value="" className="bg-[#0f0f1a]">
                          {t("crm.forms.generalNoSpecificGroup")}
                        </option>
                        {families.map((family) => (
                          <option
                            key={family.id}
                            value={family.name}
                            className="bg-[#0f0f1a]"
                          >
                            {family.name.toUpperCase()}
                          </option>
                        ))}
                        <option
                          value="NEW"
                          className="bg-[#0f0f1a] text-[#FF6600] font-black"
                        >
                          {t("crm.forms.createNewGroup")}
                        </option>
                      </select>

                      {showNewGroupInput && (
                        <input
                          placeholder={t("crm.forms.newGroupNamePlaceholder")}
                          className="flex-1 bg-[#FF6600]/5 border border-[#FF6600]/20 rounded-2xl px-6 py-4 text-white outline-none font-bold"
                          value={newGroupName}
                          onChange={(event) => setNewGroupName(event.target.value)}
                          autoFocus
                        />
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
                      {t("crm.forms.linkGroupHint")}
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {t("crm.forms.questions")}
                      </h4>
                      <span className="badge bg-white/5 text-white">
                        {t("crm.forms.totalCount", { count: schema.length })}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {schema.length === 0 && (
                        <div className="p-10 border border-dashed border-white/10 rounded-2xl text-center">
                          <p className="text-slate-500 font-bold text-sm">
                            {t("crm.forms.noQuestionsYet")}
                          </p>
                        </div>
                      )}
                      {schema.map((field, index) => (
                        <div
                          key={field.id}
                          className="ios-card bg-white/[0.02] border-white/5 p-6 space-y-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-[#FF6600]/80/10 border border-[#FF6600]/80/20 flex items-center justify-center text-indigo-400 font-black text-xs">
                                {index + 1}
                              </div>
                              <input
                                type="text"
                                value={field.label}
                                onChange={(event) =>
                                  updateField(field.id, "label", event.target.value)
                                }
                                className="flex-1 bg-transparent border-none text-lg font-bold text-white outline-none placeholder:text-slate-600 focus:ring-0"
                              />
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-white/5 px-2 py-1 rounded">
                                {field.type === "text"
                                  ? t("crm.forms.freeText")
                                  : t("crm.forms.yesNo")}
                              </span>
                              <button
                                onClick={() => removeField(field.id)}
                                className="text-rose-500 hover:text-rose-400 transition-colors"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          <div className="pl-11">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 cursor-pointer w-fit">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(event) =>
                                  updateField(
                                    field.id,
                                    "required",
                                    event.target.checked,
                                  )
                                }
                                className="accent-[#FF6600]/80"
                              />
                              {t("crm.forms.requiredField")}
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <button
                        onClick={() => addField("text")}
                        className="flex items-center justify-center gap-2 py-4 bg-[#FF6600]/80/10 hover:bg-[#FF6600]/80 text-indigo-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors border border-[#FF6600]/80/20"
                      >
                        <AlignLeft className="w-4 h-4" /> {t("crm.forms.addTextQuestion")}
                      </button>
                      <button
                        onClick={() => addField("yes_no")}
                        className="flex items-center justify-center gap-2 py-4 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors border border-emerald-500/20"
                      >
                        <CheckSquare className="w-4 h-4" /> {t("crm.forms.addYesNoQuestion")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-[#0d0d18] border-t border-white/5 flex justify-end gap-3 flex-shrink-0">
                <button
                  onClick={() => setView("list")}
                  className="btn-ghost !px-8 text-sm"
                >
                  {t("crm.forms.discard")}
                </button>
                <button
                  onClick={submitForm}
                  disabled={isSubmitting}
                  className="btn-prime !px-8 text-sm shadow-[#FF6600]/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isSubmitting ? t("crm.forms.saving") : t("crm.forms.saveForm")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
