/**
 * The blockers carried by a stand-up row.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 * 1 names this module reads into blockerRowActions().
 */

export function blockerRowActions({
  setTaskRows,
}) {
  const addBlockerToRow = (rowIndex, description) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        blockers: [
          ...(updated[rowIndex]?.blockers || []),
          {
            id: Date.now(),
            description,
            severity: "medium",
            status: "Active",
            created_at: new Date().toISOString(),
          },
        ],
      };
      return updated;
    });
  };

  const _updateBlockerInRow = (rowIndex, blockerId, updates) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        blockers: (updated[rowIndex]?.blockers || []).map((blocker) =>
          blocker.id === blockerId ? { ...blocker, ...updates } : blocker,
        ),
      };
      return updated;
    });
  };

  const _removeBlockerFromRow = (rowIndex, blockerId) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        blockers: (updated[rowIndex]?.blockers || []).filter(
          (blocker) => blocker.id !== blockerId,
        ),
      };
      return updated;
    });
  };

  const resolveBlocker = (rowIndex, blockerId) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        blockers: (updated[rowIndex]?.blockers || []).map((blocker) =>
          blocker.id === blockerId
            ? {
                ...blocker,
                status: "Resolved",
                resolved_at: new Date().toISOString(),
              }
            : blocker,
        ),
      };
      return updated;
    });
  };

  return {
    addBlockerToRow,
    _updateBlockerInRow,
    _removeBlockerFromRow,
    resolveBlocker,
  };
}
