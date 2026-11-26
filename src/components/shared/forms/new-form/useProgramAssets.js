import { useEffect, useState } from "react";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { PROGRAM_ASSET_URLS } from "./constants";

/**
 * Loads the wizard's reference data (knowledge bank, Future Studio staff,
 * segments and program templates) and keeps `loadingAssets` for the save
 * button. Cache-first, then refreshed from the network.
 */
export function useProgramAssets({
  t,
  notify,
  setKnowledgeNodes,
  setStaffList,
  setSegments,
  setTemplates,
  setCustomProgramTypes,
}) {
  const [loadingAssets, setLoadingAssets] = useState(true);

  useEffect(() => {
    async function loadAssets(bypassCache = false) {
      const urls = PROGRAM_ASSET_URLS;
      const apply = (knowledgeData, staffData, segmentsData, templatesData) => {
        if (knowledgeData?.success) setKnowledgeNodes(knowledgeData.conceptNotes || []);
        if (segmentsData?.success) setSegments(segmentsData.families || []);
        if (templatesData?.success) setTemplates(templatesData.templates || []);
        // Filter: Only Future Studio contacts
        if (staffData?.success) {
          const staffOnly = (staffData.contacts || []).filter(
            (contact) =>
              contact.group_name?.toUpperCase() === "FUTURE STUDIO",
          );
          setStaffList(staffOnly);
        }
      };
      let painted = false;
      setLoadingAssets(true);
      try {
        // Cache-first paint: returning to this page renders the wizard options
        // instantly from fresh snapshots; inline-created groups/KB nodes update
        // local lists directly, so nothing here needs bypassCache.
        if (!bypassCache) {
          const cached = urls.map((url) => cacheGet(url));
          if (cached.every((cachedEntry) => cachedEntry !== null && cachedEntry.success)) {
            apply(cached[0], cached[1], cached[2], cached[3]);
            setLoadingAssets(false);
            painted = true;
          }
        }
        const responses = await Promise.all(
          urls.map((url) =>
            fetch(url)
              .then((response) => response.json())
              .catch(() => ({ success: false })),
          ),
        );
        urls.forEach((url, index) => {
          if (responses[index]?.success) cacheSet(url, responses[index]);
        });
        apply(responses[0], responses[1], responses[2], responses[3]);
      } catch (error) {
        if (!painted) {
          console.error("Asset Load Failure:", error);
          notify(
            "error",
            t("adminMisc.newProgram.syncFailed"),
          );
        }
      } finally {
        setLoadingAssets(false);
      }
    }
    loadAssets();
    // Charger les types personnalisés depuis la DB
    fetch("/api/program-types")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.types) setCustomProgramTypes(payload.types);
      })
      .catch(() => {});
  }, [t]);

  return { loadingAssets };
}
