"use client";

import { Search } from "lucide-react";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";

export function MembershipFilters({
  t,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  accountFilter,
  setAccountFilter,
  roleFilter,
  setRoleFilter,
  roles,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div className="md:col-span-1">
        <AppInput
          icon={Search}
          placeholder={t("membership.page.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <AppSelect
        label={t("membership.page.filterStatus")}
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
        options={[
          { value: "all", label: t("membership.page.filterStatusAll") },
          { value: "active", label: t("membership.status.active") },
          { value: "expiringSoon", label: t("membership.status.expiringSoon") },
          { value: "expired", label: t("membership.status.expired") },
          { value: "ended", label: t("membership.status.ended") },
        ]}
      />
      <AppSelect
        label={t("membership.page.filterAccountStatus")}
        value={accountFilter}
        onChange={(event) => setAccountFilter(event.target.value)}
        options={[
          { value: "all", label: t("membership.page.filterAccountAll") },
          { value: "active", label: t("membership.status.accountActive") },
          { value: "pending", label: t("membership.status.accountPending") },
          { value: "invited", label: t("membership.status.accountInvited") },
          { value: "inactive", label: t("membership.status.accountInactive") },
        ]}
      />
      <AppSelect
        label={t("membership.page.filterRole")}
        value={roleFilter}
        onChange={(event) => setRoleFilter(event.target.value)}
        options={[
          { value: "all", label: t("membership.page.filterRoleAll") },
          ...roles.map((role) => ({ value: role, label: role })),
        ]}
      />
    </div>
  );
}
