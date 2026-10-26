import { csvStringToDate, datePartToYear } from '@/lib/dateUtils';

/**
 * Convert an array of raw CSV row objects into event pins and group definitions.
 * Returns { events, groups } — groups is a plain object keyed by groupId.
 * Caller supplies all fallback values so this function is side-effect-free.
 */
export function csvRowsToEvents(rows, { fallbackGroupId, fallbackColor, fallbackName = 'CSV Import' } = {}) {
  const newGroups = {};

  const events = rows.filter(r => r.title).map((r, i) => {
    const groupId    = r.search_group || fallbackGroupId;
    const groupColor = r.search_color || fallbackColor;
    const groupName  = r.search_query || fallbackName;
    const parsedDate = r.date ? csvStringToDate(r.date) : null;
    const year       = parsedDate
      ? datePartToYear(parsedDate.start)
      : (parseInt(r.year, 10) || 0);

    if (groupId && !newGroups[groupId]) {
      newGroups[groupId] = { id: groupId, name: groupName, color: groupColor };
    }

    return {
      id:            r.id || `${groupId}_imported_${i}`,
      title:         r.title,
      year,
      date:          parsedDate,
      latitude:      parseFloat(r.latitude)  || 0,
      longitude:     parseFloat(r.longitude) || 0,
      category:      r.category?.toLowerCase().replace(' ', '_') || 'events',
      significance:  r.significance?.toLowerCase() || 'local',
      description:   r.description   || '',
      wikipedia_url: r.wikipedia_url  || '',
      source:        r.source || 'CSV Import',
      search_group:  groupId,
      search_query:  groupName,
      search_color:  groupColor,
    };
  });

  return { events, groups: newGroups };
}
