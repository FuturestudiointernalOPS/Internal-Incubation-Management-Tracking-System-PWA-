"use client";

import { useState } from "react";

/**
 * What the dashboard is narrowed by: the search box, the three filters and the
 * sort. These live here rather than in the page because they are the page's
 * whole notion of "which tasks am I looking at" — everything the rows show is a
 * consequence of them.
 *
 * The sort is part of this state and not a filter of its own because it is what
 * the read is keyed on: the server is asked to sort, so changing it re-reads.
 */
export default function useAdminTaskFilters(t) {
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState("All Users");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("All Projects");
  const [sortBy, setSortBy] = useState("newest");

  const sortOptions = [
    { id: "newest", label: t("adminMisc.tasks.sortNewest") },
    { id: "oldest", label: t("adminMisc.tasks.sortOldest") },
    { id: "most_carried", label: t("adminMisc.tasks.sortMostCarried") },
    { id: "updated", label: t("adminMisc.tasks.sortRecentlyUpdated") },
  ];

  return {
    search,
    setSearch,
    filterUser,
    setFilterUser,
    filterStatus,
    setFilterStatus,
    filterProject,
    setFilterProject,
    sortBy,
    setSortBy,
    sortOptions,
  };
}