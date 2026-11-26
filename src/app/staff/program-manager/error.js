"use client";

import ErrorPage from "@/components/ui/ErrorPage";

export default function PMError({ error, reset }) {
  return <ErrorPage error={error} reset={reset} />;
}
