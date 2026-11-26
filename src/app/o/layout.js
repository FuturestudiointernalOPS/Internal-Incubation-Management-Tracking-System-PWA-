export const dynamic = "force-dynamic";
import styles from "@/components/ui/organization-sidebar.module.css";
// Separate client entry: no internal DashboardLayout, auth badges or role menus.
export default function OrganizationLayout({ children }) {
  return <main className="min-h-screen bg-surface-1 text-[var(--text-primary)]"><div className={styles.frame}>{children}</div></main>;
}
