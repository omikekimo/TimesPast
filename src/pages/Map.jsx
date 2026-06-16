import React, { useState, useEffect, useCallback, useContext, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import { InvokeLLM } from "@/integrations/Core";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Smartphone } from "lucide-react";
import { MapPageContext } from "../components/context/MapPageContext";
import { LayoutContext } from "../components/context/LayoutContext";
import { nextGroupColor } from "../lib/searchGroups";
import { parseSparqlDate, datePartToYear, formatPinDate, migrateLegacyPin, csvStringToDate } from "@/lib/dateUtils";
import { fixLeafletIcons, createCustomIcon, spreadStackedMarkers, MapResizer, MapClickHandler, CATEGORY_COLORS } from '@/lib/mapUtils';
import { ConsoleProvider, useConsole } from "../components/console/ConsoleContext";
import { useIsMobile } from '../hooks/use-mobile';
import { useMapHandlers } from '../hooks/useMapHandlers';
import EventSearchPanel from "../components/map/SearchPanel";
import SparqlSearchPanel from "../components/layers/SparqlSearchPanel";
import LayerSwitcher from "../components/layers/LayerSwitcher";
import CustomQueryPanel from "../components/layers/CustomQueryPanel";
import DataTimelineControls from "../components/map/DataTimelineControls";
import EventDetails from "../components/map/EventDetails";
import EventComparison from "../components/map/EventComparison";
import SidebarSessionControls from "../components/session/SidebarSessionControls";
import GlobeView from "../components/ui/GlobeView";
import DraggablePanel from "../components/ui/DraggablePanel";
import ConsolePanel from "../components/console/ConsolePanel";
import AboutPanel from "../components/ui/AboutPanel";
import MobileLayout from '../components/mobile/MobileLayout';
import SessionPanel from '../components/session/SessionPanel';
import {fetchEntityProperties, resolveBinding, resolvedToPin, resolveWikipediaUrl } from '@/lib/wikidataUtils';

// Fix for default markers in react-leaflet
fixLeafletIcons();

function promptGroupName(defaultName = "") {
  return window.prompt("Group name:", defaultName);
}

