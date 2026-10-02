import { useI18n } from "@/lib/i18n";

export default function ProgramLoading() {
  const { t } = useI18n();

  return (
    <>
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">
          {t("common.loading")}
        </p>
      </div>
    </>
  );
}
