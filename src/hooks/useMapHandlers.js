// ── useMapHandlers.js ────────────────────────────────────────────────────────
// Custom React hook containing all Map.jsx handler logic.
// Accepts current state and setters, returns named handler functions.
// Keeps Map.jsx as a lean state + layout file.
// All handlers log to the TimesPast console via the `con` argument.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { nextGroupColor } from '@/lib/searchGroups';
import { parseSparqlDate, datePartToYear, csvStringToDate } from '@/lib/dateUtils';
import {
  fetchEntityProperties,
  fetchEventData,
  resolveBinding,
  resolvedToPin,
  resolveWikipediaUrl,
} from '@/lib/wikidataUtils';
import { InvokeLLM } from '@/integrations/Core';

// Checks if a timeline group with this name already exists.
// If it does, asks the user if they want to reuse it.
// Returns { groupId, groupColor } — either existing or new.
function resolveGroupForSearch(searchName, groups) {
  const existing = groups.find(
    g => g.name.toLowerCase() === searchName.toLowerCase()
  );
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
  groups,
  comparisonEvents,
  lockedEventIds,
  markerRefs,
  // state setters
  setEvents,
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

  const handleLoadSession = useCallback((sessionData) => {
    if (sessionData.activeLayers)       setActiveLayers(sessionData.activeLayers);
    if (sessionData.timeRange)          setTimeRange(sessionData.timeRange);

    if (sessionData.searchQuery)        setSearchQuery(sessionData.searchQuery);
    con?.log(`[session] loaded: "${sessionData.name || 'unnamed'}"`);
  }, [setActiveLayers, setTimeRange, setSearchQuery, con]);

  const handleSaveSession = useCallback((sessionData) => {
    con?.log(`[session] saved: "${sessionData.name}"`);
  }, [con]);

  const handleClearSession = useCallback(() => {
    setActiveLayers(['people']);
    setTimeRange({ start: -3000, end: new Date().getFullYear() });

    setSearchQuery('');
    setComparisonEvents([]);
    setSelectedEvent(null);
    con?.log('[session] cleared');
  }, [setActiveLayers, setTimeRange, setSearchQuery,
      setComparisonEvents, setSelectedEvent, con]);

  const handleExportData = useCallback((filteredEvents, sessionInfo) => {
    const data = { events: filteredEvents, session: sessionInfo };
    const blob  = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `timespast-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    con?.success('[session] data exported');
  }, [con]);

  const handleImportData = useCallback((onLoad) => {
    const input    = document.createElement('input');
    input.type     = 'file';
    input.accept   = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.session) onLoad(data.session);
          con?.success('[session] data imported');
        } catch (err) {
          con?.error(`[session] import failed: ${err.message}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [con]);

  // ── CSV import ────────────────────────────────────────────────────────────

  const handleImportEvents = useCallback((rows, fileName) => {
    const ts              = Date.now();
    const fallbackGroupId = `csv_${ts}`;
    const fallbackColor   = nextGroupColor();
    const fallbackName    = fileName || 'CSV Import';
    const newGroups       = {};

    const toCreate = rows.filter(r => r.title).map((r, i) => {
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
        id:           r.id || `${groupId}_imported_${i}`,
        title:        r.title, year, date: parsedDate,
        latitude:     parseFloat(r.latitude)  || 0,
        longitude:    parseFloat(r.longitude) || 0,
        category:     r.category?.toLowerCase().replace(' ', '_') || 'events',
        significance: r.significance?.toLowerCase() || 'local',
        description:  r.description  || '',
        wikipedia_url: r.wikipedia_url || '',
        source:       r.source || 'CSV Import',
        search_group: groupId, search_query: groupName, search_color: groupColor,
      };
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
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchTerm)}&language=en&limit=1&format=json&origin=*`;
      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) throw new Error(`Wikidata search error: ${searchResponse.statusText}`);
      const searchData = await searchResponse.json();
      const qId = searchData.search?.[0]?.id;
      if (!qId) { con?.warn(`Could not find "${searchTerm}" on Wikidata`); setIsSearching(false); return; }

      const propDefs = [
        { id: 'P569', label: 'Birth', sparqlVar: 'birthDate', placeId: 'P19', placeVar: 'birthPlace' },
        { id: 'P570', label: 'Death', sparqlVar: 'deathDate', placeId: 'P20', placeVar: 'deathPlace' },
      ];

      let selectClause = 'SELECT ?itemLabel ?wikipediaUrl';
      let whereClause  = `
        OPTIONAL {
          ?article schema:about wd:${qId};
                   schema:isPartOf <https://en.wikipedia.org/>;
                   schema:name ?wikipediaTitle.
          BIND(IRI(CONCAT("https://en.wikipedia.org/wiki/", ENCODE_FOR_URI(?wikipediaTitle))) AS ?wikipediaUrl)
        }`;

      propDefs.forEach(prop => {
        selectClause += ` ?${prop.sparqlVar}`;
        if (prop.placeVar) selectClause += ` ?${prop.placeVar}Label ?${prop.placeVar}Coords`;
        whereClause += `
          OPTIONAL {
            wd:${qId} wdt:${prop.id} ?${prop.sparqlVar}.
            ${prop.placeVar ? `OPTIONAL {
              wd:${qId} wdt:${prop.placeId} ?${prop.placeVar}.
              ?${prop.placeVar} wdt:P625 ?${prop.placeVar}Coords.
            }` : ''}
          }`;
      });

      const sparqlQuery = `${selectClause} WHERE { ${whereClause} SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". } } LIMIT 1`;
      const endpointUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
      const queryResponse = await fetch(endpointUrl, { headers: { Accept: 'application/sparql-results+json' } });
      if (!queryResponse.ok) throw new Error(`SPARQL error: ${queryResponse.statusText}`);
      const queryData = await queryResponse.json();
      const results   = queryData.results.bindings;
      if (!results.length) { con?.warn(`No data found for "${searchTerm}"`); setIsSearching(false); return; }

      const row         = results[0];
      const personName  = row.itemLabel?.value || searchTerm;
      const wikipediaUrl = row.wikipediaUrl?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(personName)}`;
      const { groupId, groupColor } = resolveGroupForSearch(searchTerm.trim(), groups);
      const newEvents = [];

      propDefs.forEach(prop => {
        if (!row[prop.sparqlVar]) return;
        const datePart = parseSparqlDate(row[prop.sparqlVar].value);
        const year     = datePartToYear(datePart);
        if (!year) return;

        let latitude = 0, longitude = 0, locationDescription = 'an unknown location';
        if (prop.placeVar) {
          const coordsBinding = row[`${prop.placeVar}Coords`];
          if (coordsBinding?.value) {
            const parts = coordsBinding.value.replace('Point(', '').replace(')', '').split(' ');
            longitude = parseFloat(parts[0]); latitude = parseFloat(parts[1]);
          }
          const labelBinding = row[`${prop.placeVar}Label`];
          if (labelBinding?.value) locationDescription = labelBinding.value;
        }

        newEvents.push({
          title:        `${personName} — ${prop.label}`,
          description:  `${prop.label} of ${personName}${prop.placeVar ? ` in ${locationDescription}` : ''}.`,
          year, date: { start: datePart, end: null },
          latitude, longitude,
          category: 'people', significance: 'global',
          source: 'Wikidata SPARQL', wikipedia_url: wikipediaUrl,
          search_group: groupId, search_color: groupColor, search_query: searchTerm.trim(),
        });
      });

      if (newEvents.length > 0) {
        const withIds = newEvents.map((e, i) => ({ ...e, id: `sparql_${groupId}_${i}` }));
        setEvents(prev => [...prev, ...withIds]);
        setGroups(prev => prev.find(g => g.id === groupId) ? prev : [...prev, { id: groupId, name: searchTerm.trim(), color: groupColor }]);
        con?.success(`[sparql] added ${withIds.length} pin(s) for "${personName}"`);
      } else {
        con?.warn(`[sparql] no relevant events found for "${personName}"`);
      }
    } catch (err) {
      con?.error(`[sparql] error: ${err.message}`);
    }
    setIsSearching(false);
  }, [setEvents, setGroups, setIsSearching, con]);

  const handleCustomQuery = useCallback(async (qid, entityLabel, activeCategories, selectedPids) => {
    setIsSearching(true);
   const { groupId, groupColor } = resolveGroupForSearch(entityLabel, groups);
   con?.log(`[custom] querying: ${entityLabel} (${qid})`);

    try {
      const CATEGORY_DEFS = [
        { id: 'people',          targetLayer: 'people'          },
        { id: 'organisations',   targetLayer: 'organisations'   },
        { id: 'livingEntities',  targetLayer: 'livingEntities'  },
        { id: 'artificialAgents',targetLayer: 'artificialAgents'},
        { id: 'events',          targetLayer: 'events'          },
        { id: 'phenomena',       targetLayer: 'phenomena'       },
        { id: 'conflicts',       targetLayer: 'conflicts'       },
        { id: 'places',          targetLayer: 'places'          },
        { id: 'objects',         targetLayer: 'objects'         },
        { id: 'technology',      targetLayer: 'technology'      },
        { id: 'works',           targetLayer: 'works'           },
        { id: 'concepts',        targetLayer: 'concepts'        },
        { id: 'sciences',        targetLayer: 'sciences'        },
        { id: 'weather',         targetLayer: 'weather'         },
      ];
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
    // Step 1 — fetch structured event data via the pipeline
    const eventData = await fetchEventData(qid, { con });
    if (!eventData) {
      con?.warn(`[events] no data returned for "${label}"`);
      setIsSearching(false);
      return;
    }

    const { lat, lng, locationLabel, startDate, endDate, pointInTime } = eventData;

    // Step 2 — resolve or reuse a timeline group
    const { groupId, groupColor } = resolveGroupForSearch(label, groups);
    const wikipediaUrl = await resolveWikipediaUrl(qid, { con });

    const basePin = {
      latitude:      lat  ?? 0,
      longitude:     lng  ?? 0,
      category:      'events',
      significance:  'global',
      source:        'Wikidata Events',
      search_group:  groupId,
      search_color:  groupColor,
      search_query:  label,
      wikipedia_url: wikipediaUrl || '',
      links:         wikipediaUrl ? [{ label: 'Wikipedia', url: wikipediaUrl }] : [],
    };

    const newPins = [];

    if (pointInTime && !startDate && !endDate) {
      // Single point-in-time event — one pin
      const datePart = parseSparqlDate(pointInTime);
      const year     = datePartToYear(datePart);
      newPins.push({
        ...basePin,
        id:          `event_${groupId}_0`,
        title:       label,
        description: `${label}${locationLabel ? ` at ${locationLabel}` : ''}.`,
        year,
        date: { start: datePart, end: null },
      });
      con?.log(`[events] point-in-time pin: "${label}" (${year})`);

    } else {
      // Range event — start pin and/or end pin connected by polyline
      if (startDate) {
        const datePart = parseSparqlDate(startDate);
        const year     = datePartToYear(datePart);
        newPins.push({
          ...basePin,
          id:          `event_${groupId}_start`,
          title:       `${label} — Start`,
          description: `Start of ${label}${locationLabel ? ` at ${locationLabel}` : ''}.`,
          year,
          date: { start: datePart, end: null },
        });
        con?.log(`[events] start pin: ${year}`);
      }

      if (endDate) {
        const datePart = parseSparqlDate(endDate);
        const year     = datePartToYear(datePart);
        newPins.push({
          ...basePin,
          id:          `event_${groupId}_end`,
          title:       `${label} — End`,
          description: `End of ${label}${locationLabel ? ` at ${locationLabel}` : ''}.`,
          year,
          date: { start: datePart, end: null },
        });
        con?.log(`[events] end pin: ${year}`);
      }
    }

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
  };
}
