"use client";

import { FileText, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";
import { useDialogs } from "@/components/ui/DialogProvider";

/* Add Document Modal */
function AddDocumentModal() {
  const { t } = useI18n();
  const { showAddDocument, setShowAddDocument, params, documentForm, setDocumentForm, fetchDocuments, notifyMsg, inputStyle } = useVenture();
  if (!showAddDocument) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowAddDocument(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.upload')}</h2><button onClick={() => setShowAddDocument(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <form onSubmit={async event => { event.preventDefault(); const response = await fetch(`/api/ventures/${params.id}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'upload', title: documentForm.name, file_name: documentForm.name + '.pdf', file_url: documentForm.file_url, category: documentForm.category }) }); const payload = await response.json(); if (!payload.success) notifyMsg(t(payload.error || 'Upload failed') || payload.error || 'Upload failed'); setShowAddDocument(false); setDocumentForm({}); fetchDocuments(); }} className="space-y-3">
          <input placeholder="Document name" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={documentForm.name || ''} onChange={event => setDocumentForm({ ...documentForm, name: event.target.value })} required />
          <input placeholder="https://... (file URL)" className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={documentForm.file_url || ''} onChange={event => setDocumentForm({ ...documentForm, file_url: event.target.value })} required />
          <select className="w-full px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={documentForm.category || 'general'} onChange={event => setDocumentForm({ ...documentForm, category: event.target.value })}>
            {['business', 'legal', 'financial', 'investment', 'brand', 'general'].map(category => <option key={category} value={category}>{category}</option>)}
          </select>
          <button type="submit" className="w-full py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--brand-orange)' }}>{t('venture.save')}</button>
        </form>
      </div>
    </div>
  );
}

/* Review Modal */
function ReviewModal() {
  const { t } = useI18n();
  const { showReview, reviewDoc, setShowReview, setReviews, reviews, reviewComment, setReviewComment, handleSubmitReview, inputStyle } = useVenture();
  if (!showReview || !reviewDoc) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowReview(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.review')}</h2><button onClick={() => { setShowReview(false); setReviews([]); }} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        {/* Existing reviews */}
        {reviews.length > 0 && <div className="mb-4 space-y-2 max-h-40 overflow-y-auto">{reviews.map((review, index) => (<div key={index} className="text-xs p-2 rounded-lg border" style={{ borderColor: 'rgb(255 255 255 / 0.08)' }}><span className={`${review.decision === 'approved' ? 'text-green-400' : review.decision === 'revision_requested' ? 'text-amber-400' : 'text-blue-400'}`}>{review.decision}</span>{review.comment && <span className="block" style={{ color: 'var(--text-secondary)' }}>{review.comment}</span>}</div>))}</div>}
        <textarea placeholder={t('venture.comments')} className="w-full px-3 py-2 rounded-lg outline-none border mb-3" style={inputStyle} rows={3} value={reviewComment} onChange={event => setReviewComment(event.target.value)} />
        <div className="flex gap-2">
          <button onClick={() => handleSubmitReview(reviewDoc.id, 'comment')} className="flex-1 py-2 rounded-lg text-sm text-white" style={{ backgroundColor: '#3b82f6' }}>{t('venture.comments')}</button>
          <button onClick={() => handleSubmitReview(reviewDoc.id, 'approved')} className="flex-1 py-2 rounded-lg text-sm text-white" style={{ backgroundColor: '#22c55e' }}>{t('venture.approve')}</button>
          <button onClick={() => handleSubmitReview(reviewDoc.id, 'revision_requested')} className="flex-1 py-2 rounded-lg text-sm text-white" style={{ backgroundColor: '#f59e0b' }}>{t('venture.requestRevision')}</button>
        </div>
      </div>
    </div>
  );
}

/* Permissions Modal */
function PermissionsModal() {
  const { t } = useI18n();
  const { showPermissions, permissionsDoc, setShowPermissions, permissions, setPermissions, handleSavePermission, inputStyle } = useVenture();
  if (!showPermissions || !permissionsDoc) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowPermissions(false)}>
      <div className="rounded-2xl p-6 w-full max-w-md mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.permissions') || 'Permissions'}</h2><button onClick={() => setShowPermissions(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{t('venture.permissionsDesc') || 'Configure who can access this document'}</p>
        <div className="space-y-3">
          {permissions.map(permission => (
            <div key={permission.role_scope} className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'rgb(255 255 255 / 0.05)' }}>
              <span className="text-sm capitalize">{permission.role_scope}</span>
              <select
                className="px-2 py-1 rounded-lg text-xs outline-none border"
                style={inputStyle}
                value={permission.access_level || 'view'}
                onChange={event => {
                  setPermissions(prev => prev.map(currentPermission => currentPermission.role_scope === permission.role_scope ? { ...currentPermission, access_level: event.target.value } : currentPermission));
                  handleSavePermission(permissionsDoc.id, permission.role_scope, event.target.value);
                }}
              >
                <option value="none">{t('venture.noAccess') || 'No Access'}</option>
                <option value="view">{t('venture.canView') || 'Can View'}</option>
                <option value="edit">{t('venture.canEdit') || 'Can Edit'}</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Versions Modal */
function VersionsModal() {
  const { t } = useI18n();
  const { showVersions, versionsDoc, setShowVersions, versions, handleVersionRestore } = useVenture();
  if (!showVersions || !versionsDoc) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgb(0 0 0 / 0.6)' }} onClick={() => setShowVersions(false)}>
      <div className="rounded-2xl p-6 w-full max-w-lg mx-4 border shadow-xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: '#0f172a', borderColor: 'rgb(255 255 255 / 0.1)', color: 'var(--text-primary)' }} onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">{t('venture.versions')}: {versionsDoc.name}</h2><button onClick={() => setShowVersions(false)} style={{ color: 'var(--text-secondary)' }}><X size={20} /></button></div>
        {versions.length === 0 ? (<p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No versions</p>) : versions.map((version, index) => (
          <div key={index} className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: 'rgb(255 255 255 / 0.05)' }}>
            <div>
              <p className="text-sm font-medium">v{version.version_number || version.version || (index + 1)}</p>
              {version.file_url && <a href={version.file_url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">{version.file_url}</a>}
              {version.change_notes && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{version.change_notes}</p>}
            </div>
            <div className="flex gap-2">
              <a href={version.file_url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-lg" style={{ color: 'var(--text-secondary)', border: '1px solid rgb(255 255 255 / 0.15)' }}>{t('venture.download')}</a>
              <button onClick={() => handleVersionRestore(version.file_url, version.version_number)} className="text-xs px-2 py-1 rounded-lg" style={{ color: 'var(--brand-orange)', border: '1px solid var(--brand-orange)' }}>{t('venture.restore')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Documents Tab */
export function DocumentsTab() {
  const { t } = useI18n();
  const { confirm, prompt } = useDialogs();
  const { documents, setShowAddDocument, documentSearch, setDocumentSearch, documentCategory, setDocumentCategory, params, handleDocumentUpdate, handleDocumentTransition, handleDocumentDelete, handleReview, handlePermissions, setVersions, setVersionsDoc, setShowVersions, inputStyle, cardStyle } = useVenture();
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t('venture.documents')} ({documents.length})</h2>
          <button onClick={() => setShowAddDocument(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: 'var(--brand-orange)' }}><FileText size={16} /> {t('venture.upload')}</button>
        </div>
        <div className="flex gap-2">
          <input type="text" placeholder="Search documents..." className="flex-1 px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={documentSearch} onChange={event => setDocumentSearch(event.target.value)} />
          <select className="px-3 py-2 rounded-lg outline-none border" style={inputStyle} value={documentCategory} onChange={event => setDocumentCategory(event.target.value)}>
            <option value="">All categories</option>
            {['business', 'legal', 'financial', 'investment', 'brand', 'general'].map(category => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        {documents.length === 0 ? (<div className="rounded-xl p-6 border text-center" style={{ ...cardStyle, color: 'var(--text-secondary)' }}>{t('venture.noEvents')}</div>) :
          documents.map(doc => (
            <div key={doc.id} className="rounded-xl p-4 border" style={cardStyle}>
              <div className="flex items-center justify-between">
                <div><a href={doc.file_url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{doc.name}</a><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{doc.category}{doc.folder && ` / ${doc.folder}`}</p></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">{t(`venture.${doc.approval_status === 'shared_with_investor' ? 'sharedWithInvestor' : doc.approval_status === 'pending_review' ? 'pendingReview' : doc.approval_status}`)}</span>
                  <button onClick={async () => { const newUrl = await prompt({ message: t('venture.fileUrlPrompt'), defaultValue: doc.file_url }); if (newUrl) handleDocumentUpdate(doc.id, newUrl); }} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--brand-orange)', border: '1px solid var(--brand-orange)' }}>{t('venture.replace')}</button>
                  <button onClick={async () => { const response = await fetch(`/api/ventures/${params.id}/documents?type=detail&document_id=${doc.id}`); const payload = await response.json(); if (payload.success && payload.document && payload.document.versions) setVersions(payload.document.versions); else { const response2 = await fetch(`/api/ventures/${params.id}/documents/${doc.id}/versions`); const payload2 = await response2.json(); setVersions(payload2.versions || []); } setVersionsDoc(doc); setShowVersions(true); }} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--text-secondary)', border: '1px solid rgb(255 255 255 / 0.15)' }}>{t('venture.versions')}</button>
                  {doc.approval_status === 'pending_review' && <button onClick={() => handleReview(doc.id)} className="text-xs px-2 py-0.5 rounded" style={{ color: '#22c55e', border: '1px solid rgb(34 197 94 / 0.3)' }}>{t('venture.review')}</button>}
                  <button onClick={() => handlePermissions(doc.id)} className="text-xs px-2 py-0.5 rounded" style={{ color: '#a78bfa', border: '1px solid rgb(167 139 250 / 0.3)' }}>{t('venture.permissions')}</button>
                  <button onClick={async () => { if (await confirm({ message: t('venture.deleteDocumentConfirm'), tone: 'danger' })) handleDocumentDelete(doc.id); }} className="text-xs px-2 py-0.5 rounded" style={{ color: '#ef4444', border: '1px solid rgb(239 68 68 / 0.3)' }}>{t('venture.delete')}</button>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                {['private', 'pending_review', 'approved', 'shared_with_investor'].map(status => (
                  <button key={status} onClick={() => handleDocumentTransition(doc.id, status)} disabled={doc.approval_status === status}
                    className="text-xs px-2 py-1 rounded-lg disabled:opacity-40" style={{ color: 'var(--text-secondary)', border: '1px solid rgb(255 255 255 / 0.15)' }}>
                    {t(`venture.${status === 'shared_with_investor' ? 'sharedWithInvestor' : status === 'pending_review' ? 'pendingReview' : status}`)}
                  </button>
                ))}
              </div>
            </div>
          ))
        }
      </div>
      <AddDocumentModal />
      <ReviewModal />
      <PermissionsModal />
      <VersionsModal />
    </>
  );
}