// ── Inner component — has access to useConsole ────────────────────────────
function MapPageInner() {
  const con = useConsole();

  const isMobile = useIsMobile();

  // Layout mode — persisted to localStorage
  const [layoutMode, setLayoutMode] = useState(() => {
    const saved = localStorage.getItem('timespast_layout');
    if (saved) return saved;
    return isMobile ? 'mobile' : 'desktop';
  });

  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
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
  const [groups, setGroups] = useState([]);
  const markerRefs = useRef({});
  const layoutContext = useContext(LayoutContext);
  const setSidebarControls = layoutContext?.setSidebarControls;

  const handlers = useMapHandlers({
  events, filteredEvents, groups, comparisonEvents,
  lockedEventIds, markerRefs,
  setEvents, setGroups, setComparisonEvents,
  setHiddenEventIds, setLockedEventIds,
  setSelectedEvent, setActiveLayers,
  setTimeRange, setSelectedCategories,
  setSearchQuery, setPickingLocation,
  setIsSearching, setLayoutMode,
  con,
});

  useEffect(() => { setIsLoading(false); }, []);

  useEffect(() => { filterEvents(); }, [events, timeRange, selectedCategories, searchQuery, activeLayers]);

  const filterEvents = () => {
    let layerFiltered = events.filter(event => {
      if (activeLayers.includes('events') && event.category !== 'person') return true;
      if (activeLayers.includes('people') && event.category === 'person') return true;
      if (activeLayers.includes('customQueries') && event.source === 'Wikidata Custom Query') return true;
      return false;
    });
    let filtered = layerFiltered.filter(event => {
      const withinTimeRange = event.year >= timeRange.start && event.year <= timeRange.end;
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(event.category);
      const matchesSearch = !searchQuery ||
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return withinTimeRange && matchesCategory && matchesSearch;
    });
    setFilteredEvents(filtered);
  };

  const getCurrentSessionInfo = useCallback(() => ({
    eventCount: filteredEvents.length, activeLayers, timeRange, selectedCategories, searchQuery
  }), [filteredEvents.length, activeLayers, timeRange, selectedCategories, searchQuery]);

 const sessionControlHandlers = {
  onSaveSession: handlers.handleSaveSession,
  onLoadSession: handlers.handleLoadSession,
  onClearSession: handlers.handleClearSession,
  onExportData: (filteredEvts) => handlers.handleExportData(filteredEvts, getCurrentSessionInfo()),
  onImportData: () => handlers.handleImportData(handlers.handleLoadSession),
  currentSessionInfo: getCurrentSessionInfo(),
};

  useEffect(() => {
    if (setSidebarControls) {
      setSidebarControls(<SidebarSessionControls {...sessionControlHandlers} />);
    }
    return () => { if (setSidebarControls) setSidebarControls(null); };
  }, [setSidebarControls, sessionControlHandlers]);

  // ── All shared props for both layouts ─────────────────────────────────────
  const sharedProps = {
    filteredEvents, events, hiddenEventIds, lockedEventIds,
    selectedEvent, setSelectedEvent,
    comparisonEvents,
    addToComparison: handlers.addToComparison,
    removeFromComparison: handlers.removeFromComparison,
    setComparisonEvents,
    timeRange, setTimeRange,
    activeLayers, setActiveLayers,
    selectedCategories, setSelectedCategories,
    isSearching,
    pickingLocation, setPickingLocation,
    groups, setGroups,
    hoveredEventId, setHoveredEventId,
    markerRefs,
    handleSparqlSearch: handlers.handleSparqlSearch,
    handleCustomQuery: handlers.handleCustomQuery,
    handleEventSearch: handlers.handleEventSearch,
    handleToggleVisible: handlers.handleToggleVisible,
    handleToggleLock: handlers.handleToggleLock,
    handleEditEvent: handlers.handleEditEvent,
    handleDeleteEvent: handlers.handleDeleteEvent,
    handleClearAllPins: handlers.handleClearAllPins,
    handleCreateGroup: handlers.handleCreateGroup,
    handleNavigate: handlers.handleNavigate,
    handleRenameGroup: handlers.handleRenameGroup,
    onAddPin: handlers.handleAddPin,
    onImportEvents: handlers.handleImportEvents,
  };

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (layoutMode === 'mobile') {
    return (
      <MapPageContext.Provider value={{ currentView, setCurrentView }}>
        <MobileLayout
          {...sharedProps}
          onSwitchToDesktop={() => switchLayout('desktop')}
        />
      </MapPageContext.Provider>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
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
              onSearch={handlers.handleEventSearch} isSearching={isSearching}
              selectedCategories={selectedCategories} onCategoryChange={setSelectedCategories}
            />
          </DraggablePanel>
        )}

        {activeLayers.includes('people') && (
          <DraggablePanel initialPosition={{ x: 24, y: 300 }} dragHandleClassName="drag-handle">
            <SparqlSearchPanel onSearch={handlers.handleSparqlSearch} isSearching={isSearching} />
          </DraggablePanel>
        )}

        {activeLayers.includes('customQueries') && (
          <DraggablePanel initialPosition={{ x: 24, y: 300 }} dragHandleClassName="drag-handle">
            <CustomQueryPanel onSearch={handlers.handleCustomQuery} isSearching={isSearching} />
          </DraggablePanel>
        )}

        {activeLayers.includes('session') && (
        <DraggablePanel initialPosition={{ x: window.innerWidth - 420, y: 24 }} dragHandleClassName="drag-handle">
          <SessionPanel {...sessionControlHandlers} />
        </DraggablePanel>
        )}

        <DraggablePanel
          initialPosition={{ x: (window.innerWidth / 2) - 400, y: window.innerHeight - 230 }}
          dragHandleClassName="drag-handle"
        >
          <DataTimelineControls
            timeRange={timeRange} onTimeRangeChange={setTimeRange}
            eventCount={filteredEvents.length} events={filteredEvents}
            hiddenEventIds={hiddenEventIds} lockedEventIds={lockedEventIds}
            onToggleVisible={handlers.handleToggleVisible} onToggleLock={handlers.handleToggleLock}
            onDeleteEvent={handlers.handleDeleteEvent} onHoverEvent={setHoveredEventId}
            onEditEvent={handlers.handleEditEvent} onSelectEvent={handlers.handleNavigate}
            pickingLocation={pickingLocation} onRenameGroup={handlers.handleRenameGroup}
            onStartPickLocation={() => setPickingLocation(p => ({ ...p, active: !p.active, lat: null, lng: null }))}
            onAddPin={handlers.handleAddPin}
            onClearAll={handlers.handleClearAllPins}
            groups={groups} onCreateGroup={handlers.handleCreateGroup}
            onImportEvents={handlers.handleImportEvents}
          />
        </DraggablePanel>

        {currentView === 'map' ? (
          <MapContainer
            center={[20, 0]} zoom={2}
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

            {/* Polylines */}
            {(() => {
              const visible = filteredEvents.filter(e => !hiddenEventIds.has(e.id) && e.search_group);
              const grps = {};
              visible.forEach(e => { if (!grps[e.search_group]) grps[e.search_group] = []; grps[e.search_group].push(e); });
              return Object.entries(grps).map(([gid, gevents]) => {
                if (gevents.length < 2) return null;
                const sorted = [...gevents].sort((a, b) => a.year - b.year);
                const positions = sorted.map(e => [e.latitude, e.longitude]);
                const color = sorted[0].search_color || "#6b7280";
                return <Polyline key={gid} positions={positions} pathOptions={{ color, weight: 2, opacity: 0.7, dashArray: "6 4" }} />;
              });
            })()}

            {/* Markers */}
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
                        <p className="text-xs text-gray-500 mb-1">{formatPinDate(migrateLegacyPin(event).date)}</p>
                        <p className="text-sm text-gray-700 mb-3 line-clamp-3">{event.description}</p>
                        {grp.length > 1 && (
                          <div className="flex gap-1 mb-2">
                            <button disabled={!prev} onClick={() => prev && handlers.handleNavigate(prev)}
                              className="flex-1 text-xs flex items-center justify-center gap-0.5 border border-gray-300 rounded px-2 py-1 disabled:opacity-30 hover:bg-gray-50">
                              ‹ {prev ? (prev.year < 0 ? `${Math.abs(prev.year)} BCE` : prev.year) : ""}
                            </button>
                            <span className="text-xs text-gray-400 self-center px-1">{idx+1}/{grp.length}</span>
                            <button disabled={!next} onClick={() => next && handlers.handleNavigate(next)}
                              className="flex-1 text-xs flex items-center justify-center gap-0.5 border border-gray-300 rounded px-2 py-1 disabled:opacity-30 hover:bg-gray-50">
                              {next ? (next.year < 0 ? `${Math.abs(next.year)} BCE` : next.year) : ""} ›
                            </button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => setSelectedEvent(event)}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full hover:bg-blue-700 transition-colors">
                            Details
                          </button>
                          <button onClick={() => handlers.addToComparison(event)}
                            className="text-xs bg-gray-600 text-white px-3 py-1 rounded-full hover:bg-gray-700 transition-colors">
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
          <GlobeView events={filteredEvents} onEventClick={setSelectedEvent} className="z-0" />
        )}

        {selectedEvent && (
          <DraggablePanel initialPosition={{ x: window.innerWidth - 420, y: 80 }} dragHandleClassName="drag-handle">
            <EventDetails
              event={selectedEvent} allEvents={filteredEvents}
              onClose={() => setSelectedEvent(null)}
              onAddToComparison={handlers.addToComparison}
              onNavigate={handlers.handleNavigate} onEditEvent={handleEditEvent}
            />
          </DraggablePanel>
        )}

        {comparisonEvents.length > 0 && (
          <DraggablePanel initialPosition={{ x: window.innerWidth - 420, y: window.innerHeight - 350 }} dragHandleClassName="drag-handle">
            <EventComparison
              events={comparisonEvents}
              onRemoveEvent={handlers.removeFromComparison}
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

        {/* Layout toggle button */}
        <button
          onClick={() => switchLayout('mobile')}
          className="absolute top-4 right-4 z-[700] bg-white rounded-full shadow-lg p-2 border border-gray-200"
          title="Switch to mobile layout"
        >
          <Smartphone className="w-4 h-4 text-gray-500" />
        </button>

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

// ── Outer wrapper provides console context ────────────────────────────────
export default function MapPage() {
  return (
    <ConsoleProvider>
      <MapPageInner />
    </ConsoleProvider>
  );
}
