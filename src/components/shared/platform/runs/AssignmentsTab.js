import { Plus, Users, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { TARGET_LABELS } from "./constants";

export default function AssignmentsTab({
  assignments, groups, contacts, programs,
  showAssign, setShowAssign, resetAssignModal,
  assignTypes, toggleAssignType,
  assignUserId, setAssignUserId,
  assignGroupId, setAssignGroupId,
  showInlineGroup, setShowInlineGroup,
  inlineGroupName, setInlineGroupName,
  handleCreateGroupInline, handleAssignWithGroup, creatingGroup,
  assignProgramId, setAssignProgramId,
  assignOtherType, setAssignOtherType,
  assignOtherId, setAssignOtherId,
  handleAssign, saving, handleUnassign,
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.assignedAudiences")}</h3>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">{t("platformMisc.runs.assignedAudiencesDesc")}</p>
        </div>
        <button onClick={() => { setShowAssign(true); resetAssignModal(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110"><Plus className="w-3 h-3" /> {t("platformMisc.runs.add")}</button>
      </div>

      {assignments.length === 0 ? (
        <div className="py-16 text-center bg-secondary rounded-2xl border border-[var(--border-primary)] border-dashed">
          <Users className="w-8 h-8 mx-auto text-[var(--text-secondary)] opacity-30" />
          <p className="text-sm text-[var(--text-secondary)] mt-3">{t("platformMisc.runs.noAssignments")}</p>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">{t("platformMisc.runs.noAssignmentsHint")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
          <table className="w-full text-left">
            <thead className="bg-tertiary">
              <tr className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                <th className="px-4 py-3">{t("platformMisc.runs.colType")}</th>
                <th className="px-4 py-3">{t("platformMisc.runs.targetId")}</th>
                <th className="px-4 py-3">{t("platformMisc.runs.colAssigned")}</th>
                <th className="px-4 py-3">{t("platformMisc.runs.colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {assignments.map((assignment) => {
                const group = assignment.target_type === "group" ? groups.find((candidate) => (candidate.registration_id || candidate.id) === assignment.target_id) : null;
                const contact = assignment.target_type === "user" ? contacts.find((candidate) => candidate.cid === assignment.target_id) : null;
                const targetName = assignment.target_name || (group ? group.name : contact ? (contact.name || contact.email) : assignment.target_id);
                return (
                  <tr key={assignment.id} className="text-[11px] font-bold text-[var(--text-primary)] hover:bg-tertiary/50">
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded bg-brand-orange/10 text-[var(--brand-orange)] text-[10px] font-bold uppercase">{t(TARGET_LABELS[assignment.target_type]) || assignment.target_type}</span></td>
                    <td className="px-4 py-3 text-[10px] font-medium text-[var(--text-secondary)]">{targetName}</td>
                    <td className="px-4 py-3 text-[10px] font-medium text-[var(--text-secondary)]">{new Date(assignment.assigned_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3"><button onClick={() => handleUnassign(assignment.id)} className="text-rose-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add assignment modal */}
      {showAssign && (
        <div className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6" onClick={() => setShowAssign(false)}>
          <div className="card w-full max-w-sm space-y-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-between items-center"><h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.addAssignment")}</h3><button onClick={() => setShowAssign(false)}><X className="w-5 h-5" /></button></div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.assignTo")}</label>
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.runs.assignToHint")}</p>
                <div className="space-y-2 pt-1">
                  {/* User */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={assignTypes.user} onChange={() => toggleAssignType("user")} className="w-3.5 h-3.5 accent-[var(--brand-orange)]" />
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{t("platformMisc.runs.targetUser")}</span>
                  </label>
                  {assignTypes.user && (
                    <select value={assignUserId} onChange={(event) => setAssignUserId(event.target.value)} className="w-full rounded-xl px-3 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] max-h-40">
                      <option value="">{t("platformMisc.runs.selectUser")}</option>
                      {contacts.map((contact) => <option key={contact.cid} value={contact.cid}>{contact.name || contact.email || contact.cid}</option>)}
                    </select>
                  )}

                  {/* Group */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={assignTypes.group} onChange={() => toggleAssignType("group")} className="w-3.5 h-3.5 accent-[var(--brand-orange)]" />
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{t("platformMisc.runs.targetGroup")}</span>
                  </label>
                  {assignTypes.group && (
                    <div className="space-y-1">
                      <select value={assignGroupId} onChange={(event) => setAssignGroupId(event.target.value)} className="w-full rounded-xl px-3 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                        <option value="">{t("platformMisc.runs.selectGroup")}</option>
                        {groups.map((group) => <option key={group.registration_id || group.id} value={group.registration_id || group.id}>{group.name}</option>)}
                      </select>
                      {!showInlineGroup ? (
                        <button
                          type="button"
                          onClick={() => setShowInlineGroup(true)}
                          className="text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:opacity-80 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> {t("platformMisc.runs.newGroup")}
                        </button>
                      ) : (
                        <div className="flex gap-2 items-center">
                          <input
                            autoFocus
                            value={inlineGroupName}
                            onChange={(event) => setInlineGroupName(event.target.value)}
                            onKeyDown={(event) => { if (event.key === "Enter") handleCreateGroupInline(handleAssignWithGroup); }}
                            placeholder={t("platformMisc.runs.groupNamePlaceholder")}
                            className="flex-1 rounded-xl px-3 py-2 text-sm font-bold outline-none bg-primary border border-[var(--brand-orange)] text-[var(--text-primary)]"
                          />
                          <button
                            type="button"
                            onClick={() => handleCreateGroupInline(handleAssignWithGroup)}
                            disabled={creatingGroup || !inlineGroupName.trim()}
                            className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide disabled:opacity-40"
                          >
                            {creatingGroup ? "..." : t("platformMisc.runs.createAndAssign")}
                          </button>
                          <button type="button" onClick={() => { setShowInlineGroup(false); setInlineGroupName(""); }} className="p-2 text-[var(--text-secondary)] hover:text-rose-500"><X className="w-3 h-3" /></button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Program */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={assignTypes.program} onChange={() => toggleAssignType("program")} className="w-3.5 h-3.5 accent-[var(--brand-orange)]" />
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{t("platformMisc.runs.targetProgram")}</span>
                  </label>
                  {assignTypes.program && (
                    <select value={assignProgramId} onChange={(event) => setAssignProgramId(event.target.value)} className="w-full rounded-xl px-3 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                      <option value="">{t("platformMisc.runs.selectProgram")}</option>
                      {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                    </select>
                  )}

                  {/* Other (cohort / team / organization / all) */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={assignTypes.other} onChange={() => toggleAssignType("other")} className="w-3.5 h-3.5 accent-[var(--brand-orange)]" />
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{t("platformMisc.runs.targetOther")}</span>
                  </label>
                  {assignTypes.other && (
                    <div className="flex gap-2 items-center">
                      <select value={assignOtherType} onChange={(event) => setAssignOtherType(event.target.value)} className="w-2/5 rounded-xl px-3 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]">
                        {["cohort", "team", "organization", "all"].map((targetType) => <option key={targetType} value={targetType}>{t(TARGET_LABELS[targetType])}</option>)}
                      </select>
                      <input value={assignOtherId} onChange={(event) => setAssignOtherId(event.target.value)} className="flex-1 rounded-xl px-4 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]" placeholder={t("platformMisc.runs.targetIdPlaceholder")} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2"><button onClick={() => { setShowAssign(false); resetAssignModal(); }} className="flex-1 btn btn-secondary">{t("platformMisc.runs.cancel")}</button><button onClick={handleAssign} disabled={saving} className="flex-1 btn btn-primary">{saving ? t("platformMisc.runs.adding") : t("platformMisc.runs.add")}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
