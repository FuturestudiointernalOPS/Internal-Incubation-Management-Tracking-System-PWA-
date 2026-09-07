"use client";

import ErrorPage from "@/components/ui/ErrorPage";

export default function TeacherError({ error, reset }) {
  return <ErrorPage error={error} reset={reset} />;
}
