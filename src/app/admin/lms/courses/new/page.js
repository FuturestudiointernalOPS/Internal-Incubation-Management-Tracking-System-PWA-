"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppCard from "@/components/ui/AppCard";
import CourseFormFields from "@/components/lms/CourseFormFields";
import { notify } from "@/components/lms/notify";
import { useI18n } from "@/lib/i18n";

const EMPTY = {
  title: "",
  description: "",
  thumbnail_url: "",
  visibility: "public",
  is_free: true,
  price: null,
};

/**
 * ADMIN — CREATE COURSE
 * Creates a DRAFT course (never auto-published), then opens the editor.
 */
export default function LmsCourseNewPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!form.title.trim()) {
      notify("error", "lms.errors.courseTitleRequired");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/lms/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", "lms.courses.created");
      router.push(`/admin/lms/courses/${data.course.id}`);
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => router.push("/admin/lms/courses")}
                className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors mb-3"
                style={{ color: "var(--text-tertiary)" }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t("lms.courses.backToCourses")}
              </button>
              <h1 className="text-xl font-black uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>
                {t("lms.courses.newTitle")}
              </h1>
              <p className="text-[10px] font-medium mt-1" style={{ color: "var(--text-tertiary)" }}>
                {t("lms.courses.newSubtitle")}
              </p>
            </div>
            <AppButton variant="primary" icon={Plus} loading={saving} onClick={create}>
              {t("lms.courses.create")}
            </AppButton>
          </div>

          <AppCard padding="lg">
            <CourseFormFields value={form} onChange={setForm} />
          </AppCard>
        </div>
      </div>
    </>
  );
}
