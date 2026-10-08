"use client";

import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  fetchActiveGroupRegistrationRun,
  updateFamilyDefaultRole,
} from "./programEdits";

/** Assigned student groups (families) grid plus the "create new group" toggle. */
export default function TargetGroupsSection({
  editingProgram,
  setEditingProgram,
  notes,
  setNotes,
  userRole,
  isCreatingGroup,
  setIsCreatingGroup,
  setNewGroup,
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 bg-primary rounded-2xl border border-[var(--border-primary)]">
        {(Array.isArray(notes) ? notes : []).map((family) => {
          if (!family) return null;
          const assignedSegments = Array.isArray(
            editingProgram?.assigned_segments,
          )
            ? editingProgram.assigned_segments
            : [];
          const isActive = assignedSegments.some(
            (sid) => String(sid) === String(family.id),
          );
          const canEditRole = userRole === "super_admin";
          return (
            <div
              key={family.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                isActive
                  ? "bg-brand-orange/10 border-[var(--brand-orange)] text-[var(--brand-orange)]"
                  : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  const next = isActive
                    ? assignedSegments.filter(
                        (sid) => String(sid) !== String(family.id),
                      )
                    : [...assignedSegments, family.id];
                  setEditingProgram({
                    ...editingProgram,
                    assigned_segments: next,
                  });
                }}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <Users
                  className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isActive ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)]"}`}
                />
                <div className="flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase truncate">
                      {family.name || t("adminMisc.programs.unnamed")}
                    </span>
                    {isActive && family.default_role && !canEditRole && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 uppercase shrink-0">
                        {family.default_role}
                      </span>
                    )}
                  </div>
                  {isActive && (
                    <span
                      className="text-[10px] font-medium text-emerald-400/80 hover:text-emerald-400 truncate mt-0.5"
                      title={t(
                        "adminMisc.programs.clickToCopyRegistrationLink",
                      )}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const regId = family.registration_id || family.id;
                        try {
                          const run =
                            await fetchActiveGroupRegistrationRun(regId);
                          if (run) {
                            navigator.clipboard.writeText(
                              `${window.location.origin}/s/${run.public_slug}`,
                            );
                            window.dispatchEvent(
                              new CustomEvent("impactos:notify", {
                                detail: {
                                  type: "success",
                                  message: t("admin.copied"),
                                },
                              }),
                            );
                          } else {
                            window.dispatchEvent(
                              new CustomEvent("impactos:notify", {
                                detail: {
                                  type: "error",
                                  message: t("adminMisc.programs.noFormYet"),
                                },
                              }),
                            );
                          }
                        } catch (_) {
                          window.dispatchEvent(
                            new CustomEvent("impactos:notify", {
                              detail: {
                                type: "error",
                                message: t("adminMisc.programs.noFormYet"),
                              },
                            }),
                          );
                        }
                      }}
                    >
                      {t("admin.copyLink")}
                    </span>
                  )}
                </div>
              </button>
              {isActive && family.default_role && canEditRole && (
                <select
                  value={family.default_role}
                  onChange={async (e) => {
                    const newRole = e.target.value || null;
                    try {
                      const payload = await updateFamilyDefaultRole(
                        family.id,
                        newRole,
                      );
                      if (payload.success) {
                        setNotes(
                          (Array.isArray(notes) ? notes : []).map((n) =>
                            String(n.id) === String(family.id)
                              ? { ...n, default_role: newRole }
                              : n,
                          ),
                        );
                        window.dispatchEvent(
                          new CustomEvent("impactos:notify", {
                            detail: {
                              type: "success",
                              message: t("adminMisc.programs.roleUpdated"),
                            },
                          }),
                        );
                      } else {
                        window.dispatchEvent(
                          new CustomEvent("impactos:notify", {
                            detail: {
                              type: "error",
                              message: t(
                                "adminMisc.programs.roleUpdateFailed",
                              ),
                            },
                          }),
                        );
                      }
                    } catch (_) {
                      window.dispatchEvent(
                        new CustomEvent("impactos:notify", {
                          detail: {
                            type: "error",
                            message: t("adminMisc.programs.roleUpdateFailed"),
                          },
                        }),
                      );
                    }
                  }}
                  className="text-[10px] font-bold px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 uppercase outline-none border-none cursor-pointer hover:bg-purple-500/30 shrink-0"
                >
                  <option value={family.default_role}>
                    {family.default_role}
                  </option>
                  <option value="">{t("adminMisc.programs.roleNone")}</option>
                  <option value="participant">
                    {t("adminMisc.programs.roleParticipant")}
                  </option>
                  <option value="staff">
                    {t("adminMisc.programs.roleStaff")}
                  </option>
                  <option value="program_manager">
                    {t("adminMisc.programs.roleProgramManager")}
                  </option>
                  <option value="mentor">
                    {t("adminMisc.programs.roleMentor")}
                  </option>
                  <option value="investor">
                    {t("adminMisc.programs.roleInvestor")}
                  </option>
                  <option value="founder">
                    {t("adminMisc.programs.roleFounder")}
                  </option>
                </select>
              )}
            </div>
          );
        })}
      </div>

      {/* Create group toggle */}
      <div className="flex items-center justify-between mt-3">
        <button
          type="button"
          onClick={() => {
            setIsCreatingGroup(!isCreatingGroup);
            if (!isCreatingGroup && editingProgram?.name) {
              setNewGroup({
                name: editingProgram.name,
                description: "",
                type: "cohort",
                default_role: "",
              });
            }
          }}
          className="text-[10px] font-bold uppercase tracking-wide text-blue-400 hover:underline"
        >
          {isCreatingGroup
            ? t?.("common.cancel") || "Cancel"
            : t?.("admin.createNewGroup") || "+ Create New Group"}
        </button>
      </div>
    </>
  );
}
