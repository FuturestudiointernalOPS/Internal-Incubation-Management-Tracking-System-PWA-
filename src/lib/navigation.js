"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STACK_KEY = "impactos_nav_stack";
const MAX_STACK = 30;

function getStack() {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(sessionStorage.getItem(STACK_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveStack(stack) {
  try {
    sessionStorage.setItem(STACK_KEY, JSON.stringify(stack));
  } catch {
    /* storage unavailable — back falls back to the fallback path */
  }
}

/** Record a visited page (dedupes consecutive visits). Called on every route change. */
export function trackPage(pathname) {
  const stack = getStack();
  if (stack[stack.length - 1] !== pathname) {
    stack.push(pathname);
    if (stack.length > MAX_STACK) stack.shift();
    saveStack(stack);
  }
}

/**
 * Returns the previous in-app page path (removing the current entry from the
 * stack), or null when there is none (fresh tab / deep link / first page).
 */
export function getPreviousPath(currentPathname) {
  const stack = getStack();
  if (stack[stack.length - 1] === currentPathname) stack.pop();
  const prev = stack[stack.length - 1] || null;
  saveStack(stack);
  return prev;
}

/** Mount once in the root layout. Records every client-side route change. */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    trackPage(pathname);
  }, [pathname]);
  return null;
}
