"use client";

/**
 * ACCESS PROFILES VIEW — extracted from `PermissionCenter.js`.
 *
 * The profile editor: build the whole module catalogue, narrow it ONLY when the
 * profile is role-bound, and let a role-less profile fall through to every
 * section. That distinction is the whole point of the screen — the original
 * defect applied `filterSectionsByRoleEligibility` unconditionally, which
 * returned `[]` for a profile with no role, so a role-less profile looked empty.
 * A role binding must constrain the editor, never gate it.
 *
 * Also hosts the impact preview (the real `/impact` endpoint, never a client-side
 * guess), the role-default editor, and `PendingChangesList`.
 *
 * `buildEditableModules` is NOT here: the shell and this view both consume it,
 * so it went to `../shared/`. `capsToObject` IS here, because `selectProfile`
 * memoises its own identity and a helper rebuilt per render would defeat it.
 *
 * Split out verbatim, behaviour identical. The extraction asserts that all seven
 * original defects the UI guards forbid are still absent, and that the audit
 * ACTION vocabulary following in the shim stays with `AuditView`.
 *
 * Since the factory/blocks split: the five write concerns live in
 * `profiles/actions/`, the five markup blocks in `profiles/`, and this file
 * keeps the state, the reads, both loaders, the effects and the early return.
 */

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { defer } from "@/components/permissions/effectUtils";
import { useDialogs } from "@/components/ui/DialogProvider";
import {
  cacheGet,
  cacheSet,
} from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { Plus } from "lucide-react";
import buildEditableModules from "@/components/permissions/permission-center/shared/buildEditableModules";
import ProfileNotices from "@/components/permissions/permission-center/profiles/ProfileNotices";
import ProfileDialogs from "@/components/permissions/permission-center/profiles/ProfileDialogs";
import ProfileCreateForm from "@/components/permissions/permission-center/profiles/ProfileCreateForm";
import ProfilePicker from "@/components/permissions/permission-center/profiles/ProfilePicker";
import ProfileDetail from "@/components/permissions/permission-center/profiles/ProfileDetail";
import { profileSelection } from "@/components/permissions/permission-center/profiles/actions/profileSelection";
import { profileList } from "@/components/permissions/permission-center/profiles/actions/profileList";
import { roleDefaultWrites } from "@/components/permissions/permission-center/profiles/actions/roleDefaults";
import { capsDraft } from "@/components/permissions/permission-center/profiles/actions/capsDraft";
import { catalogSections } from "@/components/permissions/permission-center/profiles/actions/catalogSections";

/**
 * The capability rows a profile carries, keyed by module then capability. Pure,
 * so it lives at module scope: `selectProfile` memoises its own identity, and a
 * helper captured from the component body would change on every render and
 * defeat that memoisation.
 */
function capsToObject(rows) {
  const capsByModule = {};
  for (const row of rows || []) {
    capsByModule[row.module] ??= {};
    capsByModule[row.module][row.capability] = Number(row.access_level);
  }
  return capsByModule;
}

