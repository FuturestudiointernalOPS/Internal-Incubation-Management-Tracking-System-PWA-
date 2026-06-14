"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Save, Shield, User, Mail } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ProfileView from "@/components/dashboard/ProfileView";

/**
 * PARTICIPANT PROFILE PAGE
 *
 * Personal profile and account security settings.
 */
export default function ParticipantProfilePage() {
  const [user, setUser] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notify, setNotify] = useState(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(stored);
  }, []);

  const showToast = (msg, type = "success") => {
    setNotify({ msg, type });
    setTimeout(() => setNotify(null), 3500);
  };

  const handleSavePassword = async () => {
    const passwordField = document.getElementById("participant_password_field");
    if (!passwordField) return;
    const newPass = passwordField.value;
    if (!newPass || newPass.length < 4) {
      showToast("Password must be at least 4 characters.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: user.cid || user.id,
          password: newPass,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Password updated successfully.");
        passwordField.value = "";
      } else {
        showToast("Update failed. Try again.", "error");
      }
    } catch (e) {
      showToast("Network error.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role={user.role || "participant"}>
      <div className="p-6 space-y-8 max-w-4xl mx-auto">
        <ProfileView />

        {/* ─── PASSWORD CHANGE ─── */}
        <div
          className="card border-[var(--brand-orange)]/20 !p-8 space-y-6"
          style={{ background: "var(--surface-1)" }}
        >
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[var(--brand-orange)]" />
            <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
              Security Settings
            </h3>
          </div>
          <p className="text-[10px] font-bold text-[var(--text-secondary)]">
            Update your account password.
          </p>

          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 space-y-2 w-full relative">
              <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest pl-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="participant_password_field"
                  placeholder="Enter new password..."
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 pr-14 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--brand-orange)] transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={handleSavePassword}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-4 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 shrink-0"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Update Password"}
            </button>
          </div>
        </div>

        {/* ─── TOAST ─── */}
        {notify && (
          <div
            className={`fixed bottom-6 right-6 z-50 px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border shadow-2xl ${
              notify.type === "error"
                ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
            }`}
          >
            {notify.msg}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
