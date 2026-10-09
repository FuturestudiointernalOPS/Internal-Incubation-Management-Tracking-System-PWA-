"use client";

/**
 * Group detail — the drawer a row of the Groups tab opens: who is in it, what
 * the group's own default capabilities are, and which features the members'
 * roles are eligible for.
 *
 * Members are read from the registry (`?group=`), the group capabilities from
 * the matrix definition (`group_defaults`), eligibility from the ceiling — the
 * three sources the group actually has.
 */

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppDrawer from "@/components/ui/AppDrawer";
import AppButton from "@/components/ui/AppButton";
import { Cell, EmptyRow, HeadCell, Kpi, KpiRow, Pill, PrototypeTable } from "../prototypeUi";

export default function GroupDrawer({ group, data, onClose, onOpenPerson }) {
  const { t } = useI18n();
  const { groupDefaults = [], eligibilityMatrix = {}, moduleToFeature = {}, features = [], roleDefaults = {} } = data;
  const [members, setMembers] = useState(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/contacts?group=${encodeURIComponent(group)}`)
      .then((response) => response.json())
      .then((result) => active && setMembers(result?.success ? result.contacts || [] : []))
      .catch(() => active && setMembers([]));
    return () => {
      active = false;
    };
  }, [group]);

  const capabilities = groupDefaults.filter((row) => row.group_name === group);
  const memberRows = members === null ? [] : members;
  const memberRoles = [...new Set(memberRows.map((contact) => contact.role).filter(Boolean))];
  const eligibleFeatures = features.filter((feature) =>
    memberRoles.some((role) => eligibilityMatrix[role]?.[feature] === 1),
  );

  return (
    <AppDrawer
      isOpen
      onClose={onClose}
      title={group}
      footer={
        <AppButton variant="secondary" onClick={onClose}>
          {t("common.close")}
        </AppButton>
      }
    >
      <KpiRow>
        <Kpi value={members === null ? "…" : memberRows.length} label={t("engineering.permissions.prototype.members")} />
        <Kpi value={capabilities.length} label={t("engineering.permissions.prototype.capabilities")} />
        <Kpi value={eligibleFeatures.length} label={t("engineering.permissions.prototype.eligibility")} />
      </KpiRow>

      {eligibleFeatures.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {eligibleFeatures.map((feature) => (
            <Pill key={feature} tone="ok">
              {feature}
            </Pill>
          ))}
        </div>
      )}

      {capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {capabilities.map((row) => (
            <Pill key={`${row.module}.${row.capability}`}>
              {moduleToFeature[row.module] ? `${row.module} ▸ ${row.capability}` : `${row.module}.${row.capability}`}
            </Pill>
          ))}
        </div>
      )}

      <PrototypeTable minWidth="18rem">
        <thead>
          <tr>
            <HeadCell>{t("engineering.permissions.prototype.name")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.role")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.profile")}</HeadCell>
          </tr>
        </thead>
        <tbody>
          {members === null && <EmptyRow colSpan={3} label={t("common.loading")} />}
          {members !== null && memberRows.length === 0 && (
            <EmptyRow colSpan={3} label={t("common.noResults")} />
          )}
          {memberRows.map((contact) => (
            <tr
              key={contact.cid}
              className="cursor-pointer transition-colors hover:bg-surface-2"
              onClick={() => onOpenPerson?.(contact)}
            >
              <Cell className="font-bold">{contact.name || contact.email || contact.cid}</Cell>
              <Cell>{contact.role || t("engineering.permissions.prototype.emptyValue")}</Cell>
              <Cell>{roleDefaults[contact.role]?.profileName || t("engineering.permissions.prototype.emptyValue")}</Cell>
            </tr>
          ))}
        </tbody>
      </PrototypeTable>
    </AppDrawer>
  );
}