export default function AccessProfilesView({ initialProfileId = null }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const [profiles, setProfiles] = useState([]);
  const [roleDefaults, setRoleDefaults] = useState({});
  const [allRoles, setAllRoles] = useState([]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [eligibilityRows, setEligibilityRows] = useState([]); // feature_eligibility rows for role-based filtering
  const [moduleToFeature, setModuleToFeature] = useState({}); // capability module → feature key
  const [featureKeys, setFeatureKeys] = useState([]); // canonical feature order (eligibility API)
  // The capability catalog (PERMISSION_MODULES) as served by /api/access-profiles
  // — the SAME definition the access-profile writes are validated against. Held
  // in state: the editor used to read a `window` global and fall back to a
  // hardcoded 11-module copy of an 18-module catalog, so it showed fewer
  // modules, two renamed ones and a missing capability.
  const [moduleCatalog, setModuleCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [, setProfileCaps] = useState([]);
  const [actionMsg, setActionMsg] = useState("");
  const [actionError, setActionError] = useState("");
  // { role, violations:[{module,capability,feature}] } — set when the server
  // refuses a save against the eligibility ceiling. Rendered explicitly: the
  // generic "not eligible" message alone left the administrator unable to tell
  // WHICH identity blocked the save (that is how a retired `admin` role silently
  // blocked every save of Staff Default).
  const [saveViolations, setSaveViolations] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: "", description: "" });
  const [safetyAck, setSafetyAck] = useState(false); // confirmed role-bound profile edits
  const [pendingSaveConfirm, setPendingSaveConfirm] = useState(null); // roles[] when saving changes to a role-default profile
  const [draftCaps, setDraftCaps] = useState({}); // working copy {module:{capability:level}}
  const [savedCaps, setSavedCaps] = useState({}); // last-saved state for change detection
  const [saving, setSaving] = useState(false);
  const [renameMode, setRenameMode] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  // UI-2c — review-before-save: an optional audit reason and the number of
  // users this profile currently reaches (real count, from the impact API).
  const [reason, setReason] = useState("");
  const [impactTotal, setImpactTotal] = useState(null);
  // Context-role bindings are mappings, not people, so they are reported
  // separately: a profile can read "0 people" and still be live through
  // context_role_profiles (e.g. Assigned Program Manager → program:program_manager).
  const [impactContextBindings, setImpactContextBindings] = useState(null);
  // "Default for" — which kinds of person receive this template. This was the
  // Role → Profile screen; it belongs on the template it changes, one click
  // from the contents it affects. Same endpoint, no new authority.
  const [defaultRoleChoice, setDefaultRoleChoice] = useState("");
  const [defaultRoleMsg, setDefaultRoleMsg] = useState("");
  const [defaultRoleErr, setDefaultRoleErr] = useState("");
  const [defaultRoleBusy, setDefaultRoleBusy] = useState(false);
  // Assigned-roles editor: the roles list is read-only by default (chips), and
  // the modal holds the add/remove controls.
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [removeBusy, setRemoveBusy] = useState("");
  const [removeMsg, setRemoveMsg] = useState("");
  const [removeErr, setRemoveErr] = useState("");

  const fetchProfiles = useCallback(async (bypassCache = false) => {
    const urls = [
      "/api/access-profiles",
      "/api/engineering/permissions/eligibility",
    ];
    const apply = (data, eligData) => {
      if (data.success) {
        setProfiles(data.profiles || []);
        setRoleDefaults(data.roleDefaults || {});
        setModuleCatalog(data.modules || {});
      }
      // Full role catalog (ROLE_CATALOG) — not just roles that already have
      // a default — so every role can be configured in the form dropdown.
      // The same payload also feeds the role-based feature filter below.
      if (eligData.success) {
        // The curated identity list is only PART of the vocabulary the engine
        // enforces: roles that exist in this database but not in that list
        // (program_manager, teacher, mentor…) are served separately as
        // `extraRoles`. Merge them, otherwise those roles cannot be re-bound to
        // a profile from this screen even though the engine honours them.
        const mergedRoles = [
          ...new Set([
            ...(eligData.roles || []),
            ...(eligData.extraRoles || []),
          ]),
        ];
        setAllRoles(
          mergedRoles.length > 0 ? mergedRoles : Object.keys(data.roleDefaults || {}),
        );
        setEligibilityRows(eligData.rows || []);
        setModuleToFeature(eligData.moduleToFeature || {});
        setFeatureKeys(eligData.features || []);
      } else {
        setAllRoles(Object.keys(data.roleDefaults || {}));
      }
    };
    setLoading(true);
    try {
      // Cache-first paint: returning to this tab renders instantly from fresh
      // snapshots; mutation flows pass bypassCache=true so the list always
      // reflects the last action.
      if (!bypassCache) {
        const cached = urls.map((url) => cacheGet(url));
        if (cached.every((cachedEntry) => cachedEntry !== null && cachedEntry.success)) {
          apply(cached[0], cached[1]);
          setLoading(false);
        }
      }
      const res = await fetch(urls[0]);
      const data = await res.json();
      if (data.success) cacheSet(urls[0], data);
      const eligRes = await fetch(urls[1]);
      const eligData = await eligRes.json();
      if (eligData.success) cacheSet(urls[1], eligData);
      apply(data, eligData);
    } catch (error) {
      console.error("Failed to load profiles", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    defer(() => fetchProfiles());
  }, [fetchProfiles]);

  // Identity is fixed, so the deep-link effect below can list it as a dependency
  // without re-running on every render: it writes state only through the stable
  // setters and reads the module-scope helper above.
  const selectProfile = useCallback(async (profile) => {
    setSelectedProfile(profile);
    setSafetyAck(false);
    setPendingSaveConfirm(null);
    setRenameMode(false);
    setActionMsg("");
    setActionError("");
    setSaveViolations(null);
    try {
      const res = await fetch(`/api/access-profiles?id=${profile.id}`);
      const data = await res.json();
      if (data.success) {
        setProfileCaps(data.capabilities || []);
        const saved = capsToObject(data.capabilities);
        setSavedCaps(saved);
        setDraftCaps(JSON.parse(JSON.stringify(saved)));
      }
    } catch (error) {
      console.error("Failed to load profile capabilities", error);
    }
  }, []);

  // UI-2c — deep-link / rail preselection: ?profile=<id> (or the rail) selects
  // a profile as soon as the list is available. Never auto-selects without a
  // requested id (the screen keeps its explicit "select a profile" state).
  useEffect(() => {
    if (!initialProfileId) return;
    if (
      selectedProfile &&
      String(selectedProfile.id) === String(initialProfileId)
    ) {
      return;
    }
    const hit = profiles.find((profile) => String(profile.id) === String(initialProfileId));
    // Deferred: the mount effect must not perform a synchronous state update.
    if (hit) defer(() => selectProfile(hit));
  }, [initialProfileId, profiles, selectedProfile, selectProfile]);

  // UI-2c — impact preview for the selected profile (how many users resolve to
  // it today). Read-only, fail-soft: no number is better than a wrong number.
  useEffect(() => {
    if (!selectedProfile?.id) {
      defer(() => {
        setImpactTotal(null);
        setImpactContextBindings(null);
      });
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/engineering/permissions/impact?profile_id=${encodeURIComponent(selectedProfile.id)}`,
        );
        const data = await res.json();
        if (!alive) return;
        setImpactTotal(data.success ? Number(data.impact?.total || 0) : null);
        setImpactContextBindings(
          data.success ? Number(data.impact?.contextBindings || 0) : null,
        );
      } catch {
        if (alive) {
          setImpactTotal(null);
          setImpactContextBindings(null);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedProfile?.id]);

  // The editor's module catalog = the registry truth (CAPABILITY_CATALOG), not
  // just PERMISSION_MODULES, so each feature shows ALL of its sub-sections
  // (e.g. CRM → Contacts + Bulk Upload). `locked` modules (duplicates) are
  // super-admin role-locked and never enter a profile.
  const availableModules = moduleCatalog ? buildEditableModules(moduleCatalog) : {};

  // Every state value, every read and both loaders stay here; the writes
  // live in ./profiles/actions (one factory per concern) and the markup
  // blocks in ./profiles. Both sides read this screen through `values`
  // (what it holds) and `ctx` (what it holds plus every handler).
  const values = {
    t,
    confirm,
    profiles,
    roleDefaults,
    allRoles,
    deleteBusy,
    setDeleteBusy,
    eligibilityRows,
    moduleToFeature,
    featureKeys,
    moduleCatalog,
    selectedProfile,
    setSelectedProfile,
    setProfileCaps,
    actionMsg,
    setActionMsg,
    actionError,
    setActionError,
    saveViolations,
    setSaveViolations,
    showCreateForm,
    setShowCreateForm,
    newProfile,
    setNewProfile,
    safetyAck,
    setSafetyAck,
    pendingSaveConfirm,
    setPendingSaveConfirm,
    draftCaps,
    setDraftCaps,
    savedCaps,
    setSavedCaps,
    saving,
    setSaving,
    renameMode,
    setRenameMode,
    renameValue,
    setRenameValue,
    reason,
    setReason,
    impactTotal,
    impactContextBindings,
    defaultRoleChoice,
    setDefaultRoleChoice,
    defaultRoleMsg,
    setDefaultRoleMsg,
    defaultRoleErr,
    setDefaultRoleErr,
    defaultRoleBusy,
    setDefaultRoleBusy,
    rolesModalOpen,
    setRolesModalOpen,
    removeBusy,
    setRemoveBusy,
    removeMsg,
    setRemoveMsg,
    removeErr,
    setRemoveErr,
    fetchProfiles,
    selectProfile,
    availableModules,
  };

  const profileSelectionResult = profileSelection({ ...values });
  const profileListResult = profileList({ ...values });
  const roleDefaultWritesResult = roleDefaultWrites({ ...values });
  const capsDraftResult = capsDraft({ ...values });

  // The two handlers this screen still names itself: the early return reads
  // none, the two derivations below read one each.
  const {
    computeChanges,
    defaultRolesFor,
  } = capsDraftResult;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div
          className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
          style={{
            borderColor: "rgba(255,102,0,0.1)",
            borderTopColor: "var(--brand-orange)",
          }}
        />
      </div>
    );
  }

  const changesCount = computeChanges();
  const selectedIsDefaultFor = selectedProfile
    ? defaultRolesFor(selectedProfile.id)
    : [];

  const catalogSectionsResult = catalogSections({ ...values, selectedIsDefaultFor });

  const ctx = {
    ...profileSelectionResult,
    ...profileListResult,
    ...roleDefaultWritesResult,
    ...capsDraftResult,
    ...catalogSectionsResult,
    changesCount,
    selectedIsDefaultFor,
    ...values,
  };

  return (
    <div className="space-y-6">
      <ProfileNotices ctx={ctx} />
      {/* Header aligné : descriptif à gauche, bouton "Nouveau profil" à droite */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-xs font-bold text-[var(--text-secondary)] max-w-3xl">
          {t("engineering.permissions.profilesIntro")}
        </p>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shrink-0 self-start"
        >
          <Plus className="w-3 h-3" /> {t("engineering.permissions.newProfile")}
        </button>
      </div>

      <ProfileCreateForm ctx={ctx} />
      <ProfilePicker ctx={ctx} />
      {/* Détail — affiché en dessous, seulement si un profil est sélectionné */}
      <ProfileDetail ctx={ctx} />
      <ProfileDialogs ctx={ctx} />
    </div>
  );
}
