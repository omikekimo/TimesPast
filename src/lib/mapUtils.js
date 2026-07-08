// ── mapUtils.js ──────────────────────────────────────────────────────────────
// Shared map utilities used by both desktop (Map.jsx) and mobile (MobileLayout.jsx)
// All functions that accept a `con` argument will log pipeline steps to the
// TimesPast console when one is provided.
// ─────────────────────────────────────────────────────────────────────────────

import L from 'leaflet';
import { useMap, useMapEvents } from 'react-leaflet';
import { useEffect } from 'react';

// ── Leaflet default marker fix ───────────────────────────────────────────────
// Must be called once before any markers are rendered.
// Both layout files previously had this block — call this instead.
export function fixLeafletIcons() {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

// ── Category colour map ───────────────────────────────────────────────────────
// Single source of truth for pin colours by category.
export const CATEGORY_COLORS = {
  people:           '#f59e0b',
  organisations:    '#f97316',
  livingEntities:   '#84cc16',
  artificialAgents: '#0ea5e9',
  events:           '#3b82f6',
  phenomena:        '#eab308',
  conflicts:        '#ef4444',
  places:           '#22c55e',
  objects:          '#78716c',
  technology:       '#6366f1',
  works:            '#f43f5e',
  concepts:         '#a855f7',
  sciences:         '#14b8a6',
  weather:          '#06b6d4',
};

// ── Create a custom Leaflet div icon ─────────────────────────────────────────
// category     — event category string, used to pick colour
// significance — 'global' | 'national' | 'local' — controls base size
// isHovered    — enlarges the icon when true
// overrideColor — pass a search group colour to override the category colour
export function createCustomIcon(category, significance, isHovered = false, overrideColor = null) {
  const color    = overrideColor || CATEGORY_COLORS[category] || '#6b7280';
  const baseSize = significance === 'global' ? 30 : significance === 'national' ? 25 : 20;
  const size     = isHovered ? Math.round(baseSize * 1.6) : baseSize;
  const label    = category?.charAt(0).toUpperCase() || '?';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width:${size}px;height:${size}px;background:${color};
      border:3px solid white;border-radius:50%;
      box-shadow:0 4px 8px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      font-size:10px;color:white;font-weight:bold;">
      ${label}
    </div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ── Spread stacked markers ────────────────────────────────────────────────────
// When multiple pins share the same lat/lng they overlap completely.
// This fans them out in a small circle so they're all individually clickable.
// Returns a map of { eventId: { lat, lng } } with adjusted positions.
// Pins that are alone at their location are returned unchanged.
//
// con — optional console context for pipeline logging
export function spreadStackedMarkers(events, { con } = {}) {
  const RADIUS = 0.003; // ~300m spread at equator
  const key    = e => `${e.latitude.toFixed(4)},${e.longitude.toFixed(4)}`;

  // Group events by coordinate
  const groups = {};
  events.forEach(e => {
    const k = key(e);
    if (!groups[k]) groups[k] = [];
    groups[k].push(e);
  });

  // Count how many locations have stacking
  const stackCount = Object.values(groups).filter(g => g.length > 1).length;
  if (stackCount > 0) {
    con?.log(`[mapUtils] spreading ${stackCount} stacked location(s)`);
  }

  const result = {};
  Object.values(groups).forEach(group => {
    if (group.length === 1) {
      result[group[0].id] = { lat: group[0].latitude, lng: group[0].longitude };
    } else {
      group.forEach((e, i) => {
        const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
        result[e.id] = {
          lat: e.latitude  + RADIUS * Math.cos(angle),
          lng: e.longitude + RADIUS * Math.sin(angle),
        };
      });
    }
  });

  return result;
}

// ── MapResizer component ──────────────────────────────────────────────────────
// Tells Leaflet to recalculate map dimensions after layout changes.
// Must be used as a child of <MapContainer>.
export function MapResizer() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 200);
  }, [map]);
  return null;
}

// ── Create a square note marker ───────────────────────────────────────────────
// Notes are represented as squares to distinguish them from circular pin markers.
// color — the timeline group colour
export function createNoteIcon(color = '#6b7280', isHovered = false) {
  const size = isHovered ? 20 : 14;
  return L.divIcon({
    className: 'note-marker',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:2px solid white;
      border-radius:2px;
      box-shadow:0 2px 4px rgba(0,0,0,0.3);
      display:flex;align-items:center;justify-content:center;
      font-size:8px;color:white;font-weight:bold;">
      N
    </div>`,
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}


// ── MapClickHandler component ─────────────────────────────────────────────────
// Listens for map clicks and calls onPick with { lat, lng } when picking is active.
// Must be used as a child of <MapContainer>.
// picking — boolean, whether pin-picking mode is active
// onPick  — callback receiving { lat, lng }
export function MapClickHandler({ picking, onPick }) {
  useMapEvents({
    click(e) {
      if (picking) {
        onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

