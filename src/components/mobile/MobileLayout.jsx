import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { Menu, Plus, ChevronUp, X, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import MobileDrawer from './MobileDrawer';
import MobileBottomSheet, { SHEET_SIZES } from './MobileBottomSheet';
import DataTimelineControls from '../map/DataTimelineControls';
import EventDetails from '../map/EventDetails';
import EventComparison from '../map/EventComparison';
import AddPinForm from '../map/AddPinForm';
import ConsolePanel from '../console/ConsolePanel';
import AboutPanel from '../ui/AboutPanel';
import { formatPinDate, migrateLegacyPin } from '@/lib/dateUtils';

// ── Leaflet helpers (same as desktop) ───────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const categoryColors = {
  war: "#dc2626", politics: "#7c3aed", culture: "#059669",
  science: "#2563eb", natural_disaster: "#ea580c", economics: "#ca8a04",
  religion: "#9333ea", exploration: "#0891b2", person: "#f59e0b"
};

const createCustomIcon = (category, significance, isHovered = false, overrideColor = null) => {
  const color    = overrideColor || categoryColors[category] || "#6b7280";
  const baseSize = significance === "global" ? 30 : significance === "national" ? 25 : 20;
  const size     = isHovered ? Math.round(baseSize * 1.6) : baseSize;
  const label    = category === 'person' ? 'P' : category.charAt(0).toUpperCase();
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 4px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:bold;">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
};

function MapResizer() {
  const map = useMap();
  React.useEffect(() => { setTimeout(() => map.invalidateSize(), 200); }, [map]);
  return null;
}

