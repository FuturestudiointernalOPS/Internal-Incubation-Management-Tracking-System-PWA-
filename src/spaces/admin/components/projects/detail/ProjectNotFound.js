import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
export default function ProjectNotFound({ error,
  onBack, }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
      <p className="text-base font-black text-rose-500">
        {error || t("adminMisc.projectDetail.projectNotFound")}
      </p>
      <button
        onClick={onBack}
        className="mt-6 flex items-center gap-2 px-4 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-sm font-bold uppercase tracking-wide hover:brightness-110 transition-all"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {t("adminMisc.projectDetail.backToProjects")}
      </button>
    </div>
  );
}
