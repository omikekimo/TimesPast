// ── useMapHandlers.js ────────────────────────────────────────────────────────
// Custom React hook containing all Map.jsx handler logic.
// Accepts current state and setters, returns named handler functions.
// Keeps Map.jsx as a lean state + layout file.
// All handlers log to the TimesPast console via the `con` argument.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { nextGroupColor, findExistingGroup } from '@/lib/searchGroups';
import { parseSparqlDate, datePartToYear, csvStringToDate } from '@/lib/dateUtils';
import {
  fetchEntityProperties,
  fetchEventData,
  resolveBinding,
  resolvedToPin,
  resolveWikipediaUrl,
  buildPeopleSearchPins,
  buildEventPins,
} from '@/lib/wikidataUtils';
import { InvokeLLM } from '@/integrations/Core';
import { CATEGORY_DEFS } from '@/lib/mapUtils';
import { csvRowsToEvents } from '@/lib/csvUtils';
import { buildSessionSnapshot, saveSessionBlob, loadSessionBlob } from '@/lib/sessionUtils';
import { downloadJson, readJsonFile }                              from '@/lib/fileUtils';

// Checks if a timeline group with this name already exists.
// If it does, asks the user if they want to reuse it.
// Returns { groupId, groupColor } — either existing or new.
function resolveGroupForSearch(searchName, groups) {
  const existing = findExistingGroup(searchName, groups);
  if (existing) {
    const reuse = window.confirm(
      `A timeline group called "${existing.name}" already exists.\n\nAdd new pins to it?`
    );
    if (reuse) {
      return { groupId: existing.id, groupColor: existing.color };
    }
  }
  // No match, or user declined — create a new group
  return { groupId: `search_${Date.now()}`, groupColor: nextGroupColor() };
}

