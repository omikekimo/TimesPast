 
// ── mapConfig.js ──────────────────────────────────────────────────────────────
// Tile provider definitions for the map layer selector.
// All providers listed here are free and require no API key.
// Add new providers here — MapOptions.jsx and Map.jsx consume this automatically.
// ─────────────────────────────────────────────────────────────────────────────

export const TILE_PROVIDERS = [
  {
    id:          'osm-standard',
    label:       'OpenStreetMap',
    category:    'Street',
    url:         'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom:     19,
  },
  {
    id:          'osm-hot',
    label:       'OSM Humanitarian',
    category:    'Street',
    url:         'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles by <a href="https://hot.openstreetmap.org/">HOT</a>',
    maxZoom:     19,
  },
  {
    id:          'opentopomap',
    label:       'OpenTopoMap',
    category:    'Terrain',
    url:         'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://opentopomap.org/">OpenTopoMap</a>',
    maxZoom:     17,
  },
  {
    id:          'stamen-terrain',
    label:       'Stamen Terrain',
    category:    'Terrain',
    url:         'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
    attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a>, © <a href="https://stamen.com/">Stamen Design</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom:     18,
  },
  {
    id:          'stamen-watercolor',
    label:       'Stamen Watercolour',
    category:    'Artistic',
    url:         'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
    attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a>, © <a href="https://stamen.com/">Stamen Design</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom:     16,
  },
  {
    id:          'esri-imagery',
    label:       'Esri Satellite',
    category:    'Satellite',
    url:         'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom:     19,
  },
  {
    id:          'esri-topo',
    label:       'Esri Topo',
    category:    'Terrain',
    url:         'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '© <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, FAO, NOAA, USGS',
    maxZoom:     19,
  },
];

export const DEFAULT_TILE_ID = 'osm-standard';

export function getTileProvider(id) {
  return TILE_PROVIDERS.find(p => p.id === id) ?? TILE_PROVIDERS.find(p => p.id === DEFAULT_TILE_ID);
}

// Group providers by category for display in the panel
export function getTileProvidersByCategory() {
  return TILE_PROVIDERS.reduce((acc, provider) => {
    if (!acc[provider.category]) acc[provider.category] = [];
    acc[provider.category].push(provider);
    return acc;
  }, {});
}
