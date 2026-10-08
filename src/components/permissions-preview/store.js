"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SCOPE_POLICIES } from "@/models/authorization/scope-catalog";
import { deriveMembershipStatus } from "@/lib/membership-ui";
import { featureLabel } from "./constants";

/**
 * CHARGEUR DE DONNÉES RÉELLES du Centre de permissions.
 *
 * Aucune donnée n'est inventée : tout vient des endpoints existants, et les
 * actions écrivent là où le centre en production écrit. Le provider assemble le
 * tout une fois, expose un `refresh()`, et donne aux écrans les mêmes formes
 * pratiques que la maquette (fonctionnalités, personnes, profils, plafonds…).
 */

const URLS = {
  definition: "/api/engineering/permissions",
  users: "/api/engineering/permissions?users=true",
  eligibility: "/api/engineering/permissions/eligibility",
  profiles: "/api/engineering/permissions/profiles",
  contextRoles: "/api/engineering/permissions/context-roles",
  audit: "/api/engineering/permissions/audit?page=1&pageSize=200",
  responsibilities: "/api/responsibilities",
  memberships: "/api/org-membership",
};

const PermContext = createContext(null);
export const usePerm = () => useContext(PermContext);

const json = (url, options) => fetch(url, options).then((response) => response.json());

const pick = (settled) => (settled.status === "fulfilled" && settled.value?.success ? settled.value : null);

function buildFeatures(modules, moduleToFeature, featureOrder) {
  const byFeature = new Map();
  for (const [key, def] of Object.entries(modules || {})) {
    const feature = moduleToFeature?.[key] || key;
    if (!byFeature.has(feature)) byFeature.set(feature, []);
    byFeature.get(feature).push({ key, label: def.name || key, caps: def.capabilities || [], feature, featureLabel: featureLabel(feature) });
  }
  const order = featureOrder?.length ? featureOrder.filter((key) => byFeature.has(key)) : Array.from(byFeature.keys());
  const missing = Array.from(byFeature.keys()).filter((key) => !order.includes(key));
  return [...order, ...missing].map((key) => ({ key, label: featureLabel(key), modules: byFeature.get(key) }));
}