function MapClickHandler({ picking, onPick }) {
  useMapEvents({ click(e) { if (picking) onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

function spreadStackedMarkers(events) {
  const RADIUS = 0.003;
  const key    = e => `${e.latitude.toFixed(4)},${e.longitude.toFixed(4)}`;
  const groups = {};
  events.forEach(e => { const k = key(e); if (!groups[k]) groups[k] = []; groups[k].push(e); });
  const result = {};
  Object.values(groups).forEach(group => {
    if (group.length === 1) {
      result[group[0].id] = { lat: group[0].latitude, lng: group[0].longitude };
    } else {
      group.forEach((e, i) => {
        const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
        result[e.id] = { lat: e.latitude + RADIUS * Math.cos(angle), lng: e.longitude + RADIUS * Math.sin(angle) };
      });
    }
  });
  return result;
}

// ── Mobile sheet tabs ────────────────────────────────────────────────────────
const SHEETS = { NONE: null, TIMELINE: 'timeline', ADD_PIN: 'addpin', EVENT: 'event', COMPARE: 'compare', CONSOLE: 'console', ABOUT: 'about' };

export default function MobileLayout({
  // All state and handlers from Map.jsx passed as props
  filteredEvents, events, hiddenEventIds, lockedEventIds,
  selectedEvent, setSelectedEvent,
  comparisonEvents, addToComparison, removeFromComparison, setComparisonEvents,
  timeRange, setTimeRange,
  activeLayers, setActiveLayers,
  selectedCategories, setSelectedCategories,
  isSearching,
  pickingLocation, setPickingLocation,
  groups, setGroups,
  hoveredEventId, setHoveredEventId,
  markerRefs,
  handleSparqlSearch, handleCustomQuery, handleEventSearch,
  handleToggleVisible, handleToggleLock, handleEditEvent,
  handleDeleteEvent, handleClearAllPins, handleCreateGroup,
  handleNavigate, handleRenameGroup,
  onAddPin, onImportEvents,
  onSwitchToDesktop,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState(SHEETS.NONE);

  const openSheet  = (s) => setActiveSheet(s);
  const closeSheet = ()  => setActiveSheet(SHEETS.NONE);

  const toggleLayer = (id) => {
    setActiveLayers(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    );
  };

  const toggleConsole = () => toggleLayer('console');
  const toggleAbout   = () => toggleLayer('about');

  const positions = spreadStackedMarkers(filteredEvents);

  // Collapse add-pin sheet to pill during picking
  const addPinCollapsed = pickingLocation.active;

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative', overflow: 'hidden' }}>

      {/* ── Full-screen map ── */}
      <MapContainer
        center={[20, 0]} zoom={2}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: pickingLocation.active ? 'crosshair' : '' }}
        className="z-0"
      >
        <MapResizer />
        <MapClickHandler
          picking={pickingLocation.active}
          onPick={latlng => setPickingLocation({ active: false, lat: latlng.lat, lng: latlng.lng })}
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
            const sorted    = [...gevents].sort((a, b) => a.year - b.year);
            const positions = sorted.map(e => [e.latitude, e.longitude]);
            const color     = sorted[0].search_color || '#6b7280';
            return <Polyline key={gid} positions={positions} pathOptions={{ color, weight: 2, opacity: 0.7, dashArray: '6 4' }} />;
          });
        })()}

        {/* Markers */}
        {filteredEvents.filter(e => !hiddenEventIds.has(e.id)).map(event => {
          const pos = positions[event.id] || { lat: event.latitude, lng: event.longitude };
          return (
            <Marker
              key={event.id}
              position={[pos.lat, pos.lng]}
              icon={createCustomIcon(event.category, event.significance, hoveredEventId === event.id, event.search_color || null)}
              ref={ref => { if (ref) markerRefs.current[event.id] = ref; }}
              eventHandlers={{ click: () => { setSelectedEvent(event); openSheet(SHEETS.EVENT); } }}
            >
              <Popup>
                <div className="p-1 max-w-[200px]">
                  <p className="font-bold text-sm">{event.title}</p>
                  <p className="text-xs text-gray-500">{formatPinDate(migrateLegacyPin(event).date)}</p>
                  <button onClick={() => { setSelectedEvent(event); openSheet(SHEETS.EVENT); }}
                    className="mt-2 text-xs bg-blue-600 text-white px-3 py-1 rounded-full w-full">
                    Details
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* ── Floating controls ── */}

      {/* Top-left: hamburger menu */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="absolute top-4 left-4 z-[700] bg-white rounded-full shadow-lg p-3 border border-gray-200"
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </button>

      {/* Top-right: switch to desktop */}
      <button
        onClick={onSwitchToDesktop}
        className="absolute top-4 right-4 z-[700] bg-white rounded-full shadow-lg p-2 border border-gray-200"
        title="Switch to desktop layout"
      >
        <Monitor className="w-4 h-4 text-gray-500" />
      </button>

      {/* Bottom-right: FAB row */}
      <div className="absolute bottom-20 right-4 z-[700] flex flex-col gap-2 items-end">
        {/* Add pin */}
        <button
          onClick={() => openSheet(SHEETS.ADD_PIN)}
          className="bg-blue-600 text-white rounded-full shadow-lg p-3 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm font-medium pr-1">Add Pin</span>
        </button>

        {/* Timeline */}
        <button
          onClick={() => openSheet(activeSheet === SHEETS.TIMELINE ? SHEETS.NONE : SHEETS.TIMELINE)}
          className="bg-white rounded-full shadow-lg p-3 border border-gray-200"
          title="Timeline"
        >
          <ChevronUp className={`w-5 h-5 text-gray-700 transition-transform ${activeSheet === SHEETS.TIMELINE ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Event count badge */}
      <div className="absolute bottom-20 left-4 z-[700] bg-white/90 rounded-full px-3 py-1 shadow border border-gray-200">
        <span className="text-xs text-gray-600 font-medium">{filteredEvents.length} events</span>
      </div>

      {/* ── Drawer ── */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeLayers={activeLayers}
        onLayerToggle={setActiveLayers}
        onSparqlSearch={handleSparqlSearch}
        onCustomQuery={handleCustomQuery}
        onEventSearch={handleEventSearch}
        isSearching={isSearching}
        selectedCategories={selectedCategories}
        onCategoryChange={setSelectedCategories}
        onToggleConsole={toggleConsole}
        onToggleAbout={toggleAbout}
      />

      {/* ── Timeline sheet ── */}
      <MobileBottomSheet
        open={activeSheet === SHEETS.TIMELINE}
        onClose={closeSheet}
        size={SHEET_SIZES.TALL}
        title="Timeline & Data"
      >
        <div className="px-2">
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
            onSelectEvent={e => { handleNavigate(e); closeSheet(); }}
            pickingLocation={pickingLocation}
            onStartPickLocation={() => setPickingLocation(p => ({ ...p, active: !p.active, lat: null, lng: null }))}
            onAddPin={pin => { onAddPin(pin); closeSheet(); }}
            onClearAll={handleClearAllPins}
            groups={groups}
            onCreateGroup={handleCreateGroup}
            onRenameGroup={handleRenameGroup}
            onImportEvents={onImportEvents}
          />
        </div>
      </MobileBottomSheet>

      {/* ── Add pin sheet — collapses to pill during picking ── */}
      <MobileBottomSheet
        open={activeSheet === SHEETS.ADD_PIN}
        onClose={closeSheet}
        size={SHEET_SIZES.TALL}
        title="Add Pin"
        collapsed={addPinCollapsed}
      >
        <div className="px-4 pb-4">
          <AddPinForm
            onAdd={pin => { onAddPin(pin); closeSheet(); }}
            pickingLocation={pickingLocation}
            onStartPickLocation={() => setPickingLocation(p => ({ ...p, active: !p.active, lat: null, lng: null }))}
            groups={groups}
          />
        </div>
      </MobileBottomSheet>

      {/* ── Event details sheet ── */}
      <MobileBottomSheet
        open={activeSheet === SHEETS.EVENT && !!selectedEvent}
        onClose={() => { closeSheet(); setSelectedEvent(null); }}
        size={SHEET_SIZES.TALL}
        title={selectedEvent?.title}
      >
        {selectedEvent && (
          <EventDetails
            event={selectedEvent}
            allEvents={filteredEvents}
            onClose={() => { closeSheet(); setSelectedEvent(null); }}
            onAddToComparison={e => { addToComparison(e); openSheet(SHEETS.COMPARE); }}
            onNavigate={handleNavigate}
            onEditEvent={handleEditEvent}
          />
        )}
      </MobileBottomSheet>

      {/* ── Comparison sheet ── */}
      <MobileBottomSheet
        open={comparisonEvents.length > 0 && activeSheet === SHEETS.COMPARE}
        onClose={closeSheet}
        size={SHEET_SIZES.HALF}
        title="Comparison"
      >
        <EventComparison
          events={comparisonEvents}
          onRemoveEvent={removeFromComparison}
          onClearAll={() => { setComparisonEvents([]); closeSheet(); }}
        />
      </MobileBottomSheet>

      {/* ── Console — rendered as a bottom sheet on mobile ── */}
      {activeLayers.includes('console') && (
        <MobileBottomSheet
          open={true}
          onClose={() => toggleLayer('console')}
          size={SHEET_SIZES.HALF}
          title="Console"
        >
          <ConsolePanel />
        </MobileBottomSheet>
      )}

      {/* ── About sheet ── */}
      {activeLayers.includes('about') && (
        <MobileBottomSheet
          open={true}
          onClose={() => toggleLayer('about')}
          size={SHEET_SIZES.HALF}
          title="About"
        >
          <AboutPanel />
        </MobileBottomSheet>
      )}
    </div>
  );
}
