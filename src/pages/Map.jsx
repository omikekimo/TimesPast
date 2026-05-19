import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import { InvokeLLM } from "@/integrations/Core";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPageContext } from "../components/context/MapPageContext";
import { LayoutContext } from "../components/context/LayoutContext";
import { nextGroupColor } from "../lib/searchGroups";

function promptGroupName(defaultName = "") {
  return window.prompt("Group name:", defaultName);
}
//import { parseSparqlDate, datePartToYear } from "@/lib/dateUtils";
import EventSearchPanel from "../components/map/SearchPanel";
import SparqlSearchPanel from "../components/layers/SparqlSearchPanel";
import LayerSwitcher from "../components/layers/LayerSwitcher";
import DataTimelineControls from "../components/map/DataTimelineControls";
import EventDetails from "../components/map/EventDetails";
import EventComparison from "../components/map/EventComparison";
import SidebarSessionControls from "../components/session/SidebarSessionControls";
import GlobeView from "../components/ui/GlobeView";
import DraggablePanel from "../components/ui/DraggablePanel";
import { ConsoleProvider, useConsole } from "../components/console/ConsoleContext";
import CustomQueryPanel from "../components/layers/CustomQueryPanel";
import ConsolePanel from "../components/console/ConsolePanel";
import AboutPanel from "../components/ui/AboutPanel";
import { parseSparqlDate, datePartToYear, formatPinDate, migrateLegacyPin, csvStringToDate } from "@/lib/dateUtils";

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const categoryColors = {
  war: "#dc2626",
  politics: "#7c3aed",
  culture: "#059669",
  science: "#2563eb",
  natural_disaster: "#ea580c",
  economics: "#ca8a04",
  religion: "#9333ea",
  exploration: "#0891b2",
  person: "#f59e0b"
};

const createCustomIcon = (category, significance, isHovered = false, overrideColor = null) => {
  const color = overrideColor || categoryColors[category] || "#6b7280";
  const baseSize = significance === "global" ? 30 : significance === "national" ? 25 : 20;
  const size = isHovered ? Math.round(baseSize * 1.6) : baseSize;
  const label = category === 'person' ? 'P' : category.charAt(0).toUpperCase();

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: white;
        font-weight: bold;
      ">
        ${label}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 200);
  }, [map]);
  return null;
}

// Fan out markers that share the same lat/lng so they don't overlap.
// The offset radius is in degrees (~1km at equator) — small enough to stay "at" the location.
function spreadStackedMarkers(events) {
  const RADIUS = 0.003; // ~300m spread
  const key = (e) => `${e.latitude.toFixed(4)},${e.longitude.toFixed(4)}`;
  const groups = {};
  events.forEach(e => {
    const k = key(e);
    if (!groups[k]) groups[k] = [];
    groups[k].push(e);
  });
  const result = {};
  Object.values(groups).forEach(group => {
    if (group.length === 1) {
      result[group[0].id] = { lat: group[0].latitude, lng: group[0].longitude };
    } else {
      group.forEach((e, i) => {
        const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
        result[e.id] = {
          lat: e.latitude + RADIUS * Math.cos(angle),
          lng: e.longitude + RADIUS * Math.sin(angle),
        };
      });
    }
  });
  return result;
}

