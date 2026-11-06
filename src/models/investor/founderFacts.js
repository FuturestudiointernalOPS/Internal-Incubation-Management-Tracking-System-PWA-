// Reuse the canonical active founder relationships. No names, contact details
// or new founder data entry are needed for an investor card.
export const INVESTOR_FOUNDER_FACTS = `
  (SELECT COUNT(*)::int FROM venture_members vm
   WHERE vm.venture_id::text = v.id::text
     AND vm.member_type = 'founder' AND vm.removed_at IS NULL) AS founders_count,
  ARRAY(SELECT DISTINCT c.country FROM venture_members vm
        JOIN contacts c ON c.cid = COALESCE(vm.contact_id, vm.user_cid)
        WHERE vm.venture_id::text = v.id::text
          AND vm.member_type = 'founder' AND vm.removed_at IS NULL
          AND c.country IS NOT NULL AND c.country <> ''
        ORDER BY c.country) AS founders_countries`;
