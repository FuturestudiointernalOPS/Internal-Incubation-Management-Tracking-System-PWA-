import { X } from "lucide-react";
import MiniCalendar from "./MiniCalendar";

export default function DatePickerModal({ datePicker, createData, setCreateData, onClose, t }) {
  return (
    <div className="fixed inset-0 z-[600] bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">{t("platformMisc.runs.selecting")} {datePicker === 'opens' ? t("platformMisc.runs.opensDate") : t("platformMisc.runs.closesDate")}</span>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <MiniCalendar
          value={datePicker === 'opens' ? createData.opens_at : createData.closes_at}
          onChange={(date) => setCreateData({ ...createData, [datePicker === 'opens' ? 'opens_at' : 'closes_at']: date })}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
