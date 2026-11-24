"use client";

import { Shield, Plus, CheckCircle2, FileText, Upload } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

const DD_CATEGORIES = ["corporate", "financial", "commercial", "technical", "legal"];

/**
 * The Due Diligence tab: the workspace status, the requests grouped by category
 * with their version history, documents and role-attributed workflow buttons.
 * Extracted verbatim from AdminRelationshipsPage.
 */
export default function DiligencePanel({
  ddData,
  selected,
  currentUserCid,
  ddDocs,
  uploadReqId,
  onDdCreateWorkspace,
  onAddRequest,
  onUpdateDdRequest,
  onUploadStart,
  onUploadCancel,
  onFileUpload,
  onDownload,
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      {!ddData?.workspace ? (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
          <p className="text-sm font-bold text-[var(--text-secondary)]">{t("investorAdmin.relationships.noDdWorkspace")}</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 mb-4">{t("investorAdmin.relationships.createDdWorkspaceHint")}</p>
          <AppButton variant="primary" size="sm" icon={Shield} onClick={onDdCreateWorkspace}>
            {t("investorAdmin.relationships.createDdWorkspace")}
          </AppButton>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">
              {t("investorAdmin.relationships.ddRequests")} ({(ddData?.requests || []).length})
            </h3>
            <AppButton variant="primary" size="sm" icon={Plus} onClick={onAddRequest}>
              {t("investorAdmin.relationships.addRequest")}
            </AppButton>
          </div>

          {/* DD workspace status */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${ddData.workspace.status === "active" ? "bg-purple-500/10 text-purple-400" : "bg-emerald-500/10 text-emerald-400"}`}>
              {ddData.workspace.status}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {t("investorAdmin.relationships.createdOn", { date: new Date(ddData.workspace.created_at).toLocaleDateString() })}
            </span>
          </div>

          {/* Requests grouped by category */}
          {DD_CATEGORIES.map(cat => {
            const catReqs = (ddData?.requests || []).filter(request => request.category === cat);
            if (catReqs.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <h4 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-wider">{cat}</h4>
                {catReqs.map(request => (
                  <AppCard key={request.id} padding="md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-[var(--text-primary)]">{request.title}</p>
                          {request.priority && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              request.priority === "high" ? "bg-rose-500/10 text-rose-400" :
                              request.priority === "medium" ? "bg-amber-500/10 text-amber-400" :
                              "bg-slate-500/10 text-slate-400"
                            }`}>{request.priority}</span>
                          )}
                        </div>
                        {request.description && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{request.description}</p>}
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-[var(--text-tertiary)]">
                          {request.due_date && <span>{new Date(request.due_date).toLocaleDateString()}</span>}
                          {request.response_text && <span className="text-emerald-400">{t("investorAdmin.relationships.responseLabel", { response: request.response_text })}</span>}
                        </div>
                        {/* Version history */}
                        {request.version_history && (() => {
                          try {
                            const hist = typeof request.version_history === "string" ? JSON.parse(request.version_history) : request.version_history;
                            if (!Array.isArray(hist) || hist.length === 0) return null;
                            return (
                              <details className="mt-2">
                                <summary className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase cursor-pointer">{t("investorAdmin.relationships.versionHistory")} ({hist.length})</summary>
                                <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                                  {hist.map((historyEntry, i) => (
                                    <div key={i} className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
                                      <span className="w-1 h-1 rounded-full bg-[var(--brand-orange)]" />
                                      {historyEntry.from_status} → {historyEntry.to_status} · {new Date(historyEntry.changed_at).toLocaleDateString()}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            );
                          } catch (_) { return null; }
                        })()}
                      </div>
                      <div className="flex flex-col items-end gap-2 ml-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          request.status === "completed" || request.status === "verified" ? "bg-emerald-500/10 text-emerald-400" :
                          request.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                          request.status === "closed" ? "bg-slate-500/10 text-slate-400" :
                          "bg-purple-500/10 text-purple-400"
                        }`}>{request.status}</span>
                        {/* Workflow buttons with role attribution */}
                        {request.status === "pending" && (currentUserCid === selected.relationship_manager_id || !selected.relationship_manager_id) && (
                          <AppButton variant="secondary" size="sm" onClick={() => onUpdateDdRequest(request.id, "under_review")}>
                            {t("investorAdmin.relationships.rmReview")}
                          </AppButton>
                        )}
                        {request.status === "under_review" && (currentUserCid === selected.relationship_manager_id || !selected.relationship_manager_id) && (
                          <AppButton variant="secondary" size="sm" onClick={() => onUpdateDdRequest(request.id, "documents_uploaded")}>
                            {t("investorAdmin.relationships.founderUploaded")}
                          </AppButton>
                        )}
                        {request.status === "documents_uploaded" && (currentUserCid === selected.investment_manager_id || !selected.investment_manager_id) && (
                          <AppButton variant="secondary" size="sm" onClick={() => onUpdateDdRequest(request.id, "verified")}>
                            {t("investorAdmin.relationships.imVerify")}
                          </AppButton>
                        )}
                        {request.status === "verified" && (currentUserCid === selected.investment_manager_id || !selected.investment_manager_id) && (
                          <AppButton variant="primary" size="sm" icon={CheckCircle2} onClick={() => onUpdateDdRequest(request.id, "completed")}>
                            {t("investorAdmin.relationships.complete")}
                          </AppButton>
                        )}
                      </div>
                    </div>
                    {/* Documents section */}
                    <div className="pt-2 border-t border-[var(--border-primary)]">
                      {(ddDocs[request.id] || []).length > 0 && (
                        <div className="space-y-1 mb-2">
                          {(ddDocs[request.id] || []).map(doc => (
                            <div key={doc.id} className="flex items-center justify-between p-1.5 rounded-lg bg-[var(--surface-2)]">
                              <div className="flex items-center gap-2">
                                <FileText className="w-3 h-3 text-[var(--text-tertiary)]" />
                                <span className="text-[10px] font-bold text-[var(--text-primary)]">{doc.file_name}</span>
                                <span className="text-[10px] text-[var(--text-tertiary)]">{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)}KB` : ""}</span>
                              </div>
                              <button onClick={() => onDownload(doc.id)}
                                className="text-[10px] font-bold text-[var(--brand-orange)] uppercase hover:underline">{t("investorAdmin.relationships.download")}</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {request.status !== "completed" && request.status !== "closed" && (
                        uploadReqId === request.id ? (
                          <div className="flex items-center gap-2">
                            <input type="file" id={`dd-upload-${request.id}`}
                              onChange={event => { if (event.target.files[0]) onFileUpload(request.id, event.target.files[0]); }}
                              className="hidden" />
                            <label htmlFor={`dd-upload-${request.id}`}
                              className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] text-[10px] font-bold text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
                              {t("investorAdmin.relationships.chooseFile")}
                            </label>
                            <button onClick={onUploadCancel}
                              className="text-[10px] font-bold text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">{t("investorAdmin.relationships.cancel")}</button>
                          </div>
                        ) : (
                          <button onClick={() => onUploadStart(request.id)}
                            className="flex items-center gap-1 text-[10px] font-bold text-[var(--brand-orange)] hover:underline">
                            <Upload className="w-3 h-3" /> {t("investorAdmin.relationships.uploadDocument")}
                          </button>
                        )
                      )}
                      </div>
                  </AppCard>
                ))}
              </div>
            );
          })}

          {(ddData?.requests || []).length === 0 && (
            <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">{t("investorAdmin.relationships.noDdRequests")}</p>
          )}
        </>
      )}
    </div>
  );
}