function MapClickHandler({ picking, onPick }) {
  useMapEvents({
    click(e) {
      if (picking) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  });
  return null;
}

function MapPageInner() {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [dataLayers, setDataLayers] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [comparisonEvents, setComparisonEvents] = useState([]);
  const [timeRange, setTimeRange] = useState({ start: -3000, end: new Date().getFullYear() });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [activeLayers, setActiveLayers] = useState(['people']);
  const [currentView, setCurrentView] = useState('map');
  const [hiddenEventIds, setHiddenEventIds] = useState(new Set());
  const [lockedEventIds, setLockedEventIds] = useState(new Set());
  const [hoveredEventId, setHoveredEventId] = useState(null);
  const [pickingLocation, setPickingLocation] = useState({ active: false, lat: null, lng: null });
  const [groups, setGroups] = useState([]); // { id, name, color }
  const markerRefs = useRef({});  // eventId -> leaflet marker instance
  const layoutContext = useContext(LayoutContext);
  const setSidebarControls = layoutContext?.setSidebarControls;
  const con = useConsole();

  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    filterEvents();
  }, [events, timeRange, selectedCategories, searchQuery, activeLayers]);

  const filterEvents = () => {
    let layerFilteredEvents = events.filter(event => {
      if (activeLayers.includes('events') && event.category !== 'person') return true;
      if (activeLayers.includes('people') && event.category === 'person') return true;
      if (activeLayers.includes('customQueries') && event.source === 'Wikidata Custom Query') return true;
      return false;
    });

    let filtered = layerFilteredEvents.filter(event => {
      const withinTimeRange = event.year >= timeRange.start && event.year <= timeRange.end;
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(event.category);
      const matchesSearch = !searchQuery ||
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchQuery.toLowerCase());

      return withinTimeRange && matchesCategory && matchesSearch;
    });

    setFilteredEvents(filtered);
  };

  const handleEventSearch = async (query) => {
    if (!query.trim()) {
      setSearchQuery("");
      return;
    }
    setIsSearching(true);
    const groupId = `ai_${Date.now()}`;
    const groupColor = nextGroupColor();
    try {
      const result = await InvokeLLM({
        prompt: `Search for historical events related to: "${query}". Return relevant events with location data if possible.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            events: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  year: { type: "number" },
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                  category: { type: "string" },
                  description: { type: "string" },
                  significance: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (result.events && result.events.length > 0) {
        const newEvents = result.events.map((event, i) => ({
          ...event,
          id: `ai_${groupId}_${i}`,
          source: "AI_Search",
          search_group: groupId,
          search_color: groupColor,
          search_query: query.trim(),
        }));
        setEvents(prev => [...prev, ...newEvents]);
      }
      setSearchQuery(""); // clear text filter so all pins stay visible
    } catch (error) {
      con.error("Search error:", error);
      setSearchQuery("");
    }
    setIsSearching(false);
  };

  const handleCustomQuery = async (searchText, activeCategories, selectedPids) => {
  setIsSearching(true);
  const groupId = `custom_${Date.now()}`;
  const groupColor = nextGroupColor();

  try {
    // Step 1: resolve search text to a Wikidata Q-id
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchText)}&language=en&limit=1&format=json&origin=*`;
    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json();
    const qId = searchData.search?.[0]?.id;
    if (!qId) { con.warn(`Could not find "${searchText}" on Wikidata.`); }

    const entityLabel = searchData.search[0].label || searchText;

    // Step 2: build SPARQL from selected categories + properties
    const CATEGORY_DEFS = [
      { id: "generic", sparqlVar: "generic" },
      { id: "person",  sparqlVar: "person" },
      { id: "place",   sparqlVar: "place" },
      { id: "event",   sparqlVar: "event" },
      { id: "works",   sparqlVar: "works" },
      { id: "organisation", sparqlVar: "organisation" },
    ];

    const active = CATEGORY_DEFS.filter(c => activeCategories.includes(c.id));
    const selectVars = active.map(c => `?${c.sparqlVar} ?${c.sparqlVar}Label ?${c.sparqlVar}Coords`).join(" ");
    const triples = active.map(c => `
      OPTIONAL {
        wd:${qId} wdt:${selectedPids[c.id]} ?${c.sparqlVar} .
        OPTIONAL { ?${c.sparqlVar} wdt:P625 ?${c.sparqlVar}Coords . }
      }`).join("");

    const sparql = `
      SELECT ${selectVars}
      WHERE {
        ${triples}
        SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
      } LIMIT 20`;

    const endpoint = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    const resp = await fetch(endpoint, { headers: { Accept: "application/sparql-results+json" } });
    if (!resp.ok) throw new Error("Wikidata SPARQL error");
    const data = await resp.json();
    const rows = data.results.bindings;

    // Step 3: turn results into map pins
    const newEvents = [];
    rows.forEach((row, i) => {
      active.forEach(cat => {
        const val = row[cat.sparqlVar];
        const coords = row[`${cat.sparqlVar}Coords`];
        const label = row[`${cat.sparqlVar}Label`];
        if (!val) return;

        let latitude = 0, longitude = 0;
        if (coords?.value) {
          const parts = coords.value.replace("Point(", "").replace(")", "").split(" ");
          longitude = parseFloat(parts[0]);
          latitude = parseFloat(parts[1]);
        }

        // Try to parse a year from the value
        const datePart = parseSparqlDate(val.value);
        const year = datePartToYear(datePart);

        newEvents.push({
          id: `custom_${groupId}_${cat.id}_${i}`,
          title: `${entityLabel} — ${label?.value || val.value}`,
          description: `${cat.label} property result for ${entityLabel}.`,
          year: year || new Date().getFullYear(),
          date: { start: datePart, end: null },
          latitude,
          longitude,
          category: cat.id === "person" ? "person" : cat.id === "event" ? "war" : "culture",
          significance: "national",
          source: "Wikidata Custom Query",
          search_group: groupId,
          search_query: searchText,
          search_color: groupColor,
          wikipedia_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(entityLabel.replace(/ /g, "_"))}`,
        });
      });
    });

    if (newEvents.length > 0) {
      setEvents(prev => [...prev, ...newEvents]);
      // Register the group so it appears in dropdowns
      setGroups(prev => {
      if (prev.find(g => g.id === groupId)) return prev;
       return [...prev, { id: groupId, name: searchText.trim(), color: groupColor }];
    });
     con.success(`Added ${newEvents.length} pin(s) for "${entityLabel}".`);
}
    else {
      con.warn(`No mappable results found for "${searchText}" with the selected properties.`);
    }
  } catch (err) {
    con.error("Custom query error:", err);
    con.warn("Query failed — check the console for details.");
  }
  setIsSearching(false);
};

  const handleSparqlSearch = async (searchTerm, properties) => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    con.log(`SPARQL people search: "${searchTerm}"`);

    try {
      // Step 1: Resolve entity ID
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchTerm)}&language=en&limit=1&format=json&origin=*`;
      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) throw new Error(`Wikidata search API error: ${searchResponse.statusText}`);
      const searchData = await searchResponse.json();
      const qId = searchData.search?.[0]?.id;
      if (!qId) { con.warn(`Could not find a Wikidata entry for "${searchTerm}"`); setIsSearching(false); return; }

      // Step 2: Build SPARQL for birth/death/floruit + Wikipedia sitelink
      const propDefs = [
        { id: 'P569',  label: 'Birth',   sparqlVar: 'birthDate',  placeId: 'P19',  placeVar: 'birthPlace' },
        { id: 'P570',  label: 'Death',   sparqlVar: 'deathDate',  placeId: 'P20',  placeVar: 'deathPlace' },
        { id: 'P1317', label: 'Floruit', sparqlVar: 'floruitDate', placeId: null,  placeVar: null },
      ];

      let selectClause = "SELECT ?itemLabel ?wikipediaUrl";
      let whereClause = `
        OPTIONAL {
          ?article schema:about wd:${qId};
                   schema:isPartOf <https://en.wikipedia.org/>;
                   schema:name ?wikipediaTitle.
          BIND(IRI(CONCAT("https://en.wikipedia.org/wiki/", ENCODE_FOR_URI(?wikipediaTitle))) AS ?wikipediaUrl)
        }
      `;

      propDefs.forEach(prop => {
        if (!properties.includes(prop.id)) return;
        selectClause += ` ?${prop.sparqlVar}`;
        if (prop.placeVar) selectClause += ` ?${prop.placeVar}Label ?${prop.placeVar}Coords`;
        whereClause += `
          OPTIONAL {
            wd:${qId} wdt:${prop.id} ?${prop.sparqlVar}.
            ${prop.placeVar ? `OPTIONAL {
              wd:${qId} wdt:${prop.placeId} ?${prop.placeVar}.
              ?${prop.placeVar} wdt:P625 ?${prop.placeVar}Coords.
            }` : ''}
          }
        `;
      });

      const sparqlQuery = `
        ${selectClause}
        WHERE {
          ${whereClause}
          SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
        } LIMIT 1
      `;

      const endpointUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
      const queryResponse = await fetch(endpointUrl, { headers: { 'Accept': 'application/sparql-results+json' } });
      if (!queryResponse.ok) throw new Error(`Wikidata SPARQL API error: ${queryResponse.statusText}`);
      const queryData = await queryResponse.json();

      const results = queryData.results.bindings;
      if (!results.length) { con.warn(`No data found for "${searchTerm}" on Wikidata.`); setIsSearching(false); return; }

      const row = results[0];
      const personName = row.itemLabel?.value || searchTerm;
      const wikipediaUrl = row.wikipediaUrl?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(personName)}`;

      // Step 3: Build events
      const groupId = `sparql_${Date.now()}`;
      const groupColor = nextGroupColor();
      const newEvents = [];

      propDefs.forEach(prop => {
        if (!properties.includes(prop.id) || !row[prop.sparqlVar]) return;
        const dateString = row[prop.sparqlVar].value;
        const datePart = parseSparqlDate(dateString);
        const year = datePartToYear(datePart);
        if (!year) return;

        let latitude = 0;
        let longitude = 0;
        let locationDescription = 'an unknown location';

        if (prop.placeVar) {
          const coordsBinding = row[`${prop.placeVar}Coords`];
          if (coordsBinding?.value) {
            const parts = coordsBinding.value.replace('Point(', '').replace(')', '').split(' ');
            longitude = parseFloat(parts[0]);
            latitude = parseFloat(parts[1]);
          }
          const labelBinding = row[`${prop.placeVar}Label`];
          if (labelBinding?.value) locationDescription = labelBinding.value;
        }

        newEvents.push({
          title: `${personName} — ${prop.label}`,
          description: `${prop.label} of ${personName}${prop.placeVar ? ` in ${locationDescription}` : ''}.`,
          year,
          date: { start: datePart, end: null },
          latitude,
          longitude,
          category: 'person',
          significance: 'global',
          source: 'Wikidata SPARQL',
          wikipedia_url: wikipediaUrl,  // verified URL from Wikidata
          search_group: groupId,
          search_color: groupColor,
          search_query: searchTerm.trim(),
        });
      });

      if (newEvents.length > 0) {
          const withIds = newEvents.map((e, i) => ({ ...e, id: `sparql_${groupId}_${i}` }));
          setEvents(prev => [...prev, ...withIds]);
          // Register the group so it appears in dropdowns
          setGroups(prev => {
            if (prev.find(g => g.id === groupId)) return prev;
            return [...prev, { id: groupId, name: searchTerm.trim(), color: groupColor }];
            });
          con.success(`Added ${withIds.length} pin(s) for "${personName}".`);
      }

      else {
        con.warn(`No relevant events found for "${personName}" with the selected properties.`);
      }

    } catch (error) {
      con.error("SPARQL search error:", error);
      con.error("An error occurred while querying Wikidata. Check console for details.");
    }

    setIsSearching(false);
  };

  const getCurrentSessionInfo = useCallback(() => ({
    eventCount: filteredEvents.length,
    activeLayers,
    timeRange,
    selectedCategories,
    searchQuery
  }), [filteredEvents.length, activeLayers, timeRange, selectedCategories, searchQuery]);

  const handleSaveSession = (sessionData) => {
    con.log('Session saved:', sessionData);
  };

  const handleLoadSession = (sessionData) => {
    if (sessionData.activeLayers) setActiveLayers(sessionData.activeLayers);
    if (sessionData.timeRange) setTimeRange(sessionData.timeRange);
    if (sessionData.selectedCategories) setSelectedCategories(sessionData.selectedCategories);
    if (sessionData.searchQuery) setSearchQuery(sessionData.searchQuery);
    con.log('Session loaded:', sessionData);
  };

  const handleClearSession = () => {
    setActiveLayers(['events']);
    setTimeRange({ start: -3000, end: new Date().getFullYear() });
    setSelectedCategories([]);
    setSearchQuery("");
    setComparisonEvents([]);
    setSelectedEvent(null);
    con.log('Session cleared');
  };

  const handleExportData = () => {
    const data = {
      events: filteredEvents,
      session: getCurrentSessionInfo()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timespast-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    con.success('Data exported.');
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            if (data.session) {
              handleLoadSession(data.session);
            }
            con.success('Data imported successfully');
          } catch (error) {
            con.error('Error importing data:', error);
            alert('Error importing data. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleToggleVisible = (eventId) => {
    setHiddenEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const handleToggleLock = (eventId) => {
    setLockedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const handleEditEvent = (eventId, data) => {
  // ONLY propagate to the whole group if search_query is the
  // sole field being changed (i.e. a deliberate group rename
  // coming from the old layers-panel path).
  // All other edits — including location, year, title, group
  // reassignment from the modal — must only affect the one pin.
  const keys = Object.keys(data);
  const isGroupRenameOnly = keys.length === 1 && keys[0] === 'search_query';

  if (isGroupRenameOnly) {
    const targetEvent = events.find(e => e.id === eventId);
    if (targetEvent?.search_group) {
      setEvents(prev => prev.map(e =>
        e.search_group === targetEvent.search_group
          ? { ...e, search_query: data.search_query }
          : e
      ));
      return;
    }
  }

  // Default: only update the single pin
  setEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...data } : e));
};

  const handleDeleteEvent = (eventId) => {
    if (lockedEventIds.has(eventId)) return;
    setEvents(prev => prev.filter(e => e.id !== eventId));
    setHiddenEventIds(prev => { const n = new Set(prev); n.delete(eventId); return n; });
    setLockedEventIds(prev => { const n = new Set(prev); n.delete(eventId); return n; });
  };

  const handleClearAllPins = () => {
    if (!window.confirm("Clear ALL pins? They will be gone for this session.")) return;
    setEvents([]);
    setFilteredEvents([]);
    setHiddenEventIds(new Set());
    setLockedEventIds(new Set());
    setSelectedEvent(null);
    setComparisonEvents([]);
    con.log('All pins cleared.');
  };

  const handleCreateGroup = () => {
    const name = promptGroupName("My Group");
    if (!name?.trim()) return;
    const id = `group_${Date.now()}`;
    const color = nextGroupColor();
    setGroups(prev => [...prev, { id, name: name.trim(), color }]);
    con.log(`Group created: "${name.trim()}"`);
  };

  const handleNavigate = (targetEvent) => {
    setSelectedEvent(targetEvent);
    // Open the map popup for that marker
    const marker = markerRefs.current[targetEvent.id];
    if (marker) {
      marker.openPopup();
    }
  };

  const handleRenameGroup = (groupId, newName) => {
  // Update the groups array so dropdowns reflect the new name
  setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
  // Also update search_query on all events in this group
  setEvents(prev => prev.map(e =>
    e.search_group === groupId ? { ...e, search_query: newName } : e
  ));
};

  const addToComparison = (event) => {
    if (comparisonEvents.length < 4 && !comparisonEvents.find(e => e.id === event.id)) {
      setComparisonEvents([...comparisonEvents, event]);
    }
  };

  const removeFromComparison = (eventId) => {
    setComparisonEvents(comparisonEvents.filter(e => e.id !== eventId));
  };


  const sessionControlHandlers = {
    onSaveSession: handleSaveSession,
    onLoadSession: handleLoadSession,
    onClearSession: handleClearSession,
    onExportData: handleExportData,
    onImportData: handleImportData,
    currentSessionInfo: getCurrentSessionInfo(),
  };

  useEffect(() => {
    if (setSidebarControls) {
      setSidebarControls(<SidebarSessionControls {...sessionControlHandlers} />);
    }
    // Cleanup sidebar when component unmounts
    return () => {
      if (setSidebarControls) {
        setSidebarControls(null);
      }
    };
  }, [setSidebarControls, sessionControlHandlers]);

  return (
    <MapPageContext.Provider value={{ currentView, setCurrentView }}>
      <div style={{ height: "100vh", width: "100%", position: "relative" }}>
        <DraggablePanel initialPosition={{ x: 24, y: 24 }} dragHandleClassName="drag-handle">
          <LayerSwitcher activeLayers={activeLayers} onLayerToggle={setActiveLayers} />
        </DraggablePanel>

        {activeLayers.includes('about') && (
          <DraggablePanel initialPosition={{ x: window.innerWidth / 2 - 192, y: 80 }} dragHandleClassName="drag-handle">
            <AboutPanel />
          </DraggablePanel>
        )}

        {activeLayers.includes('events') && (
          <DraggablePanel initialPosition={{ x: 24, y: 300 }} dragHandleClassName="drag-handle">
            <EventSearchPanel
              onSearch={handleEventSearch}
              isSearching={isSearching}
              selectedCategories={selectedCategories}
              onCategoryChange={setSelectedCategories}
            />
          </DraggablePanel>
        )}
        {activeLayers.includes('people') && (
          <DraggablePanel initialPosition={{ x: 24, y: 300 }} dragHandleClassName="drag-handle">
            <SparqlSearchPanel
              onSearch={handleSparqlSearch}
              isSearching={isSearching}
            />
          </DraggablePanel>
        )}
        {activeLayers.includes('customQueries') && (
         <DraggablePanel initialPosition={{ x: 24, y: 300 }} dragHandleClassName="drag-handle">
           <CustomQueryPanel
              onSearch={handleCustomQuery}
              isSearching={isSearching}
           />
         </DraggablePanel>
        )}
        {/* Merged Data & Timeline Controls */}
        <DraggablePanel initialPosition={{ x: (window.innerWidth / 2) - 400, y: window.innerHeight - 230 }} dragHandleClassName="drag-handle">
          <DataTimelineControls
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            eventCount={filteredEvents.length}
            events={filteredEvents}
            hiddenEventIds={hiddenEventIds}
            lockedEventIds={lockedEventIds}
            onToggleVisible={handleToggleVisible}
            onToggleLock={handleToggleLock}
            onDeleteEvent={handleDeleteEvent}
            onHoverEvent={setHoveredEventId}
            onEditEvent={handleEditEvent}
            onSelectEvent={handleNavigate}
            pickingLocation={pickingLocation}
            onRenameGroup={handleRenameGroup}
            onStartPickLocation={() => setPickingLocation(p => ({ ...p, active: !p.active, lat: null, lng: null }))}
            onAddPin={(pin) => {
              const newPin = { ...pin, source: "User", id: `manual_${Date.now()}` };
              setEvents(prev => [...prev, newPin]);
              setPickingLocation({ active: false, lat: null, lng: null });
              con.log(`Manual pin added: "${pin.title}" (${pin.year})`);
            }}
            onClearAll={handleClearAllPins}
            groups={groups}
            onCreateGroup={handleCreateGroup}
            onImportEvents={(rows, fileName) => {
  const ts = Date.now();
  const fallbackGroupId = `csv_${ts}`;
  const fallbackColor = nextGroupColor();
  const fallbackName = fileName || "CSV Import";

  // Collect any new groups we need to register
  const newGroups = {};

  const toCreate = rows.filter(r => r.title).map((r, i) => {
  // Use existing group data from CSV if present
  const groupId   = r.search_group || fallbackGroupId;
  const groupColor = r.search_color || fallbackColor;
  const groupName  = r.search_query || fallbackName;

  const parsedDate = r.date ? csvStringToDate(r.date) : null;
  const year = parsedDate
    ? datePartToYear(parsedDate.start)
    : (parseInt(r.year, 10) || 0);

  return {
    id:           `${groupId}_imported_${i}`,
    title:        r.title,
    year,
    date:         parsedDate,
    latitude:     parseFloat(r.latitude)  || 0,
    longitude:    parseFloat(r.longitude) || 0,
    category:     r.category?.toLowerCase().replace(" ", "_") || "culture",
    significance: r.significance?.toLowerCase() || "local",
    description:  r.description  || "",
    wikipedia_url: r.wikipedia_url || "",
    source:       r.source || "CSV Import",
    search_group: groupId,
    search_query: groupName,
    search_color: groupColor,
  };
});

  if (Object.keys(newGroups).length > 0) {
    setGroups(prev => {
      const existingIds = new Set(prev.map(g => g.id));
      const toAdd = Object.values(newGroups).filter(g => !existingIds.has(g.id));
      return [...prev, ...toAdd];
    });
  }

  if (toCreate.length > 0) {
    setEvents(prev => [...prev, ...toCreate]);
    con.success(`Imported ${toCreate.length} event(s) from "${fallbackName}" across ${Object.keys(newGroups).length} group(s).`);
  }
}}
          />
        </DraggablePanel>

        {/* Sidebar Session Controls - DraggablePanel removed as it's now controlled by LayoutContext */}


        {currentView === 'map' ? (
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "100%", cursor: pickingLocation.active ? "crosshair" : "" }}
            className="z-0"
          >
            <MapResizer />
            <MapClickHandler
              picking={pickingLocation.active}
              onPick={(latlng) => setPickingLocation({ active: false, lat: latlng.lat, lng: latlng.lng })}
            />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />

            {/* Polylines connecting pins in the same search group */}
            {(() => {
              const visible = filteredEvents.filter(e => !hiddenEventIds.has(e.id) && e.search_group);
              const groups = {};
              visible.forEach(e => {
                if (!groups[e.search_group]) groups[e.search_group] = [];
                groups[e.search_group].push(e);
              });
              return Object.entries(groups).map(([gid, gevents]) => {
                if (gevents.length < 2) return null;
                const sorted = [...gevents].sort((a, b) => a.year - b.year);
                const positions = sorted.map(e => [e.latitude, e.longitude]);
                const color = sorted[0].search_color || "#6b7280";
                return (
                  <Polyline
                    key={gid}
                    positions={positions}
                    pathOptions={{ color, weight: 2, opacity: 0.7, dashArray: "6 4" }}
                  />
                );
              });
            })()}

            {(() => {
              const visibleEvents = filteredEvents.filter(e => !hiddenEventIds.has(e.id));
              const positions = spreadStackedMarkers(visibleEvents);
              return visibleEvents.map((event) => {
                const isHovered = hoveredEventId === event.id;
                const pos = positions[event.id] || { lat: event.latitude, lng: event.longitude };
                const grp = event.search_group
                  ? filteredEvents.filter(e => e.search_group === event.search_group).sort((a,b) => a.year - b.year)
                  : [];
                const idx = grp.findIndex(e => e.id === event.id);
                const prev = idx > 0 ? grp[idx - 1] : null;
                const next = idx < grp.length - 1 ? grp[idx + 1] : null;
                return (
                  <Marker
                    key={event.id}
                    position={[pos.lat, pos.lng]}
                    icon={createCustomIcon(event.category, event.significance, isHovered, event.search_color || null)}
                    ref={(ref) => { if (ref) markerRefs.current[event.id] = ref; }}
                    eventHandlers={{ click: () => setSelectedEvent(event) }}
                  >
                    <Popup>
                      <div className="p-2 max-w-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-base text-gray-900">{event.title}</h3>
                          {event.search_color && (
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: event.search_color }} />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-1">
                        {formatPinDate(migrateLegacyPin(event).date)}
                        </p>
                        <p className="text-sm text-gray-700 mb-3 line-clamp-3">{event.description}</p>

                        {grp.length > 1 && (
                          <div className="flex gap-1 mb-2">
                            <button
                              disabled={!prev}
                              onClick={() => prev && handleNavigate(prev)}
                              className="flex-1 text-xs flex items-center justify-center gap-0.5 border border-gray-300 rounded px-2 py-1 disabled:opacity-30 hover:bg-gray-50"
                            >
                              ‹ {prev ? (prev.year < 0 ? `${Math.abs(prev.year)} BCE` : prev.year) : ""}
                            </button>
                            <span className="text-xs text-gray-400 self-center px-1">{idx+1}/{grp.length}</span>
                            <button
                              disabled={!next}
                              onClick={() => next && handleNavigate(next)}
                              className="flex-1 text-xs flex items-center justify-center gap-0.5 border border-gray-300 rounded px-2 py-1 disabled:opacity-30 hover:bg-gray-50"
                            >
                              {next ? (next.year < 0 ? `${Math.abs(next.year)} BCE` : next.year) : ""} ›
                            </button>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedEvent(event)}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full hover:bg-blue-700 transition-colors"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => addToComparison(event)}
                            className="text-xs bg-gray-600 text-white px-3 py-1 rounded-full hover:bg-gray-700 transition-colors"
                          >
                            Compare
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              });
            })()}
          </MapContainer>
        ) : (
          <GlobeView
            events={filteredEvents}
            onEventClick={setSelectedEvent}
            className="z-0"
          />
        )}

        {selectedEvent && (
          <DraggablePanel initialPosition={{ x: window.innerWidth - 420, y: 80 }} dragHandleClassName="drag-handle">
              <EventDetails
                event={selectedEvent}
                allEvents={filteredEvents}
                onClose={() => setSelectedEvent(null)}
                onAddToComparison={addToComparison}
                onNavigate={handleNavigate}
                onEditEvent={handleEditEvent}
              />
          </DraggablePanel>
        )}

        {comparisonEvents.length > 0 && (
          <DraggablePanel initialPosition={{ x: window.innerWidth - 420, y: window.innerHeight - 350 }} dragHandleClassName="drag-handle">
              <EventComparison
                events={comparisonEvents}
                onRemoveEvent={removeFromComparison}
                onClearAll={() => setComparisonEvents([])}
              />
          </DraggablePanel>
        )}

        {activeLayers.includes('console') && (
        <DraggablePanel initialPosition={{ x: 100, y: window.innerHeight - 420 }} dragHandleClassName="drag-handle">
          <ConsolePanel />
        </DraggablePanel>
        )}

        {pickingLocation.active && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 pointer-events-none">
            <span>🎯 Click anywhere on the map to set the pin location</span>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
            <div className="bg-white rounded-xl p-8 flex items-center gap-4 elegant-shadow">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-lg font-medium text-gray-900">Loading historical data...</span>
            </div>
          </div>
        )}
      </div>
    </MapPageContext.Provider>
  );
}

export default function MapPage() {
  return (
    <ConsoleProvider>
      <MapPageInner />
    </ConsoleProvider>
  );
}
