import {
  AlertTriangle,
  Briefcase,
} from "lucide-react";
import { isResponsibilityBlockedForRole } from "@/lib/featureAccess";

export default function AssignmentsCard({ userData, t }) {
  return (
    <>
      <div className="ios-card !p-5 border-[var(--border-primary)]">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-4 h-4 text-[var(--brand-orange)]" />
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {t("adminMisc.access.assignments")}
          </h3>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-orange/10 text-[var(--brand-orange)]">
            {(userData.assignments || []).length}
          </span>
        </div>
        {(userData.assignments || []).length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">{t("adminMisc.access.noAssignments")}</p>
        ) : (
          <div className="space-y-2">
            {(userData.assignments || []).map((assignment, index) => {
              let scopeLabel = "";
              try {
                const scope = typeof assignment.scope === "string" ? JSON.parse(assignment.scope) : assignment.scope;
                if (scope?.type === "program") scopeLabel = "Program";
                else if (scope?.type === "groups") scopeLabel = `Groups (${(scope.groupIds || []).length})`;
                else if (scope?.type === "individuals") scopeLabel = `Individuals (${(scope.cids || []).length})`;
              } catch (_) {}
              const isCurrent = assignment.is_current !== false;
              return (
                <div
                  key={index}
                  className={`rounded-xl border p-3 ${
                    isCurrent
                      ? "border-brand-orange/20 bg-brand-orange/[0.03]"
                      : "border-[var(--border-primary)] bg-tertiary/40 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                      {assignment.title || assignment.role}
                    </p>
                    {isCurrent ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 uppercase">
                        Current
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-[var(--text-secondary)] uppercase">
                        Ended
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {assignment.context_type} · {assignment.context_id || "global"}
                      {scopeLabel ? ` · ${scopeLabel}` : ""}
                    </p>
                    {assignment.status && (
                      <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                        Status: {assignment.status}
                      </p>
                    )}
                    {(assignment.capability_overrides || assignment.permissions) &&
                      typeof (assignment.capability_overrides || assignment.permissions) === "object" &&
                      Object.keys(assignment.capability_overrides || assignment.permissions).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {Object.keys(assignment.capability_overrides || assignment.permissions).map((capability) => (
                            <span
                              key={capability}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase"
                            >
                              {capability.replace(/\./g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    {(() => {
                      const blockedFeatures = (userData.responsibilities || [])
                        .filter((responsibility) => isResponsibilityBlockedForRole(assignment.role, responsibility.key, responsibility.allowed_roles))
                        .map((responsibility) => responsibility.name);
                      if (blockedFeatures.length === 0) return null;
                      return (
                        <p className="flex items-start gap-1 text-sm font-bold text-amber-400 pt-1">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span>
                            {t("adminMisc.access.assignmentRoleWarning", {
                              role: assignment.role,
                              features: blockedFeatures.join(", "),
                            })}
                          </span>
                        </p>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}