"use client";

import { useState } from "react";
import {
  CheckCircle2, ChevronDown, ChevronRight, Download, Eye, FilePlus2, FileX2, History, KeyRound,
  Pencil, ShieldOff, SlidersHorizontal, Trash2, Upload, XCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { dataRoomCategory } from "@/lib/dataRoom";

/** Every Data Room action → how it looks (icon + the charter tone) in the timeline. */
const LOOK = {
  DATA_ROOM_DOCUMENT_UPLOADED: { icon: FilePlus2, tone: "o" },
  DATA_ROOM_VERSION_ADDED: { icon: Upload, tone: "o" },
  DATA_ROOM_DOCUMENT_UNDER_REVIEW: { icon: History, tone: "w" },
  DATA_ROOM_DOCUMENT_VERIFIED: { icon: CheckCircle2, tone: "g" },
  DATA_ROOM_DOCUMENT_REJECTED: { icon: XCircle, tone: "r" },
  DATA_ROOM_DOCUMENT_DELETED: { icon: Trash2, tone: "r" },
  DATA_ROOM_DOCUMENT_UPDATED: { icon: Pencil, tone: "b" },
  DATA_ROOM_ACCESS_GRANTED: { icon: KeyRound, tone: "b" },
  DATA_ROOM_ACCESS_REVOKED: { icon: ShieldOff, tone: "r" },
  DATA_ROOM_REQUIREMENT_UPDATED: { icon: SlidersHorizontal, tone: "w" },
  view: { icon: Eye, tone: "b" },
  download: { icon: Download, tone: "o" },
};
const FALLBACK = { icon: FileX2, tone: "" };

const when = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: "", time: "" };
  return { day: date.toLocaleDateString(), time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
};

/**
 * A timeline of what happened in the Data Room: one coloured marker per event
 * (green approved, red refused/deleted, orange filed, …), the person and the
 * moment under it. The card folds down to its header, and shows the latest few
 * events — the rest open on demand — so a busy room never becomes a long page.
 *
 * `kind` is "history" (document and requirement events) or "access" (who opened
 * or downloaded what); the server decided every fact, this only draws it.
 */
export default function DataRoomActivity({ kind, events = [], preview = 5 }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  if (events.length === 0) return null;

  const i18n = kind === "access" ? "dataRoom.accessHistory" : "dataRoom.history";
  const visible = all ? events : events.slice(0, preview);

  const describe = (event) => {
    if (kind === "access") {
      return {
        key: event.id,
        look: LOOK[event.access_type] || FALLBACK,
        title: t(`${i18n}.actions.${event.access_type}`),
        detail: event.document_title || t("dataRoom.accessHistory.document"),
        who: event.viewer_name || event.viewer_email || t("dataRoom.accessHistory.someone"),
        at: event.created_at,
      };
    }
    const category = event.details?.category ? dataRoomCategory(event.details.category) : null;
    return {
      key: event.id,
      look: LOOK[event.action] || FALLBACK,
      title: t(`${i18n}.actions.${event.action}`),
      detail: category ? t(category.labelKey) : event.details?.category || null,
      who: event.actor_name || event.actor_cid,
      at: event.created_at,
    };
  };

  return (
    <section className="dr-act">
      {/* The whole header folds the card, not only the arrow. */}
      <button type="button" className="dr-act-head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="dr-act-title">{t(`${i18n}.title`)}</span>
        <span className="stf-tag o">{events.length}</span>
      </button>

      {open && (
        <>
          <ol className={`dr-act-list ${all ? "is-scroll" : ""}`}>
            {visible.map((event) => {
              const item = describe(event);
              const Icon = item.look.icon;
              const moment = when(item.at);
              return (
                <li key={item.key} className="dr-act-item">
                  <span className={`dr-ico ${item.look.tone}`}><Icon size={15} /></span>
                  <div className="dr-act-body">
                    <p className="dr-act-line">
                      <b>{item.title}</b>
                      {item.detail ? <span className="stf-tag">{item.detail}</span> : null}
                    </p>
                    <p className="dr-act-meta">{item.who}</p>
                  </div>
                  <span className="dr-act-when">
                    <b>{moment.day}</b>
                    <i>{moment.time}</i>
                  </span>
                </li>
              );
            })}
          </ol>
          {events.length > preview && (
            <button type="button" className="stf-link-btn dr-act-more" onClick={() => setAll((value) => !value)}>
              {all ? t(`${i18n}.showLess`) : t(`${i18n}.showAll`, { count: events.length })}
            </button>
          )}
        </>
      )}
    </section>
  );
}
