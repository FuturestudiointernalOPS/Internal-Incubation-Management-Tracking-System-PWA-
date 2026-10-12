"use client";

/**
 * Permission Centre — the ONE read the whole prototype stands on.
 *
 * Everything the four sections need is loaded here, once, and handed to them
 * as a bundle: the registry, the access profiles WITH their capabilities (the
 * Profiles matrix and the dead-rights alerts are built from them), the
 * catalog, the eligibility ceiling, the contextual-role registry, the
 * responsibility catalogue and the head of the audit trail.
 *
 * Reads only. Every write stays in the screen that offers it and calls back
 * through `refresh(part)`, which re-reads ONLY the part that changed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeAlerts, journalKpis } from "./prototypeAlerts";
import { buildEligibilityMatrix } from "./personAccess";

const AUDIT_PAGE_SIZE = 100;

async function getJson(url) {
  const response = await fetch(url);
  return response.json();
}

/** The empty bundle — every screen renders its empty state from this shape. */
const EMPTY = {
  contacts: [],
  profiles: [],
  profileCapsById: {},
  roleDefaults: {},
  catalog: {},
  groupDefaults: [],
  moduleToFeature: {},
  features: [],
  eligibility: null,
  eligibilityMatrix: {},
  canConfigure: false,
  contextRoles: [],
  contextRoleProfiles: [],
  audit: [],
  auditTotal: 0,
  responsibilities: [],
};

export default function usePrototypeData() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Merge a partial read into the bundle. */
  const patch = useCallback(async (partial) => {
    if (!alive.current) return;
    setData((current) => ({ ...current, ...partial }));
    setError("");
  }, []);

  /**
   * Re-read one part (or everything). The profile read is special: the list
   * and every profile's capabilities travel together, because a profile
   * without its capabilities is not a row of the matrix.
   */
  const refresh = useCallback(
    async (part = "all") => {
      const reads = [];
      if (part === "all" || part === "contacts") {
        reads.push(
          getJson("/api/contacts").then((result) =>
            patch({ contacts: result?.success ? result.contacts || [] : [] }),
          ),
        );
      }
      if (part === "all" || part === "profiles") {
        reads.push(
          getJson("/api/engineering/permissions/profiles").then(async (result) => {
            const profiles = (result?.profiles || []).map((profile) => ({
              ...profile,
              // The catalogue names a profile by KEY and LABEL; every screen
              // below reads one display name.
              name: profile.label || profile.key,
            }));
            const caps = await Promise.all(
              profiles.map((profile) =>
                getJson(
                  `/api/engineering/permissions/profiles?key=${encodeURIComponent(profile.key)}`,
                ).catch(() => null),
              ),
            );
            const profileCapsById = {};
            profiles.forEach((profile, index) => {
              const single = caps[index];
              if (single?.success) {
                profileCapsById[profile.key] = single.profile?.capabilities || {};
              }
            });
            // role_defaults is role → profile KEY; the screens want the name too.
            const byKey = Object.fromEntries(profiles.map((profile) => [profile.key, profile]));
            const roleDefaults = {};
            for (const [role, key] of Object.entries(result?.role_defaults || {})) {
              roleDefaults[role] = {
                profileKey: key,
                profileName: byKey[key]?.name || key,
              };
            }
            patch({ profiles, profileCapsById, roleDefaults });
          }),
        );
      }
      if (part === "all" || part === "catalog") {
        reads.push(
          getJson("/api/engineering/permissions").then((result) =>
            patch({
              catalog: result?.success ? result.catalog || {} : {},
              groupDefaults: result?.success ? result.groupDefaults || [] : [],
            }),
          ),
        );
      }
      if (part === "all" || part === "eligibility") {
        reads.push(
          getJson("/api/engineering/permissions/eligibility").then((result) =>
            patch({
              eligibility: result?.success ? result : null,
              moduleToFeature: result?.moduleToFeature || {},
              features: result?.features || [],
              eligibilityMatrix: buildEligibilityMatrix(result?.rows || []),
              canConfigure: Boolean(result?.canConfigure),
            }),
          ),
        );
      }
      if (part === "all" || part === "contextRoles") {
        reads.push(
          getJson("/api/engineering/permissions/context-roles").then((result) =>
            patch({
              contextRoles: result?.success ? result.roles || [] : [],
              contextRoleProfiles: result?.success ? result.profiles || [] : [],
            }),
          ),
        );
      }
      if (part === "all" || part === "audit") {
        reads.push(
          getJson(`/api/engineering/permissions/audit?page=1&pageSize=${AUDIT_PAGE_SIZE}`).then(
            (result) =>
              patch({
                audit: result?.success ? result.entries || [] : [],
                auditTotal: result?.success ? result.total || 0 : 0,
              }),
          ),
        );
      }
      if (part === "all" || part === "responsibilities") {
        reads.push(
          getJson("/api/responsibilities").then((result) =>
            patch({ responsibilities: result?.success ? result.responsibilities || [] : [] }),
          ),
        );
      }
      try {
        await Promise.all(reads);
      } catch (caught) {
        if (alive.current) setError(caught?.message || "load failed");
      } finally {
        if (alive.current) setLoading(false);
      }
    },
    [patch],
  );

  useEffect(() => {
    refresh("all");
  }, [refresh]);

  const health = useMemo(() => computeAlerts(data), [data]);
  const kpis = useMemo(() => journalKpis(data), [data]);

  return {
    loading,
    error,
    ...data,
    alerts: health.alerts,
    badges: health.badges,
    kpis,
    refresh,
  };
}
