import styles from "./participant.module.css";

/**
 * PARTICIPANT SURFACE — the programme seat's own surface styling.
 *
 * The shell is rendered once by the member space layout; this layout only
 * applies the participant surface wrapper.
 */
export const dynamic = "force-dynamic";

export default function ParticipantLayout({ children }) {
  return <div className={styles.surface}>{children}</div>;
}
