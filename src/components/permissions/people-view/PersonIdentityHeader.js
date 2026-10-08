"use client";

import React from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import Badge from "../ui/Badge";

/**
 * WHO the permissions below belong to — the first question the screen answers.
 *
 * The name is the page's subject, so it leads at heading size; the role and the
 * profile sit on the line under it, because they are what every right below is
 * derived from. A subtle separator (not a nested card) closes the block, so the
 * identity reads as a header, not as one more box.
 */
export default function PersonIdentityHeader({ t, person, ctx, profilesSlot = null }) {
  if (!ctx) return null;
  const name = person?.name || person?.cid || "";
  const profileName = ctx.profile?.profileName || null;

  return (
    <header
      aria-labelledby="people-identity-title"
      className="space-y-3 border-b border-[var(--border-primary)] pb-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)]"
              aria-hidden="true"
            >
              <UserRound className="h-4 w-4" />
            </span>
            <h2
              id="people-identity-title"
              className="truncate text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl"
            >
              {name}
            </h2>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-[46px] text-sm text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {ctx.role}
            </span>
            {profileName && profileName !== ctx.role && (
              <>
                <span aria-hidden="true">·</span>
                <span>{profileName}</span>
              </>
            )}
            {person?.cid && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-xs opacity-80">{person.cid}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {ctx.isSuperAdmin && (
            <Badge variant="verified">
              {t("authorization.people.identity.superAdmin")}
            </Badge>
          )}
          {(ctx.groups || []).map((group) => (
            <Badge key={group} variant="neutral">
              {group}
            </Badge>
          ))}
        </div>
      </div>

      {profilesSlot}
    </header>
  );
}
