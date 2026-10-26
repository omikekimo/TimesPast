export const sessionBlobKey = (id) => `timespast_session_${id}`;

/**
 * Builds the data object that gets persisted for a session.
 */
export function buildSessionSnapshot({ events, notes, groups, activeLayers, timeRange }) {
  return { events, notes, groups, activeLayers, timeRange };
}

/**
 * Persists a session blob to localStorage.
 */
export function saveSessionBlob(id, data) {
  localStorage.setItem(sessionBlobKey(id), JSON.stringify(data));
}

/**
 * Loads and parses a session blob. Returns null if not found; throws on bad JSON.
 */
export function loadSessionBlob(id) {
  const stored = localStorage.getItem(sessionBlobKey(id));
  return stored ? JSON.parse(stored) : null;
}

/**
 * Removes a session blob from localStorage.
 */
export function deleteSessionBlob(id) {
  localStorage.removeItem(sessionBlobKey(id));
}
