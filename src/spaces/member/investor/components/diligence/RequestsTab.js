"use client";

import { FileText, Send, Plus, CheckCircle2, ClipboardList, X, Upload } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

const REQUEST_CATEGORIES = [
  { id: "corporate", label: "Corporate", color: "bg-blue-500/10 text-blue-400" },
  { id: "financial", label: "Financial", color: "bg-emerald-500/10 text-emerald-400" },
  { id: "commercial", label: "Commercial", color: "bg-amber-500/10 text-amber-400" },
  { id: "technical", label: "Technical", color: "bg-purple-500/10 text-purple-400" },
  { id: "legal", label: "Legal", color: "bg-rose-500/10 text-rose-400" },
];

/**
 * The Requests tab: the add-request form, its category picker, the request
 * list with responses, follow-up questions and the documents section.
 * Extracted verbatim from DueDiligenceContent.
 */
export default function RequestsTab({
  requests,
  showRequestForm,
  setShowRequestForm,
  newRequest,
  setNewRequest,
  addRequest,
  updateRequest,
  followupRequestId,
  setFollowupRequestId,
  followupQuestion,
  setFollowupQuestion,
  addFollowup,
  uploadRequestId,
  setUploadRequestId,
  handleFileUpload,
  fetchDiligenceDocs,
  diligenceDocs,
  handleDownload,
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("requests")}</h3>
        <AppButton variant="primary" size="sm" icon={Plus} onClick={() => setShowRequestForm(true)}>{t("newRequest")}</AppButton>
      </div>

      {showRequestForm && (
        <AppCard padding="md">
          <div className="space-y-3">
            <input value={newRequest.title} onChange={event => setNewRequest({...newRequest, title: event.target.value})}
              placeholder="What information do you need? (e.g. Financial Statements 2024)"
              className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" />
            <div className="flex gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] self-center">Category:</span>
              {REQUEST_CATEGORIES.map(categoryOption => (
                <button key={categoryOption.id} onClick={() => setNewRequest({...newRequest, category: categoryOption.id})}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${newRequest.category === categoryOption.id ? "bg-[var(--brand-orange)] text-white" : categoryOption.color}`}>
                  {categoryOption.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Priority</label>
                <select value={newRequest.priority} onChange={event => setNewRequest({...newRequest, priority: event.target.value})}
                  className="w-full mt-0.5 px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-[10px] font-bold text-[var(--text-primary)] outline-none">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Due Date</label>
                <input type="date" value={newRequest.due_date} onChange={event => setNewRequest({...newRequest, due_date: event.target.value})}
                  className="w-full mt-0.5 px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-[10px] font-bold text-[var(--text-primary)] outline-none" />
              </div>
            </div>
            <textarea value={newRequest.description} onChange={event => setNewRequest({...newRequest, description: event.target.value})}
              rows={2} placeholder="Additional details or comments..."
              className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none" />
            <div className="flex gap-2 justify-end">
              <AppButton variant="secondary" size="sm" onClick={() => setShowRequestForm(false)}>{t("cancel")}</AppButton>
              <AppButton variant="primary" size="sm" icon={Send} onClick={addRequest}>{t("submit")}</AppButton>
            </div>
          </div>
        </AppCard>
      )}

      {requests.length === 0 && !showRequestForm ? (
        <div className="text-center py-12">
          <ClipboardList className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-sm font-bold text-[var(--text-secondary)]">No requests yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => {
            const category = REQUEST_CATEGORIES.find(categoryOption => categoryOption.id === request.category) || REQUEST_CATEGORIES[0];
            return (
              <AppCard key={request.id} padding="md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${category.color}`}>{category.label}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        request.status === "responded" || request.status === "closed" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                      }`}>{request.status}</span>
                    </div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{request.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {request.priority && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          request.priority === "high" ? "bg-rose-500/10 text-rose-400" : request.priority === "medium" ? "bg-amber-500/10 text-amber-400" : "bg-slate-500/10 text-slate-400"
                        }`}>{request.priority}</span>
                      )}
                      {request.due_date && (
                        <span className="text-[10px] font-medium text-[var(--text-tertiary)]">Due: {new Date(request.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                    {request.description && <p className="text-xs text-[var(--text-secondary)] mt-1">{request.description}</p>}
                    {request.response_text && (
                      <div className="mt-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Response:</p>
                        <p className="text-xs text-[var(--text-secondary)]">{request.response_text}</p>
                      </div>
                    )}
                    {/* Follow-up questions */}
                    {request.follow_up_questions && (() => {
                      try {
                        const followUps = typeof request.follow_up_questions === "string" ? JSON.parse(request.follow_up_questions) : request.follow_up_questions;
                        if (!Array.isArray(followUps) || followUps.length === 0) return null;
                        return (
                          <div className="mt-2 space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Follow-up Questions</p>
                            {followUps.map((followUp, index) => (
                              <div key={index} className="p-2 rounded-lg bg-[var(--surface-2)] text-[10px]">
                                <p className="text-[var(--text-primary)] font-bold">Q: {followUp.question}</p>
                                {followUp.response ? (
                                  <p className="text-emerald-400 mt-1">A: {followUp.response}</p>
                                ) : (
                                  <p className="text-amber-400 mt-1">Awaiting response...</p>
                                )}
                                <p className="text-[10px] font-medium text-[var(--text-tertiary)] mt-0.5">{new Date(followUp.asked_at).toLocaleDateString()}</p>
                              </div>
                            ))}
                          </div>
                        );
                      } catch (_) { return null; }
                    })()}
                    {/* Add follow-up question (for investor, when docs uploaded) */}
                    {request.status === "documents_uploaded" || request.status === "verified" ? (
                      <div className="mt-2">
                        {followupRequestId === request.id ? (
                          <div className="flex gap-2">
                            <input value={followupQuestion} onChange={event => setFollowupQuestion(event.target.value)}
                              placeholder="Ask a follow-up question..."
                              className="flex-1 px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-[10px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60"
                              onKeyDown={event => event.key === "Enter" && addFollowup()} />
                            <AppButton variant="primary" size="sm" icon={Send} onClick={addFollowup}>Send</AppButton>
                            <AppButton variant="secondary" size="sm" onClick={() => { setFollowupRequestId(null); setFollowupQuestion(""); }}>Cancel</AppButton>
                          </div>
                        ) : (
                          <button onClick={() => setFollowupRequestId(request.id)}
                            className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline">
                            + Ask follow-up question
                          </button>
                        )}
                      </div>
                    ) : null}
                    {/* Documents section */}
                    <div className="pt-2 border-t border-[var(--border-primary)]">
                      {(diligenceDocs[request.id] || []).length > 0 && (
                        <div className="space-y-1 mb-2">
                          {(diligenceDocs[request.id] || []).map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-1.5 rounded-lg bg-[var(--surface-2)]">
                              <div className="flex items-center gap-2">
                                <FileText className="w-3 h-3 text-[var(--text-tertiary)]" />
                                <span className="text-[10px] font-bold text-[var(--text-primary)]">{doc.file_name}</span>
                                <span className="text-[10px] font-medium text-[var(--text-tertiary)]">{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)}KB` : ""}</span>
                              </div>
                              <button onClick={() => handleDownload(doc.id)}
                                className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline">Download</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {request.status !== "completed" && request.status !== "closed" && (
                        uploadRequestId === request.id ? (
                          <div className="flex items-center gap-2">
                            <input type="file" id={`inv-dd-upload-${request.id}`}
                              onChange={event => { if (event.target.files[0]) handleFileUpload(request.id, event.target.files[0]); }}
                              className="hidden" />
                            <label htmlFor={`inv-dd-upload-${request.id}`}
                              className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] text-[10px] font-bold text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
                              Choose file...
                            </label>
                            <button onClick={() => setUploadRequestId(null)}
                              className="text-[10px] font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => { setUploadRequestId(request.id); fetchDiligenceDocs(request.id); }}
                            className="flex items-center gap-1 text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline">
                            <Upload className="w-3 h-3" /> Upload Document
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {request.status === "pending" && (
                      <>
                        <AppButton variant="secondary" size="sm" onClick={() => updateRequest(request.id, "responded")}><CheckCircle2 className="w-3 h-3" /></AppButton>
                        <AppButton variant="secondary" size="sm" onClick={() => updateRequest(request.id, "closed")}><X className="w-3 h-3" /></AppButton>
                      </>
                    )}
                  </div>
                </div>
              </AppCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