export function useMapHandlers({
  // current state (read-only in handlers)
  events,
  filteredEvents,
  notes,
  groups,
  activeLayers,
  timeRange,
  comparisonEvents,
  lockedEventIds,
  markerRefs,
  // state setters
  setEvents,
  setNotes,
  setGroups,
  setComparisonEvents,
  setHiddenEventIds,
  setLockedEventIds,
  setSelectedEvent,
  setActiveLayers,
  setTimeRange,
  setSearchQuery,
  setPickingLocation,
  setIsSearching,
  setLayoutMode,
  setQueryResults,
  // console context
  con,
}) {

  // ── Pin visibility / lock ──────────────────────────────────────────────────

  const handleToggleVisible = useCallback((eventId) => {
    setHiddenEventIds(prev => {
      const n = new Set(prev);
      n.has(eventId) ? n.delete(eventId) : n.add(eventId);
      return n;
    });
  }, [setHiddenEventIds]);

  const handleToggleLock = useCallback((eventId) => {
    setLockedEventIds(prev => {
      const n = new Set(prev);
      n.has(eventId) ? n.delete(eventId) : n.add(eventId);
      return n;
    });
  }, [setLockedEventIds]);

  // ── Pin editing ───────────────────────────────────────────────────────────

  const handleEditEvent = useCallback((eventId, data) => {
    // Only propagate to the whole group if search_query is the sole field
    // being changed — that's a deliberate group rename from the layers panel.
    // All other edits (location, date, title etc.) affect only the one pin.
    const keys = Object.keys(data);
    const isGroupRenameOnly = keys.length === 1 && keys[0] === 'search_query';

    if (isGroupRenameOnly) {
      const target = events.find(e => e.id === eventId);
      if (target?.search_group) {
        setEvents(prev => prev.map(e =>
          e.search_group === target.search_group
            ? { ...e, search_query: data.search_query }
            : e
        ));
        return;
      }
    }
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...data } : e));
  }, [events, setEvents]);

  // ── Pin deletion ──────────────────────────────────────────────────────────

  const handleDeleteEvent = useCallback((eventId) => {
    if (lockedEventIds.has(eventId)) return;
    con?.log(`[map] deleted pin ${eventId}`);
    setEvents(prev => prev.filter(e => e.id !== eventId));
    setHiddenEventIds(prev => { const n = new Set(prev); n.delete(eventId); return n; });
    setLockedEventIds(prev => { const n = new Set(prev); n.delete(eventId); return n; });
  }, [lockedEventIds, setEvents, setHiddenEventIds, setLockedEventIds, con]);

  const handleClearAllPins = useCallback(() => {
    if (!window.confirm('Clear ALL pins? They will be gone for this session.')) return;
    setEvents([]);
    setHiddenEventIds(new Set());
    setLockedEventIds(new Set());
    setSelectedEvent(null);
    setComparisonEvents([]);
    con?.log('[map] all pins cleared');
  }, [setEvents, setHiddenEventIds, setLockedEventIds, setSelectedEvent, setComparisonEvents, con]);

  // ── Pin adding ────────────────────────────────────────────────────────────

  const handleAddPin = useCallback((pin) => {
    const newPin = { ...pin, source: 'User', id: `manual_${Date.now()}` };
    setEvents(prev => [...prev, newPin]);
    setPickingLocation({ active: false, lat: null, lng: null });
    con?.log(`[map] manual pin added: "${pin.title}" (${pin.year})`);
  }, [setEvents, setPickingLocation, con]);

  // ── Groups ────────────────────────────────────────────────────────────────

  const handleCreateGroup = useCallback(() => {
    const name = window.prompt('Group name:', 'My Group');
    if (!name?.trim()) return;
    const id    = `group_${Date.now()}`;
    const color = nextGroupColor();
    setGroups(prev => [...prev, { id, name: name.trim(), color }]);
    con?.log(`[map] group created: "${name.trim()}"`);
  }, [setGroups, con]);

  const handleRenameGroup = useCallback((groupId, newName) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
    setEvents(prev => prev.map(e =>
      e.search_group === groupId ? { ...e, search_query: newName } : e
    ));
    con?.log(`[map] group ${groupId} renamed to "${newName}"`);
  }, [setGroups, setEvents, con]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const handleNavigate = useCallback((targetEvent) => {
    setSelectedEvent(targetEvent);
    const marker = markerRefs.current[targetEvent.id];
    if (marker) marker.openPopup();
  }, [setSelectedEvent, markerRefs]);

  // ── Comparison ────────────────────────────────────────────────────────────

  const addToComparison = useCallback((event) => {
    if (comparisonEvents.length < 4 && !comparisonEvents.find(e => e.id === event.id)) {
      setComparisonEvents(prev => [...prev, event]);
    }
  }, [comparisonEvents, setComparisonEvents]);

  const removeFromComparison = useCallback((eventId) => {
    setComparisonEvents(prev => prev.filter(e => e.id !== eventId));
  }, [setComparisonEvents]);

  // ── Session ───────────────────────────────────────────────────────────────

    // ── Session ───────────────────────────────────────────────────────────────

 const handleSaveSession = useCallback((sessionData) => {
  const fullData = buildSessionSnapshot({ events, notes, groups, activeLayers, timeRange });
  saveSessionBlob(sessionData.id, fullData);
  con?.success(`[session] saved: "${sessionData.name}" — ${events.length} pin(s), ${notes.length} note(s)`);
}, [events, notes, groups, activeLayers, timeRange, con]);

const handleLoadSession = useCallback((sessionData) => {
  try {
    const data = loadSessionBlob(sessionData.id);
    if (data) {
      if (data.events)       setEvents(data.events);
      if (data.notes)        setNotes(data.notes);
      if (data.groups)       setGroups(data.groups);
      if (data.activeLayers) setActiveLayers(data.activeLayers);
      if (data.timeRange)    setTimeRange(data.timeRange);
      con?.success(`[session] loaded: "${sessionData.name}" — ${data.events?.length || 0} pin(s), ${data.notes?.length || 0} note(s)`);
    } else {
      if (sessionData.activeLayers) setActiveLayers(sessionData.activeLayers);
      if (sessionData.timeRange)    setTimeRange(sessionData.timeRange);
      con?.warn(`[session] "${sessionData.name}" has no saved pin data — view settings restored only`);
    }
  } catch (err) {
    con?.error(`[session] load failed: ${err.message}`);
  }
}, [setEvents, setNotes, setGroups, setActiveLayers, setTimeRange, con]);

const handleExportData = useCallback((sessionInfo) => {
  const filename = `timespast-export-${new Date().toISOString().split('T')[0]}.json`;
  downloadJson({ events, notes, session: sessionInfo }, filename);
  con?.success('[session] data exported');
}, [events, notes, con]);

