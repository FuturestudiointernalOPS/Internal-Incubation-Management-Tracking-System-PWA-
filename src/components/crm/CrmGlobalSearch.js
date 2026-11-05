"use client";

import React, { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const MIN_LENGTH = 2;

function Group({ title, children }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
        {title}
      </p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function Item({ href, title, subtitle }) {
  return (
    <li>
      <a
        href={href}
        className="block rounded-lg px-2 py-1.5 hover:bg-[var(--surface-3)] transition-colors"
      >
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{title}</p>
        {subtitle ? (
          <p className="text-xs text-[var(--text-secondary)] truncate">{subtitle}</p>
        ) : null}
      </a>
    </li>
  );
}

/**
 * CRM — global search over the four objects.
 *
 * Visibility only: the endpoint re-authorizes, and the people group is decided
 * server-side from the caller's rights. Debounced so a typed word is one request.
 */
export default function CrmGlobalSearch() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_LENGTH) {
      setResult(null);
      setLoading(false);
      return undefined;
    }

    let alive = true;
    setLoading(true);

    const timer = setTimeout(() => {
      fetch(`/api/crm/search?q=${encodeURIComponent(trimmed)}`)
        .then((response) => response.json())
        .then((payload) => {
          if (alive && payload.success) setResult(payload);
        })
        .catch(() => {})
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 250);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const groups = result?.groups ?? null;
  const hasResults =
    groups && Object.values(groups).some((items) => Array.isArray(items) && items.length > 0);
  const trimmed = query.trim();

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("crm.search.placeholder")}
          className="w-full pl-10 pr-10 py-3 text-sm rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none focus:border-[var(--brand-orange)] transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={t("crm.search.clear")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {trimmed.length > 0 && trimmed.length < MIN_LENGTH && (
        <p className="text-xs text-[var(--text-secondary)] mt-2 px-1">{t("crm.search.hint")}</p>
      )}

      {result && (
        <div className="mt-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
          {loading ? (
            <p className="px-4 py-3 text-xs text-[var(--text-secondary)]">{t("crm.search.searching")}</p>
          ) : !hasResults ? (
            <p className="px-4 py-3 text-sm text-[var(--text-secondary)]">{t("crm.search.noResults")}</p>
          ) : (
            <div className="divide-y divide-[var(--border-primary)] max-h-96 overflow-y-auto">
              {groups.people.length > 0 && (
                <Group title={t("crm.search.people")}>
                  {groups.people.map((person) => (
                    <Item
                      key={person.cid}
                      href={`/crm/people/${person.cid}`}
                      title={person.name || person.email || person.cid}
                      subtitle={person.email}
                    />
                  ))}
                </Group>
              )}

              {groups.organizations.length > 0 && (
                <Group title={t("crm.search.organizations")}>
                  {groups.organizations.map((organization) => (
                    <Item
                      key={organization.id}
                      href="/crm/organizations"
                      title={organization.name}
                      subtitle={organization.industry || organization.type}
                    />
                  ))}
                </Group>
              )}

              {groups.leads.length > 0 && (
                <Group title={t("crm.search.leads")}>
                  {groups.leads.map((lead) => (
                    <Item
                      key={lead.id}
                      href={`/crm/leads/${lead.id}`}
                      title={lead.title}
                      subtitle={
                        lead.contact_name ||
                        lead.organization_name ||
                        t(`crm.leads.statuses.${lead.status}`)
                      }
                    />
                  ))}
                </Group>
              )}

              {groups.opportunities.length > 0 && (
                <Group title={t("crm.search.opportunities")}>
                  {groups.opportunities.map((opportunity) => (
                    <Item
                      key={opportunity.id}
                      href={`/crm/opportunities/${opportunity.id}`}
                      title={opportunity.name}
                      subtitle={`${opportunity.pipeline_name} · ${opportunity.stage_name}`}
                    />
                  ))}
                </Group>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
