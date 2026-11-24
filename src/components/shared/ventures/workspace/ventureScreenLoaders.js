// The Venture detail screen's imperative, cache-backed loaders.
//
// Each loader reads one address, paints the cached answer immediately when there
// is one, then paints the fresh answer and caches it. They share that exact
// shape, so they live here as one factory; the screen owns the state they
// publish into and passes their setters in. The bodies are the screen's own,
// moved unchanged — only the shared cache dance and their setters are lifted.
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

export function createVentureLoaders({
  params,
  setActionPlans,
  setTasks,
  setStandups,
  setCurrentWeekStandup,
  setCurrentWeekNum,
  setCurrentWeekYear,
  setRetros,
  setCurrentWeekRetro,
  setBlockers,
  setAdvisors,
  setCoachingSessions,
  setPlaybookEntries,
}) {
  async function fetchActionPlans(bypassCache = false) {
    const url = `/api/ventures/${params.id}/action-plans`;
    const apply = (payload) => { if (payload.success) setActionPlans(payload.action_plans); };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
  async function fetchTasks(bypassCache = false) {
    const url = `/api/ventures/${params.id}/tasks`;
    const apply = (payload) => { if (payload.success) setTasks(payload.tasks || []); };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
  async function fetchStandups(bypassCache = false) {
    const url = `/api/ventures/${params.id}/standups`;
    const apply = (payload) => { if (payload.success) { setStandups(payload.standups || []); setCurrentWeekStandup(payload.current_week_submitted !== false); setCurrentWeekNum(payload.current_week); setCurrentWeekYear(payload.current_year); } };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
  async function fetchRetros(bypassCache = false) {
    const url = `/api/ventures/${params.id}/retros`;
    const apply = (payload) => { if (payload.success) { setRetros(payload.retros || []); setCurrentWeekRetro(payload.current_week_submitted !== false); setCurrentWeekNum(payload.current_week); setCurrentWeekYear(payload.current_year); } };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
  async function fetchBlockers(bypassCache = false) {
    const url = `/api/ventures/${params.id}/blockers`;
    const apply = (payload) => { if (payload.success) setBlockers(payload.blockers || []); };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
  async function fetchAdvisors(bypassCache = false) {
    const url = `/api/ventures/${params.id}/advisors`;
    const apply = (payload) => { if (payload.success) setAdvisors(payload.advisors || []); };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
  async function fetchCoaching(bypassCache = false) {
    const url = `/api/ventures/${params.id}/coaching`;
    const apply = (payload) => { if (payload.success) setCoachingSessions(payload.sessions || payload.coaching_sessions || []); };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }
  async function fetchPlaybook(bypassCache = false) {
    const url = `/api/ventures/${params.id}/playbook`;
    const apply = (payload) => { if (payload.success) setPlaybookEntries(payload.playbook || []); };
    try {
      if (!bypassCache) { const cached = cacheGet(url); if (cached !== null && cached.success) apply(cached); }
      const response = await fetch(url); const data = await response.json(); if (data.success) cacheSet(url, data); apply(data);
    } catch{}
  }

  return {
    fetchActionPlans, fetchTasks, fetchStandups, fetchRetros,
    fetchBlockers, fetchAdvisors, fetchCoaching, fetchPlaybook,
  };
}
