"use client";

import { Building2 } from "lucide-react";
import AppButton from "@/components/ui/AppButton";

/**
 * The "complete your profile" / "pending approval" gate shown when the investor
 * profile is missing or not yet approved.
 * Extracted verbatim from InvestorDashboard.
 */
export default function ProfileGate({ profile, onSetupProfile }) {
  return (
    <div className="max-w-2xl mx-auto py-20 text-center space-y-6">
      <Building2 className="w-16 h-16 text-[var(--text-tertiary)] mx-auto" />
      <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase">
        {!profile ? "Complete Your Investor Profile" : "Account Pending Approval"}
      </h2>
      <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
        {!profile
          ? "Create your investor profile to access venture discovery and investment opportunities."
          : "Your investor account is under review. You'll be notified once approved."}
      </p>
      {!profile && (
        <AppButton variant="primary" onClick={onSetupProfile}>
          Set Up Profile
        </AppButton>
      )}
    </div>
  );
}