export function PermissionsProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    error: "",
    blocked: false,
    modules: {},
    moduleIndex: {},
    moduleToFeature: {},
    features: [],
    catalogue: {},
    groupDefaults: [],
    people: [],
    peopleById: {},
    eligibility: {},
    eligibilityIdentities: [],
    eligibilityExtra: [],
    eligibilityGroups: [],
    eligibilityProfiles: [],
    identityGroups: {},
    canConfigure: false,
    profiles: [],
    profileModules: {},
    profileContexts: [],
    roleDefaults: {},
    contextRoles: [],
    contextRoleContexts: [],
    contextRoleProfiles: [],
    audit: [],
    auditTotal: 0,
    responsibilities: [],
    roleChoices: [],
    scopePolicies: SCOPE_POLICIES,
    alerts: { deadRights: [], pending: [], missingProfiles: [], expiring: [] },
  });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [definition, users, eligibility, profilesRes, contextRolesRes, auditRes, responsibilitiesRes, membershipsRes] =
          await Promise.allSettled([
            json(URLS.definition),
            json(URLS.users),
            json(URLS.eligibility),
            json(URLS.profiles),
            json(URLS.contextRoles),
            json(URLS.audit),
            json(URLS.responsibilities),
            json(URLS.memberships),
          ]);

        const def = pick(definition);
        const userList = pick(users);
        const elig = pick(eligibility);
        const profiles = pick(profilesRes);
        const contextRoles = pick(contextRolesRes);
        const audit = pick(auditRes);
        const responsibilities = pick(responsibilitiesRes);
        const memberships = pick(membershipsRes);

        // A 403 on any of the core reads means the caller may not see the center.
        const anyCoreDenied =
          [definition, users, eligibility, profilesRes].some((settled) => settled.status === "fulfilled" && settled.value?.success === false);

        if (!def || !elig) {
          if (!alive) return;
          setState((prev) => ({ ...prev, loading: false, error: "Impossible de charger le centre de permissions.", blocked: anyCoreDenied }));
          return;
        }

        const moduleToFeature = elig.moduleToFeature || {};
        const features = buildFeatures(def.modules, moduleToFeature, elig.features);
        const moduleIndex = {};
        for (const feature of features) {
          for (const mod of feature.modules) moduleIndex[mod.key] = { ...mod, featureLabel: feature.label };
        }

        // Plafonds : identité → valeur → fonctionnalité → E/D.
        const eligibilityMap = {};
        for (const row of elig.rows || []) {
          eligibilityMap[row.identity_type] ??= {};
          eligibilityMap[row.identity_type][row.identity_value] ??= {};
          eligibilityMap[row.identity_type][row.identity_value][row.feature_key] = Number(row.eligible) === 1 ? "E" : "D";
        }

        // Profils : capacités par clé (une lecture par profil, en parallèle).
        const profileRows = profiles?.profiles || [];
        const capResults = await Promise.allSettled(
          profileRows.map((profile) => json(`${URLS.profiles}?key=${encodeURIComponent(profile.key)}`)),
        );
        const capsByKey = {};
        capResults.forEach((settled, index) => {
          const row = profileRows[index];
          const payload = pick(settled);
          capsByKey[row.key] = payload?.profile?.capabilities || {};
        });

        // Personnes : la liste, puis le détail de chacune (sources + plafonds).
        const rawUsers = userList?.users || [];
        const detailResults = await Promise.allSettled(
          rawUsers.map((user) => json(`${URLS.definition}?user_cid=${encodeURIComponent(user.cid)}`)),
        );
        const peopleById = {};
        const people = rawUsers.map((user, index) => {
          const detail = pick(detailResults[index]);
          const sources = detail?.explanation?.sources || { profile: {}, groups: {}, grants: {}, restrictions: {} };
          const eligibilityForPerson = {};
          for (const [feature, info] of Object.entries(detail?.explanation?.eligibility || {})) {
            eligibilityForPerson[feature] = Boolean(info?.eligible);
          }
          const person = {
            id: user.cid,
            name: user.name || user.cid,
            email: user.email || "",
            role: user.role,
            roleLabel: user.role,
            profile: user.access_profile?.name || user.profile_key || "—",
            profileKey: user.profile_key || null,
            group: (user.groups || [])[0] || "—",
            groups: user.groups || [],
            isSuperAdmin: user.role === "super_admin",
            sources,
            eligibility: eligibilityForPerson,
            responsibilities: (user.responsibilities || []).map((row) => row.name),
            effectivePermissions: detail?.effectivePermissions || {},
          };
          peopleById[user.cid] = person;
          return person;
        });

        const contextRolesNormalized = (contextRoles?.roles || []).map((row) => ({
          context: row.context,
          role: row.role_key,
          profileKey: row.profile_key,
          profileName: row.profile_name,
          active: Number(row.is_active) === 1,
          holders: row.holders,
        }));

        const auditEntries = (audit?.entries || []).map((entry) => {
          const details = entry.details || "";
          const reasonMatch = /Reason:\s*(.+)$/.exec(details);
          return {
            id: entry.id,
            date: entry.created_at,
            actor: entry.actor_name || entry.actor_cid || "—",
            target: entry.target_name || entry.target_cid || "—",
            targetCid: entry.target_cid || null,
            action: entry.action,
            module: entry.module,
            capability: entry.capability,
            from: entry.previous_value ?? "—",
            to: entry.new_value ?? "—",
            reason: reasonMatch ? reasonMatch[1] : details,
          };
        });

        const profilesNormalized = profileRows.map((row) => ({
          key: row.key,
          label: row.label || row.key,
          context: row.context,
          allowedRoles: row.allowed_roles || [],
          active: Number(row.is_active) === 1,
          capabilityCount: row.capability_count ?? 0,
          capabilities: capsByKey[row.key] || {},
        }));

        const roleDefaults = profiles?.role_defaults || {};
        const profileContexts = profiles?.contexts || [];

        const responsibilitiesNormalized = (responsibilities?.responsibilities || []).map((row) => ({
          id: row.id,
          key: row.key,
          name: row.name,
          description: row.description,
          roles: row.allowed_roles || [],
        }));

        // Alertes de santé, dérivées des mêmes données réelles.
        const deadRights = [];
        for (const profile of profilesNormalized) {
          for (const [moduleKey, caps] of Object.entries(profile.capabilities)) {
            const feature = moduleToFeature[moduleKey];
            if (!feature) continue;
            const ceiling = eligibilityMap.profile?.[profile.key]?.[feature];
            if (ceiling !== "E" && Object.keys(caps).length > 0) {
              deadRights.push({ profile: profile.label, feature: featureLabel(feature), people: 0 });
            }
          }
        }
        const membershipRows = memberships?.memberships || [];
        const expiring = membershipRows.filter((row) => deriveMembershipStatus(row) === "expiringSoon");

        if (!alive) return;
        setState({
          loading: false,
          error: "",
          blocked: false,
          modules: def.modules || {},
          moduleIndex,
          moduleToFeature,
          features,
          catalogue: def.catalog || {},
          groupDefaults: def.groupDefaults || [],
          people,
          peopleById,
          eligibility: eligibilityMap,
          eligibilityIdentities: [...(elig.roles || []), ...(elig.extraRoles || [])],
          eligibilityExtra: elig.extraRoles || [],
          eligibilityGroups: elig.groups || [],
          eligibilityProfiles: elig.profiles || [],
          identityGroups: elig.identityGroups || {},
          canConfigure: Boolean(elig.canConfigure),
          profiles: profilesNormalized,
          profileModules: profiles?.modules || {},
          profileContexts,
          roleDefaults,
          contextRoles: contextRolesNormalized,
          contextRoleContexts: contextRoles?.contexts || [],
          contextRoleProfiles: contextRoles?.profiles || [],
          audit: auditEntries,
          auditTotal: audit?.total ?? auditEntries.length,
          responsibilities: responsibilitiesNormalized,
          roleChoices: elig.roles || [],
          scopePolicies: SCOPE_POLICIES,
          alerts: {
            deadRights,
            pending: SCOPE_POLICIES.filter((policy) => !policy.implemented),
            missingProfiles: contextRolesNormalized.filter((row) => !row.profileKey),
            expiring,
          },
        });
      } catch (error) {
        if (alive) setState((prev) => ({ ...prev, loading: false, error: error.message || "Erreur de chargement", blocked: false }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  const actions = useMemo(() => {
    const put = (url, body, method = "PUT") =>
      json(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    return {
      refresh,
      setCapability: (cid, action, module, capability, accessLevel) =>
        put(URLS.definition, { action, user_cid: cid, module, capability, access_level: accessLevel }).then((data) => {
          if (data?.success) refresh();
          return data;
        }),
      superAdmin: (cid, action) =>
        put(URLS.definition, { action, user_cid: cid }).then((data) => {
          if (data?.success) refresh();
          return data;
        }),
      forceProfile: (cid, profileKey) =>
        put("/api/engineering/permissions/profile-override", { user_cid: cid, profile_key: profileKey || null }).then((data) => {
          if (data?.success) refresh();
          return data;
        }),
      saveEligibility: (changes, confirm) =>
        put(URLS.eligibility, { changes, confirm }).then((data) => {
          if (data?.success) refresh();
          return data;
        }),
      saveProfile: (payload) => put(URLS.profiles, payload).then((data) => {
        if (data?.success) refresh();
        return data;
      }),
      deleteProfile: (key) =>
        json(`${URLS.profiles}?key=${encodeURIComponent(key)}`, { method: "DELETE" }).then((data) => {
          if (data?.success) refresh();
          return data;
        }),
      saveContextRole: (payload) => put(URLS.contextRoles, payload).then((data) => {
        if (data?.success) refresh();
        return data;
      }),
      saveResponsibilityAccess: (id, roles) =>
        put("/api/responsibilities/access", { id, allowed_roles: roles }).then((data) => {
          if (data?.success) refresh();
          return data;
        }),
      rederive: () => json("/api/engineering/permissions/sync-context-grants").then((data) => data),
      scopeCheck: (policy, cid, resourceId) => {
        const params = new URLSearchParams({ policy, cid });
        if (resourceId) params.set("resource_id", resourceId);
        return json(`/api/engineering/permissions/scope-check?${params.toString()}`);
      },
    };
  }, [refresh]);

  const value = useMemo(() => ({ ...state, actions }), [state, actions]);
  return <PermContext.Provider value={value}>{children}</PermContext.Provider>;
}
