import { Search, Users, Filter } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function BlockersFilters({
  search,
  setSearch,
  users,
  filterUser,
  setFilterUser,
  filterStatus,
  setFilterStatus,
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "var(--text-secondary)" }}
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("common.search")}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 text-sm font-bold outline-none focus:border-[var(--brand-orange)] transition-all"
          style={{ color: "var(--text-primary)" }}
        />
      </div>

      <div className="relative">
        <Users
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "var(--text-secondary)" }}
        />
        <select
          value={filterUser}
          onChange={(event) => setFilterUser(event.target.value)}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
        >
          <option value="All Users">{t("adminMisc.blockers.allUsers")}</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <Filter
          className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "var(--text-secondary)" }}
        />
        <select
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value)}
          className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl py-4 pl-12 pr-4 text-sm font-bold text-[var(--text-primary)] outline-none appearance-none cursor-pointer focus:border-[var(--brand-orange)]"
        >
          <option value="all">{t("adminMisc.blockers.allStatuses")}</option>
          <option value="active">{t("status.active")}</option>
          <option value="resolved">{t("status.resolved")}</option>
        </select>
      </div>
    </div>
  );
}
