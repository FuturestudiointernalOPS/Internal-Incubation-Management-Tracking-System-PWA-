"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { defer, settled, createLatestGuard } from "./effectUtils";
import { Skeleton } from "@/components/ui/Skeleton";
import WhyDrawer from "./ui/WhyDrawer";
import PersonScopePanel from "./PersonScopePanel";
import RiskConfirmDialog from "./RiskConfirmDialog";
import { riskyChanges } from "./riskGate";
import { collectContextModules, deriveUserCapState } from "./matrixHelpers";
import PeopleContextsCard from "./people-view/PeopleContextsCard";
import PeopleMatrix from "./people-view/PeopleMatrix";
import PersonIdentityHeader from "./people-view/PersonIdentityHeader";
import AccessSummary from "./people-view/AccessSummaryBand";
import WhyDrawerBody from "./people-view/WhyDrawerBody";
import { summarizeAccess } from "./people-view/accessSummary";
import { SCOPE_POLICIES, SCOPE_POLICY_KEYS } from "@/models/authorization/scope-catalog";

/**
 * PHASE UI-2b — People (access matrix).
 *
 * Answers "what can this person do, and WHY" for every capability the person
 * is actually in scope of: Profile | Group | Grant | Restriction | Effective
 * (+ reason). The screen reads top to bottom in the order an admin asks:
 *
 *   WHO        the identity header (name, role · profile)
 *   HOW MUCH   the access summary (live counts, no stored total)
 *   ON WHAT    contexts and the resolved access scope
 *   WHAT       the permission matrix, by module
 *
 * Editing access stays in the Individual Access editor (mounted under this
 * report); this panel links to it and never invents a verdict the server did
 * not return. The scope panel shows what the Scope Engine currently RESOLVES
 * for the person (read-only verification — nothing is enforced from here).
 *
 * This panel owns the person's reads, the reset when the selection changes and
 * the write path; the presentational blocks live under ./people-view/.
 */
