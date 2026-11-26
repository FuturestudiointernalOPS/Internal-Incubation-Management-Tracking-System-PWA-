import InvestorAccessGate from "@/spaces/member/investor/components/InvestorAccessGate";

// The parent member layout provides the single persistent dashboard shell.
// Preserve the investor NDA/onboarding checks inside that existing shell.
export default function InvestorContextLayout({ children }) {
  return <InvestorAccessGate>{children}</InvestorAccessGate>;
}
