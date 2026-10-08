/**
 * Programs — the participant's resource shaping (SERVICE layer).
 *
 * Turns the program's knowledge-bank items into the participant-facing resource
 * list, bucketing each item by the session it looks like it belongs to (its tag,
 * its category, or a "week N" mention in the title).
 *
 * Layer (see docs/LAYER_SPLIT.md): pure shaping, no SQL, no HTTP, no models.
 */

/**
 * Shape the participant resources and their per-week buckets.
 *
 * @param {Object} input
 * @param {Array}  input.knowledgeItems  the knowledge-bank rows
 * @param {Object} input.attachmentsByNote  note-id → attachment rows
 * @param {Array}  input.unlockedSessions   the unlocked session rows
 * @returns {{resources: Array, resourcesByWeek: Map, generalResources: Array}}
 */
export function shapeParticipantResources({
  knowledgeItems,
  attachmentsByNote,
  unlockedSessions,
}) {
  // Build resources with real attachment URLs
  const resources = knowledgeItems.map((knowledgeItem) => {
    const attachments = attachmentsByNote[knowledgeItem.id] || [];
    return {
      id: knowledgeItem.id,
      title: knowledgeItem.title,
      description: knowledgeItem.description,
      url: attachments.length > 0 ? attachments[0].url : null,
      fileType: knowledgeItem.file_type,
      filePath: knowledgeItem.file_path,
      category: knowledgeItem.category,
      tags: knowledgeItem.tags ? knowledgeItem.tags.split(",").map((tag) => tag.trim()) : [],
      attachments,
      createdAt: knowledgeItem.created_at,
    };
  });
  const resourcesByWeek = new Map();
  for (const resource of resources) {
    const matchedSession = unlockedSessions.find(
      (session) =>
        resource.tags?.includes(String(session.id)) ||
        resource.category === String(session.id) ||
        resource.title?.toLowerCase().includes(`week ${session.week_number}`),
    );
    const weekNum = matchedSession?.week_number || 0;
    if (!resourcesByWeek.has(weekNum)) resourcesByWeek.set(weekNum, []);
    resourcesByWeek.get(weekNum).push(resource);
  }
  const generalResources = resources.filter((resource) => {
    for (const [, weekResources] of resourcesByWeek) {
      if (weekResources.includes(resource)) return false;
    }
    return true;
  });

  return { resources, resourcesByWeek, generalResources };
}
