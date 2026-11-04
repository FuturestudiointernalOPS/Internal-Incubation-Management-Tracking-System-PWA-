import { useI18n } from "@/lib/i18n";
import { X } from "lucide-react";
import PmReportOverviewSection from "./PmReportOverviewSection";
import PmReportAssignmentSection from "./PmReportAssignmentSection";
import PmReportParticipationSection from "./PmReportParticipationSection";
import PmReportDeliverySection from "./PmReportDeliverySection";
import PmReportIssuesSection from "./PmReportIssuesSection";
import PmReportNextWeekSection from "./PmReportNextWeekSection";
import PmReportNotesSection from "./PmReportNotesSection";

export default function PmReportModal(props) {
  const { t } = useI18n();
  const { isSaving, onClosePMReportModal, onSubmitPMReport } = props;

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
      onClick={() => onClosePMReportModal()}
    >
      <div
        className="card w-full max-w-lg space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center sticky top-0 bg-secondary z-10 pb-4 border-b border-[var(--border-primary)]">
          <h3
            className="text-base font-black uppercase tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {t("pmMisc.workspace.reportWeeklyReport")}
          </h3>
          <button onClick={() => onClosePMReportModal()}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-8">
          <PmReportOverviewSection ctx={props} />
          <PmReportAssignmentSection ctx={props} />
          <PmReportParticipationSection ctx={props} />
          <PmReportDeliverySection ctx={props} />
          <PmReportIssuesSection ctx={props} />
          <PmReportNextWeekSection ctx={props} />
          <PmReportNotesSection ctx={props} />
        </div>

        <div className="flex gap-3 sticky bottom-0 bg-secondary pt-4 border-t border-[var(--border-primary)]">
          <button
            onClick={() => onClosePMReportModal()}
            className="flex-1 btn btn-secondary"
          >
            {t("pmMisc.workspace.cancel")}
          </button>
          <button
            onClick={onSubmitPMReport}
            disabled={isSaving}
            className="flex-1 btn btn-primary"
          >
            {isSaving
              ? t("pmMisc.workspace.submitting")
              : t("pmMisc.workspace.submitReport")}
          </button>
        </div>
      </div>
    </div>
  );
}