export default function PeopleView({
  person = null,
  onAccessChanged = null,
  // A slot the screen renders right under the identity header (the Phase C
  // profiles registry). Injected rather than imported so this read panel stays
  // free of writes and of the layer that owns them.
  profilesSlot = null,
}) {
  const { t } = useI18n();
  // The screen above owns the selection (PersonPicker); this panel follows it.
  const selected = person;
  const [ctx, setCtx] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [moduleToFeature, setModuleToFeature] = useState({});
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [err, setErr] = useState("");
  // Scope reads: one entry per policy run against the engine's verification
  // endpoint ({ policy, count, ids }). `ids` are the actual records the policy
  // resolves to, which the panel below names via the person's own contexts.
  const [scope, setScope] = useState([]);
  const [scopeBusy, setScopeBusy] = useState(false);
  const [why, setWhy] = useState(null);
  // In-place granting. `busyKey` is scoped to one capability row so a second
  // click elsewhere is still possible; the write itself is server-authoritative.
  const [busyKey, setBusyKey] = useState(null);
  const [actionErr, setActionErr] = useState("");
  // A change about to be applied that the catalog rates high or critical.
  // Confirmed, never blocked (see ./RiskConfirmDialog).
  const [riskGate, setRiskGate] = useState(null);

  const [showContextsDetails, setShowContextsDetails] = useState(false);
  const [showScopeDetails, setShowScopeDetails] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const url = "/api/engineering/permissions";
      const cached = cacheGet(url);
      const data = cached?.success ? await settled(cached) : await (await fetch(url)).json();
      if (data?.success) {
        cacheSet(url, data);
        setCatalog(data.catalog || {});
        setModuleToFeature(data.moduleToFeature || {});
      }
    } catch {
      /* catalog optional */
    }
  }, []);

  useEffect(() => {
    defer(() => loadCatalog());
  }, [loadCatalog]);

  // The report reads two things: the person's access, then what the scope
  // engine resolves for them. Both belong to the person selected when the read
  // STARTED, so a late answer is dropped rather than shown under the next
  // person's name.
  const ctxLoad = useRef(null);
  if (ctxLoad.current == null) {
    ctxLoad.current = createLatestGuard();
  }
  // Scope has its own line of succession: re-reading it (the panel's own
  // control, or a write) must not cancel an access read still on the wire.
  const scopeLoad = useRef(null);
  if (scopeLoad.current == null) {
    scopeLoad.current = createLatestGuard();
  }

  /**
   * What each implemented scope policy resolves for ONE person, right now.
   * Read-only: this is the engine's own verification endpoint (nothing is
   * granted), and the resolved ids come back with the count because a number
   * alone cannot answer "which records?".
   */
  const readScope = useCallback(async (cid) => {
    const implemented = SCOPE_POLICY_KEYS.filter(
      (policyKey) => SCOPE_POLICIES[policyKey]?.implemented,
    );
    return Promise.all(
      implemented.map(async (policy) => {
        try {
          const response = await fetch(
            `/api/engineering/permissions/scope-check?policy=${policy}&cid=${encodeURIComponent(cid)}`,
          );
          const scopeData = await response.json();
          return scopeData.success
            ? { policy, count: scopeData.resolved_count ?? 0, ids: scopeData.resolved_ids || [] }
            : { policy, count: null, ids: [] };
        } catch {
          return { policy, count: null, ids: [] };
        }
      }),
    );
  }, []);

  const pick = useCallback(
    async (user) => {
      setCtx(null);
      setScope([]);
      setErr("");
      setLoadingCtx(true);
      const token = ctxLoad.current.begin();
      const scopeToken = scopeLoad.current.begin();
      try {
        const res = await fetch(
          `/api/engineering/permissions/user-context?cid=${encodeURIComponent(user.cid)}`,
        );
        const data = await res.json();
        if (!ctxLoad.current.isCurrent(token)) return; // a newer person won
        if (!data.success) throw new Error(data.error || "load failed");
        setCtx(data);

        // Scope panel — read-only: what each implemented policy resolves for
        // this person right now (no record id ⇒ nothing is decided).
        const resolved = await readScope(user.cid);
        if (!scopeLoad.current.isCurrent(scopeToken)) return; // a newer person won
        setScope(resolved);
      } catch (error) {
        if (!ctxLoad.current.isCurrent(token)) return;
        setErr(error.message);
      } finally {
        if (ctxLoad.current.isCurrent(token)) setLoadingCtx(false);
      }
    },
    [readScope],
  );

  /** Re-read ONLY the resolved scope of the person on screen. */
  const refreshScope = useCallback(async () => {
    if (!selected?.cid) return;
    const token = scopeLoad.current.begin();
    setScopeBusy(true);
    try {
      const resolved = await readScope(selected.cid);
      if (scopeLoad.current.isCurrent(token)) setScope(resolved);
    } finally {
      if (scopeLoad.current.isCurrent(token)) setScopeBusy(false);
    }
  }, [selected, readScope]);

  /**
   * Run the scope verification for ONE record, for this person. Same read-only
   * endpoint the verification bench uses; the answer is returned to the caller
   * so a failed read stays a failed read rather than becoming a verdict.
   */
  const runScopeCheck = useCallback(
    async (policy, resourceId) => {
      if (!selected?.cid) return null;
      const params = new URLSearchParams({ policy, cid: selected.cid });
      if (resourceId) params.set("resource_id", resourceId);
      const res = await fetch(
        `/api/engineering/permissions/scope-check?${params.toString()}`,
      );
      const data = await res.json();
      return data?.success ? data : null;
    },
    [selected],
  );

  // Follow the selection made above (including the first paint, when a ?cid=
  // deep link resolves inside the picker). Keyed on the cid: the picker may
  // hand over a slim { cid } first and the full record a moment later.
  const lastPickedCid = useRef(null);
  useEffect(() => {
    if (!person) return;
    if (lastPickedCid.current === person.cid) return;
    lastPickedCid.current = person.cid;
    defer(() => pick(person));
  }, [person, pick]);

  /**
   * Re-read ONLY the resolved context after a write. Deliberately not `pick()`:
   * that resets `ctx` to null and refetches scope, which would flash the whole
   * matrix empty on every chip click.
   */
  const refreshCtx = useCallback(async (cid) => {
    const res = await fetch(
      `/api/engineering/permissions/user-context?cid=${encodeURIComponent(cid)}`,
    );
    const data = await res.json();
    if (data?.success) setCtx(data);
  }, []);

  /**
   * Grant / revoke a PERSONAL capability for the selected person.
   * The server is the boundary: it rejects a grant to an ineligible target
   * (403) and applies the merge semantics — so the surface stays unchanged on
   * failure and the reason is shown next to the control that caused it.
   */
  const writeAccess = useCallback(
    async (action, module, capability, accessLevel) => {
      if (!selected?.cid) return;
      setBusyKey(`${module}.${capability}`);
      setActionErr("");
      try {
        const res = await fetch("/api/engineering/permissions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            user_cid: selected.cid,
            module,
            capability,
            access_level: accessLevel,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) {
          throw new Error(data?.error || t("engineering.permissions.saveFailed"));
        }
        await refreshCtx(selected.cid);
        // The "Change access" panel below holds its own copy of the same data;
        // tell the screen so it remounts with this write included rather than
        // showing a stale matrix next to a fresh one.
        if (onAccessChanged) onAccessChanged();
      } catch (error) {
        setActionErr(error.message || t("engineering.permissions.saveFailed"));
      } finally {
        setBusyKey(null);
      }
    },
    [selected, refreshCtx, onAccessChanged, t],
  );

  /**
   * The gate in front of `writeAccess`: a capability the catalog rates high or
   * critical is CONFIRMED, never blocked. `critical` was already colour-coded in
   * the matrix, but nothing said which capability the click was about — and on a
   * list this long, the one red chip among forty is exactly the one that gets
   * mis-clicked. Low and medium writes stay one click: a confirmation nobody
   * reads protects nothing.
   */
  const requestAccess = useCallback(
    (action, module, capability, accessLevel) => {
      const risky = riskyChanges([{ module, capability }]);
      if (risky.length > 0) {
        setRiskGate({
          action,
          module,
          capability,
          accessLevel,
          risky,
        });
        return;
      }
      writeAccess(action, module, capability, accessLevel);
    },
    [writeAccess],
  );

  const modules = useMemo(() => {
    if (!ctx) return [];
    return collectContextModules(ctx.sources).map((module) => ({
      module,
      feature: moduleToFeature[module] || "—",
      locked: Boolean(catalog?.[module]?.locked),
      caps: Object.keys(catalog?.[module]?.capabilities || {}).sort(),
    }));
  }, [ctx, catalog, moduleToFeature]);

  // Eligibility is the OUTER gate, mirroring authorize(): a feature-mapped
  // module is allowed only when its feature is explicitly eligible. Super Admin
  // bypasses eligibility entirely, and infra modules without a feature mapping
  // are not eligibility-bound.
  const eligibleFor = useCallback(
    (module) => {
      if (ctx?.isSuperAdmin) return true;
      const feature = moduleToFeature[module];
      if (!feature) return true;
      return ctx?.eligibility?.[feature] === true;
    },
    [ctx, moduleToFeature],
  );

  const summary = useMemo(() => {
    if (!ctx) return null;
    return summarizeAccess({
      sources: ctx.sources,
      modules,
      eligibleFor,
      deriveState: (module, capability, eligible) =>
        deriveUserCapState(ctx.sources, module, capability, eligible),
      scope,
    });
  }, [ctx, modules, eligibleFor, scope]);

  const hasContexts = (ctx?.contexts || []).length > 0;
  const hasContextsUnavailable = (ctx?.contextsUnavailable || []).length > 0;

  return (
    <div className="space-y-6">
      {!selected && (
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          {t("authorization.people.selectPrompt")}
        </p>
      )}

      {err && (
        <div className="space-y-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-xs font-semibold text-red-400">
            {t("engineering.permissions.peopleReportLoadFailed")}
          </p>
          <p className="break-words text-xs font-medium text-[var(--text-secondary)]">
            {err}
          </p>
          <button
            type="button"
            onClick={() => selected && pick(selected)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {t("common.refresh")}
          </button>
        </div>
      )}

      {loadingCtx && (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      )}

      {selected && !loadingCtx && ctx && (
        <div className="space-y-8">
          <PersonIdentityHeader
            t={t}
            person={selected}
            ctx={ctx}
            profilesSlot={profilesSlot}
          />

          <AccessSummary t={t} summary={summary} />

          {/* Effective access — the matrix, by module. */}
          <section
            id="person-section-permissions"
            aria-labelledby="people-matrix-title"
            className="scroll-mt-24 space-y-4"
          >
            <div className="space-y-1">
              <h2
                id="people-matrix-title"
                className="text-base font-semibold text-[var(--text-primary)]"
              >
                {t("authorization.people.sections.capabilitiesMatrix")}
              </h2>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {t("authorization.people.sections.capabilitiesMatrixDescription")}
              </p>
            </div>

            <PeopleMatrix
              t={t}
              ctx={ctx}
              modules={modules}
              eligibleFor={eligibleFor}
              busyKey={busyKey}
              actionErr={actionErr}
              onGrant={requestAccess}
              onOpenWhy={setWhy}
            />
          </section>

          {/* What determines access — contexts and scope, read-only. */}
          <section
            id="person-section-scope"
            aria-labelledby="people-read-title"
            className="scroll-mt-24 space-y-5"
          >
            <div className="space-y-1">
              <h2
                id="people-read-title"
                className="text-base font-semibold text-[var(--text-primary)]"
              >
                {t("authorization.people.sections.readAccess")}
              </h2>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {t("authorization.people.sections.readAccessDescription")}
              </p>
            </div>

            {/* Contexts */}
            <div className="space-y-3 border-b border-divider/60 pb-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {t("authorization.people.contexts.title")}
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    {t("authorization.people.contexts.description")}
                  </p>
                </div>
                {(hasContexts || hasContextsUnavailable) && (
                  <button
                    type="button"
                    onClick={() => setShowContextsDetails((prev) => !prev)}
                    aria-expanded={showContextsDetails}
                    aria-controls="people-contexts-details"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                  >
                    {showContextsDetails ? (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {showContextsDetails
                      ? t("authorization.people.contexts.hideDetails")
                      : t("authorization.people.contexts.showDetails")}
                  </button>
                )}
              </div>

              {!hasContexts && !hasContextsUnavailable && (
                <p className="text-sm text-[var(--text-secondary)]">
                  {t("authorization.people.contexts.none")}
                </p>
              )}

              <div
                id="people-contexts-details"
                hidden={!showContextsDetails}
                className="space-y-3"
              >
                <PeopleContextsCard
                  t={t}
                  contexts={ctx.contexts || []}
                  contextsUnavailable={ctx.contextsUnavailable || []}
                />
              </div>

              {!showContextsDetails && (hasContexts || hasContextsUnavailable) && (
                <p className="text-sm text-[var(--text-secondary)]">
                  {hasContexts
                    ? `${ctx.contexts.length} ${t(
                        "authorization.people.contexts.title",
                      ).toLowerCase()}`
                    : t("authorization.people.contexts.unavailable")}
                </p>
              )}
            </div>

            {/* Scope */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {t("authorization.people.scope.title")}
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    {t("authorization.people.scope.description")}
                  </p>
                </div>
                {scope.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowScopeDetails((prev) => !prev)}
                    aria-expanded={showScopeDetails}
                    aria-controls="people-scope-details"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
                  >
                    {showScopeDetails ? (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {showScopeDetails
                      ? t("authorization.people.scope.hideDetails")
                      : t("authorization.people.scope.showDetails")}
                  </button>
                )}
              </div>

              <div
                id="people-scope-details"
                hidden={!showScopeDetails}
                className="space-y-3"
              >
                <PersonScopePanel
                  key={`scope-${selected.cid}`}
                  policies={scope}
                  contexts={ctx.contexts || []}
                  checkPolicy={runScopeCheck}
                  onRefresh={refreshScope}
                  refreshing={scopeBusy}
                />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Why drawer */}
      {why && (
        <WhyDrawer
          title={t("engineering.permissions.whyDrawerTitle")}
          onClose={() => setWhy(null)}
        >
          <WhyDrawerBody
            t={t}
            why={why}
            eligibility={ctx?.eligibility}
            moduleToFeature={moduleToFeature}
          />
        </WhyDrawer>
      )}

      {/* Critical/high-risk confirmation — the write is applied on confirm. */}
      <RiskConfirmDialog
        open={Boolean(riskGate)}
        changes={riskGate?.risky || []}
        subject={selected?.name || selected?.cid || ""}
        onCancel={() => setRiskGate(null)}
        onConfirm={() => {
          const gate = riskGate;
          setRiskGate(null);
          if (gate) {
            writeAccess(gate.action, gate.module, gate.capability, gate.accessLevel);
          }
        }}
      />
    </div>
  );
}
