// ── geoUtils.js — polygon / GeoJSON data sources ─────────────────────────────
// Wikidata P3896 geoshapes return GeoJSON natively — no extra dependencies.
// Natural Earth via world-atlas needs: npm install topojson-client

/**
 * Fetch a GeoJSON polygon for a Wikidata entity via its P3896 (geoshape) property.
 * Returns a GeoJSON FeatureCollection or null if unavailable.
 */
export async function fetchWikidataGeoshape(qid, { con } = {}) {
  const sparql = `
    SELECT ?geoshape WHERE {
      wd:${qid} wdt:P3896 ?geoshape .
    } LIMIT 1`;

  const sparqlUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
  con?.log(`[geo] looking up geoshape for ${qid}`);

  const sparqlRes = await fetch(sparqlUrl, {
    headers: { Accept: 'application/sparql-results+json' },
  });
  if (!sparqlRes.ok) throw new Error(`SPARQL error: ${sparqlRes.statusText}`);

  const sparqlData = await sparqlRes.json();
  const bindings   = sparqlData.results.bindings;

  if (!bindings.length) {
    con?.warn(`[geo] no P3896 geoshape found for ${qid}`);
    return null;
  }

  const geoshapeUrl = bindings[0].geoshape.value;
  con?.log(`[geo] fetching map file: ${geoshapeUrl}`);

  const mapRes = await fetch(geoshapeUrl);
  if (!mapRes.ok) throw new Error(`Map fetch error: ${mapRes.statusText}`);

  const mapData = await mapRes.json();

  // Wikimedia Commons .map files wrap GeoJSON in { data: { type: "FeatureCollection", ... } }
  const geoJson = mapData.data || mapData;

  if (!geoJson?.features?.length) {
    con?.warn(`[geo] geoshape has no features for ${qid}`);
    return null;
  }

  con?.success(`[geo] geoshape loaded — ${geoJson.features.length} feature(s) for ${qid}`);
  return geoJson;
}

/**
 * Fetch Natural Earth country boundaries from the world-atlas CDN.
 * Returns a GeoJSON FeatureCollection.
 *
 * REQUIRES: npm install topojson-client
 *
 * layerName: 'countries' | 'land'
 * resolution: '110m' (fast, low detail) | '50m' (medium)
 *
 * Pass a filterLabel string to narrow results to a matching country name.
 */
