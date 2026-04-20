import { redirect } from 'next/navigation';

export default function LegacyRedirect() {
  // Hard redirect anything that lands here dynamically to the new dashboard
  redirect('/v2/superadmin');
}
