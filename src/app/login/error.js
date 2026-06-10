"use client";

import ErrorPage from "@/components/ui/ErrorPage";

export default function LoginError({ error, reset }) {
  return <ErrorPage error={error} reset={reset} />;
}