export async function fetchNaturalEarthLayer(layerName = 'countries', resolution = '110m', { con, filterLabel } = {}) {
  let topojson;
  try {
    topojson = await import('topojson-client');
  } catch {
    con?.error('[geo] topojson-client is not installed. Run: npm install topojson-client');
    return null;
  }

  const url = `https://cdn.jsdelivr.net/npm/world-atlas@2/${layerName}-${resolution}.json`;
  con?.log(`[geo] fetching Natural Earth ${layerName}-${resolution}`);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Natural Earth fetch error: ${response.statusText}`);

  const topology = await response.json();
   const featureCollection = topojson.feature(topology, topology.objects[layerName]);

  // Normalise polygon longitudes to prevent Leaflet drawing lines across the antimeridian.
  // When consecutive polygon vertices jump > 180° in longitude, Leaflet connects them with
  // a straight line crossing the whole globe. Adjusting each vertex to stay within 180° of
  // its predecessor keeps every ring geometrically intact without changing the data.
  featureCollection.features = featureCollection.features.map(feature => {
    if (!feature.geometry) return feature;

    const normaliseRing = ring => {
      const out = [ring[0]];
      for (let i = 1; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        let adjustedLon   = lon;
        const prevLon     = out[i - 1][0];
        while (adjustedLon - prevLon >  180) adjustedLon -= 360;
        while (adjustedLon - prevLon < -180) adjustedLon += 360;
        out.push([adjustedLon, lat]);
      }
      return out;
    };

    let { geometry } = feature;
    if (geometry.type === 'Polygon') {
      geometry = { ...geometry, coordinates: geometry.coordinates.map(normaliseRing) };
    } else if (geometry.type === 'MultiPolygon') {
      geometry = { ...geometry, coordinates: geometry.coordinates.map(poly => poly.map(normaliseRing)) };
    }

    return { ...feature, geometry };
  });

  if (filterLabel) {
    const lc = filterLabel.toLowerCase();
    featureCollection.features = featureCollection.features.filter(f => {
      const name = (f.properties?.NAME || f.properties?.name || '').toLowerCase();
      return name.includes(lc);
    });
    con?.log(`[geo] filtered to ${featureCollection.features.length} matching feature(s) for "${filterLabel}"`);
  }

  con?.success(`[geo] Natural Earth loaded — ${featureCollection.features.length} feature(s)`);
  return featureCollection;
}

// ── GBIF Occurrence Range ─────────────────────────────────────────────────────
// Two-step lookup: matches the name to a GBIF taxon key first (more reliable
// than passing the raw string to occurrence search), then fetches occurrence
// coordinates and returns a convex-hull polygon, or a MultiPoint fallback.

function crossProduct(O, A, B) {
  return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
}

function computeConvexHull(pts) {
  if (pts.length < 3) return null;
  const sorted = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower = [], upper = [];
  for (const p of sorted) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  const hull = [...lower, ...upper];
  hull.push(hull[0]); // close the ring
  return hull;
}

export async function fetchGBIFOccurrences(speciesName, { con, limit = 300 } = {}) {
  con?.log(`[gbif] resolving taxon key for "${speciesName}"…`);
  try {
    // Step 1 — match the name to a GBIF taxon key
    const matchRes  = await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(speciesName)}`);
    const matchData = await matchRes.json();
    const taxonKey  = matchData.usageKey;
    if (!taxonKey) {
      con?.warn(`[gbif] no taxon match for "${speciesName}"`);
      return null;
    }
    con?.log(`[gbif] taxon key ${taxonKey} (${matchData.scientificName || speciesName})`);

    // Step 2 — fetch occurrence coordinates
    const occRes  = await fetch(
      `https://api.gbif.org/v1/occurrence/search?taxonKey=${taxonKey}&limit=${limit}&hasCoordinate=true`
    );
    const occData = await occRes.json();
    const points  = (occData.results || [])
      .filter(r => r.decimalLatitude != null && r.decimalLongitude != null)
      .map(r => [r.decimalLongitude, r.decimalLatitude]);

    con?.log(`[gbif] ${points.length} occurrence point(s) returned`);
    if (!points.length) return null;

    // Step 3 — build convex hull; fall back to MultiPoint if too few points
    const hull = computeConvexHull(points);
    if (hull && hull.length >= 4) {
      con?.log(`[gbif] convex hull built (${hull.length - 1} vertices)`);
      return {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry:   { type: 'Polygon', coordinates: [hull] },
          properties: { source: 'gbif', species: speciesName },
        }],
      };
    }

    con?.log(`[gbif] hull too small — returning raw occurrence points`);
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry:   { type: 'MultiPoint', coordinates: points },
        properties: { source: 'gbif', species: speciesName },
      }],
    };
  } catch (err) {
    con?.error(`[gbif] fetchGBIFOccurrences failed: ${err.message}`);
    return null;
  }
}

// ── Stub: user-supplied GeoJSON upload ───────────────────────────────────────
// TODO: wire to a file input in a future TerritorySearch expansion.

// *Mike here* Actually Claude territory search was not ever going to be a layer, that was a mistake you made,
// this stub was supposed to be for if the user had their own geoJSON polygons about a living entity, in the living entities layer.
// i imagine by the time you read this the app will be a lot more mature and this will make sense but
// i feel i need to add this in here so when i forget inevitably, it is recorded.*Mike out*

// Each feature should ideally carry:
//   properties.name       — display label
//   properties.start_year — when this boundary began  (optional)
//   properties.end_year   — when it ended             (optional, omit if still current)
//
// export async function loadUserGeoJson(file) {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onload  = e => {
//       try { resolve(JSON.parse(e.target.result)); }
//       catch { reject(new Error('Invalid GeoJSON file')); }
//     };
//     reader.onerror = () => reject(new Error('File read error'));
//     reader.readAsText(file);
//   });
// }