const handleImportData = useCallback(async () => {
  try {
    const data = await readJsonFile();

    if (data.events?.length) {
      setEvents(data.events);

      if (data.notes?.length) {
  setNotes(data.notes);
}

      // Reconstruct groups from the imported events
      const groupMap = {};
      data.events.forEach(e => {
        if (e.search_group && !groupMap[e.search_group]) {
          groupMap[e.search_group] = {
            id:    e.search_group,
            name:  e.search_query  || e.search_group,
            color: e.search_color  || '#888888',
          };
        }
      });
      if (Object.keys(groupMap).length > 0) {
        setGroups(Object.values(groupMap));
      }
    }

    if (data.session?.activeLayers) setActiveLayers(data.session.activeLayers);
    if (data.session?.timeRange)    setTimeRange(data.session.timeRange);

    con?.success(`[session] imported ${data.events?.length || 0} pin(s)`);
  } catch (err) {
    con?.error(`[session] import failed: ${err.message}`);
  }
}, [setEvents, setNotes, setGroups, setActiveLayers, setTimeRange, con]);


  const handleClearSession = useCallback(() => {
    if (!window.confirm('Clear session? This will remove all pins and notes from the map.')) return;
    setEvents([]);
    setNotes([]);
    setGroups([]);
    setActiveLayers(['people']);
    setTimeRange({ start: -3000, end: new Date().getFullYear() });
    setSearchQuery('');
    setComparisonEvents([]);
    setSelectedEvent(null);
    setHiddenEventIds(new Set());
    setLockedEventIds(new Set());
    con?.log('[session] cleared');
  }, [setEvents, setNotes, setGroups, setActiveLayers, setTimeRange, setSearchQuery,
      setComparisonEvents, setSelectedEvent, setHiddenEventIds, setLockedEventIds, con]);



  // ── CSV import ────────────────────────────────────────────────────────────

  const handleImportEvents = useCallback((rows, fileName) => {
  const fallbackGroupId = `csv_${Date.now()}`;
  const fallbackColor   = nextGroupColor();
  const fallbackName    = fileName || 'CSV Import';

  const { events: toCreate, groups: newGroups } = csvRowsToEvents(rows, {
    fallbackGroupId,
    fallbackColor,
    fallbackName,
  });

  if (Object.keys(newGroups).length > 0) {
    setGroups(prev => {
      const existing = new Set(prev.map(g => g.id));
      return [...prev, ...Object.values(newGroups).filter(g => !existing.has(g.id))];
    });
  }

  if (toCreate.length > 0) {
    setEvents(prev => [...prev, ...toCreate]);
    con?.success(`[import] ${toCreate.length} event(s) from "${fallbackName}" across ${Object.keys(newGroups).length} group(s)`);
  }
}, [setEvents, setGroups, con]);

  // ── Layout switch ─────────────────────────────────────────────────────────

  const switchLayout = useCallback((mode) => {
    setLayoutMode(mode);
    localStorage.setItem('timespast_layout', mode);
    con?.log(`[layout] switched to ${mode}`);
  }, [setLayoutMode, con]);

  // ── Wikidata searches ─────────────────────────────────────────────────────

  const handleSparqlSearch = useCallback(async (searchTerm) => {
  if (!searchTerm.trim()) return;
  setIsSearching(true);
  con?.log(`[sparql] people search: "${searchTerm}"`);

  try {
    // Step 1 — resolve search term to QID
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchTerm)}&language=en&limit=1&format=json&origin=*`;
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) throw new Error(`Wikidata search error: ${searchResponse.statusText}`);
    const searchData = await searchResponse.json();
    const qid = searchData.search?.[0]?.id;
    if (!qid) { con?.warn(`Could not find "${searchTerm}" on Wikidata`); setIsSearching(false); return; }

    // Step 2 — build raw pins via pure library function
    const { pins, personName } = await buildPeopleSearchPins(qid, searchTerm, { con });
    if (!pins.length) { con?.warn(`[sparql] no relevant events found for "${searchTerm}"`); setIsSearching(false); return; }

    // Step 3 — assign group and IDs, commit to state
    const { groupId, groupColor } = resolveGroupForSearch(searchTerm.trim(), groups);
    const withIds = pins.map((e, i) => ({
      ...e,
      id:           `sparql_${groupId}_${i}`,
      search_group: groupId,
      search_color: groupColor,
      search_query: searchTerm.trim(),
    }));
    setEvents(prev => [...prev, ...withIds]);
    setGroups(prev => prev.find(g => g.id === groupId) ? prev : [...prev, { id: groupId, name: personName, color: groupColor }]);
    con?.success(`[sparql] added ${withIds.length} pin(s) for "${personName}"`);
  } catch (err) {
    con?.error(`[sparql] error: ${err.message}`);
  }
  setIsSearching(false);
}, [setEvents, setGroups, setIsSearching, groups, con]);

  const handleCustomQuery = useCallback(async (qid, entityLabel, activeCategories, selectedPids) => {
    setIsSearching(true);
   const { groupId, groupColor } = resolveGroupForSearch(entityLabel, groups);
   con?.log(`[custom] querying: ${entityLabel} (${qid})`);

    try {

      const active = CATEGORY_DEFS.filter(c => activeCategories.includes(c.id));
      const pids   = active.map(c => selectedPids[c.id]).filter(Boolean);

      if (!pids.length) { con?.warn('[custom] no properties selected'); setIsSearching(false); return; }

      const rows = await fetchEntityProperties(qid, pids, { con });
      if (!rows.length) { con?.warn(`[custom] no results for "${entityLabel}"`); setIsSearching(false); return; }

      const wikipediaUrl = await resolveWikipediaUrl(qid, { con });
      const newPins      = [];

      for (const row of rows) {
        for (const cat of active) {
          const pid       = selectedPids[cat.id];
          const binding   = row[`p${pid}`];
          const labelBind = row[`p${pid}Label`];

          if (!binding) {
            con?.warn(`[custom] no value for ${cat.label} (${pid}) in row ${rows.indexOf(row)}`);
            continue;
          }

          const resolved = await resolveBinding(binding, labelBind, { con });
          if (!resolved) continue;

          const pin = resolvedToPin(resolved, {
            entityLabel, groupId, groupColor,
            category:    cat.targetLayer,
            significance: 'national',
            wikipediaUrl,
          });

          if (pin) {
            con?.log(`[custom] pin: "${pin.title}" at ${pin.latitude.toFixed(3)}, ${pin.longitude.toFixed(3)}`);
            newPins.push(pin);
          }
        }
      }

      // Find pins with no resolved location (defaulted to 0,0)
const zeroPins = newPins.filter(p => p.latitude === 0 && p.longitude === 0);
const realPins = newPins.filter(p => p.latitude !== 0 || p.longitude !== 0);

if (zeroPins.length > 0) {
  // Also check existing pins in the same timeline group for a location
  const existingGroupPins = events.filter(
    e => e.search_group === groupId && (e.latitude !== 0 || e.longitude !== 0)
  );
  const locationSource = realPins[0] || existingGroupPins[0];

  if (locationSource) {
    const inherit = window.confirm(
      `${zeroPins.length} pin(s) have no location data.\n\nInherit location from "${locationSource.title}" in this timeline group?`
    );
    if (inherit) {
      zeroPins.forEach(p => {
        p.latitude  = locationSource.latitude;
        p.longitude = locationSource.longitude;
      });
      con?.log(`[custom] ${zeroPins.length} pin(s) inherited location from "${locationSource.title}"`);
    }
  } else {
    con?.warn(`[custom] ${zeroPins.length} pin(s) have no location and no source to inherit from`);
  }
}

        // Extract any image URLs from the raw rows
const imageUrl = (() => {
  for (const row of rows) {
    for (const binding of Object.values(row)) {
      const v = binding?.value || '';
      if (v.includes('Special:FilePath') || /\.(jpg|jpeg|png|gif|webp)/i.test(v)) {
        return v;
      }
    }
  }
  return null;
})();

// Attach image to all pins in this group
if (imageUrl) {
  newPins.forEach(p => { p.image_url = imageUrl; });
  con?.log(`[custom] image found: ${imageUrl}`);
}

      if (newPins.length > 0) {
        setEvents(prev => [...prev, ...newPins]);
        setGroups(prev => prev.find(g => g.id === groupId) ? prev : [...prev, { id: groupId, name: entityLabel, color: groupColor }]);
        con?.success(`[custom] added ${newPins.length} pin(s) for "${entityLabel}"`);
      } else {
        con?.warn(`[custom] no mappable results found for "${entityLabel}" — showing raw results`);
        setQueryResults?.({ rows, entityLabel });
      }
    } catch (err) {
      con?.error(`[custom] failed: ${err.message}`);
      con?.error(err.stack || '');
    }
    setIsSearching(false);
  }, [setEvents, setGroups, setIsSearching, con]);

  const handleEventSearch = useCallback(async (qid, label) => {
  if (!qid) return;
  setIsSearching(true);
  con?.log(`[events] searching: ${label} (${qid})`);

  try {
    const eventData = await fetchEventData(qid, { con });
    if (!eventData) {
      con?.warn(`[events] no data returned for "${label}"`);
      setIsSearching(false);
      return;
    }

    const { groupId, groupColor } = resolveGroupForSearch(label, groups);
    const wikipediaUrl = await resolveWikipediaUrl(qid, { con });

    const newPins = buildEventPins(eventData, label, groupId, groupColor, wikipediaUrl);

    if (newPins.length > 0) {
      setEvents(prev => [...prev, ...newPins]);
      setGroups(prev =>
        prev.find(g => g.id === groupId)
          ? prev
          : [...prev, { id: groupId, name: label, color: groupColor }]
      );
      con?.success(`[events] added ${newPins.length} pin(s) for "${label}"`);
    } else {
      con?.warn(`[events] no temporal data found for "${label}" — try Custom Query for more options`);
    }
  } catch (err) {
    con?.error(`[events] search failed: ${err.message}`);
    con?.error(err.stack || '');
  }

  setIsSearching(false);
}, [setEvents, setGroups, setIsSearching, groups, con]);

  // ── Notes ─────────────────────────────────────────────────────────────────

const handleSaveNote = useCallback((noteData) => {
  const parentPin = noteData.parent_pin_id
    ? events.find(e => e.id === noteData.parent_pin_id)
    : null;

  const groupPin = !parentPin && noteData.search_group
    ? events.find(e =>
        e.search_group === noteData.search_group &&
        (e.latitude !== 0 || e.longitude !== 0)
      )
    : null;

  const locationSource = parentPin || groupPin;

  const note = {
    ...noteData,
    id:         `note_${Date.now()}`,
    type:       'note',
    latitude:   locationSource?.latitude  ?? 0,
    longitude:  locationSource?.longitude ?? 0,
    created_at: new Date().toISOString(),
  };
  setNotes(prev => [...prev, note]);
  con?.success(`[note] saved: "${note.title}"${parentPin ? ` → attached to "${parentPin.title}"` : ''}`);
}, [events, setNotes, con]);

const handleImportNotes = useCallback((importedNotes, freshEvents = []) => {
  const allEventSources = [...events, ...freshEvents];
  const resolved = importedNotes.map(note => {
    const parentPin = note.parent_pin_id
      ? allEventSources.find(e => e.id === note.parent_pin_id)
      : null;
    const groupPin = !parentPin && note.search_group
      ? allEventSources.find(e =>
          e.search_group === note.search_group &&
          (e.latitude !== 0 || e.longitude !== 0)
        )
      : null;
    const loc = parentPin || groupPin;
    return {
      ...note,
      latitude:  loc?.latitude  ?? 0,
      longitude: loc?.longitude ?? 0,
    };
  });
  setNotes(prev => [...prev, ...resolved]);
  con?.success(`[note] imported ${resolved.length} note(s)`);
}, [events, setNotes, con]);

const handlePinNote = useCallback((noteId, pinId) => {
  setNotes(prev => prev.map(n => n.id === noteId ? { ...n, parent_pin_id: pinId } : n));
}, [setNotes]);

  // ── Return all handlers ───────────────────────────────────────────────────
  return {
    handleToggleVisible,
    handleToggleLock,
    handleEditEvent,
    handleDeleteEvent,
    handleClearAllPins,
    handleAddPin,
    handleCreateGroup,
    handleRenameGroup,
    handleNavigate,
    addToComparison,
    removeFromComparison,
    handleLoadSession,
    handleSaveSession,
    handleClearSession,
    handleExportData,
    handleImportData,
    handleImportEvents,
    switchLayout,
    handleSparqlSearch,
    handleCustomQuery,
    handleEventSearch,
    handleSaveNote,
    handleImportNotes,
    handlePinNote,
  };
}
