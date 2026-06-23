// ── wikidataUtils.js ─────────────────────────────────────────────────────────
// A library of composable, single-purpose functions for querying Wikidata.
// Each function:
//   - Does exactly one thing
//   - Accepts an optional `con` (console context) for pipeline transparency
//   - Returns null / empty array on failure rather than throwing (unless critical)
//   - Can be called independently or chained into a pipeline
//
// Typical pipeline:
//   resolveTextToEntities → user picks one → fetchEntityProperties
//   → for each binding: detectBindingType → resolveCoordinates (if needed)
//   → bindingToPin → add to map
// ─────────────────────────────────────────────────────────────────────────────

const WIKIDATA_API      = 'https://www.wikidata.org/w/api.php';
const WIKIDATA_SPARQL   = 'https://query.wikidata.org/sparql';

// ── 1. Text → candidate entities (disambiguation list) ───────────────────────
// Returns up to `limit` candidates so the user can pick the right one.
// Each candidate: { qid, label, description, url }
export async function resolveTextToEntities(text, { limit = 5, con } = {}) {
  con?.log(`[wikidata] resolving "${text}"…`);
  const url = `${WIKIDATA_API}?action=wbsearchentities`
    + `&search=${encodeURIComponent(text)}`
    + `&language=en&limit=${limit}&format=json&origin=*`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    const candidates = (data.search || []).map(e => ({
      qid:         e.id,
      label:       e.label       || e.id,
      description: e.description || '',
      url:         `https://www.wikidata.org/wiki/${e.id}`,
    }));
    con?.log(`[wikidata] found ${candidates.length} candidate(s) for "${text}"`);
    return candidates;
  } catch (err) {
    con?.error(`[wikidata] resolveTextToEntities failed: ${err.message}`);
    return [];
  }
}

// ── 2. Q-id → instance type(s) via P31 ───────────────────────────────────────
// Returns an array of type labels e.g. ["human", "fictional character"]
// Useful for auto-selecting appropriate properties downstream.
export async function fetchEntityTypes(qid, { con } = {}) {
  con?.log(`[wikidata] fetching type (P31) for ${qid}…`);
  const sparql = `
    SELECT ?typeLabel WHERE {
      wd:${qid} wdt:P31 ?type .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 5`;
  try {
    const rows = await runSparql(sparql, { con });
    const types = rows.map(r => r.typeLabel?.value).filter(Boolean);
    con?.log(`[wikidata] ${qid} is: ${types.join(', ') || 'unknown type'}`);
    return types;
  } catch (err) {
    con?.error(`[wikidata] fetchEntityTypes failed: ${err.message}`);
    return [];
  }
}

// ── 3. Q-id + P-ids → raw SPARQL bindings ────────────────────────────────────
// Fetches one or more properties for a given entity.
// Returns raw binding rows from the SPARQL results.
export async function fetchEntityProperties(qid, pids, { con } = {}) {
  con?.log(`[wikidata] fetching ${pids.join(', ')} for ${qid}…`);
  if (!pids.length) return [];

  // Build one OPTIONAL block per P-id so missing props don't kill the row
  const vars    = pids.map(p => `?p${p} ?p${p}Label`).join(' ');
  const optionals = pids.map(p => `
    OPTIONAL {
      wd:${qid} wdt:${p} ?p${p} .
    }`).join('');

  const sparql = `
    SELECT ${vars} WHERE {
      ${optionals}
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    } LIMIT 20`;

  try {
    const rows = await runSparql(sparql, { con });
    con?.log(`[wikidata] got ${rows.length} row(s)`);
    return rows;
  } catch (err) {
    con?.error(`[wikidata] fetchEntityProperties failed: ${err.message}`);
    return [];
  }
}

// ── 4. Detect what kind of value a binding contains ──────────────────────────
// Returns one of: 'coordinate' | 'date' | 'entity' | 'string' | 'unknown'
// This is the branch point — tells the pipeline how to handle the value next.
export function detectBindingType(binding) {
  if (!binding?.value) return 'unknown';
  const v = binding.value;
  if (v.startsWith('Point('))                          return 'coordinate';
  if (/^-?\d{3,4}-\d{2}-\d{2}/.test(v))              return 'date';
  if (v.startsWith('http://www.wikidata.org/entity/Q')) return 'entity';
  if (v.startsWith('https://'))                        return 'url';
  return 'string';
}

// ── 5. Parse a coordinate string into { lat, lng } ───────────────────────────
// Handles the WKT Point format Wikidata returns: "Point(-0.1276 51.5074)"
// longitude comes first in WKT, latitude second.
export function parseCoordinate(pointString) {
  if (!pointString) return null;
  const match = pointString.match(/Point\(([+-]?\d+\.?\d*)\s([+-]?\d+\.?\d*)\)/);
  if (!match) return null;
  return {
    lng: parseFloat(match[1]),
    lat: parseFloat(match[2]),
  };
}

// ── 6. Resolve coordinates for an entity Q-id ────────────────────────────────
// If a binding value is itself a Q-id (e.g. P19 birth place → Q60 New York),
// call this to get the actual coordinates of that entity via P625.
export async function resolveEntityCoordinates(qid, { con } = {}) {
  con?.log(`[wikidata] resolving coordinates for ${qid}…`);
  const sparql = `
    SELECT ?coords WHERE {
      OPTIONAL { wd:${qid} wdt:P625 ?coords . }
    } LIMIT 1`;
  try {
    const rows = await runSparql(sparql, { con });
    if (!rows.length || !rows[0].coords) {
      con?.warn(`[wikidata] no coordinates found for ${qid}`);
      return null;
    }
    const coords = parseCoordinate(rows[0].coords.value);
    if (coords) con?.log(`[wikidata] ${qid} → lat:${coords.lat} lng:${coords.lng}`);
    return coords;
  } catch (err) {
    con?.error(`[wikidata] resolveEntityCoordinates failed: ${err.message}`);
    return null;
  }
}

// ── 7. Resolve a Wikipedia URL for a Q-id ────────────────────────────────────
export async function resolveWikipediaUrl(qid, { con } = {}) {
  const sparql = `
    SELECT ?url WHERE {
      ?article schema:about wd:${qid} ;
               schema:isPartOf <https://en.wikipedia.org/> ;
               schema:name ?title .
      BIND(IRI(CONCAT("https://en.wikipedia.org/wiki/", ENCODE_FOR_URI(?title))) AS ?url)
    } LIMIT 1`;
  try {
    const rows = await runSparql(sparql, { con });
    return rows[0]?.url?.value || null;
  } catch (err) {
    con?.warn(`[wikidata] could not resolve Wikipedia URL for ${qid}`);
    return null;
  }
}

// ── 8. Smart binding resolver ─────────────────────────────────────────────────
// Takes a single raw SPARQL binding value and returns a resolved result:
// { lat, lng, label, dateString, rawValue, type }
// This is the recursive step — if the value is a Q-id it fetches its coords.
export async function resolveBinding(binding, labelBinding, { con } = {}) {
  if (!binding) return null;
  const type  = detectBindingType(binding);
  const label = labelBinding?.value || binding.value;
  const raw   = binding.value;

  switch (type) {
    case 'coordinate': {
      const coords = parseCoordinate(raw);
      return coords
        ? { lat: coords.lat, lng: coords.lng, label, dateString: null, rawValue: raw, type }
        : null;
    }
    case 'date': {
      // Date values have no coordinates by themselves — caller handles placement
      return { lat: null, lng: null, label, dateString: raw, rawValue: raw, type };
    }
    case 'entity': {
      // Extract Q-id and fetch its coordinates
      const qid    = raw.split('/').pop();
      const coords = await resolveEntityCoordinates(qid, { con });
      return {
        lat:        coords?.lat ?? null,
        lng:        coords?.lng ?? null,
        label,
        dateString: null,
        rawValue:   raw,
        qid,
        type,
      };
    }
    case 'url':
    case 'string':
    default:
      return { lat: null, lng: null, label, dateString: null, rawValue: raw, type };
  }
}

// ── 9. Resolved result → map pin ─────────────────────────────────────────────
// Takes the output of resolveBinding and builds a pin object ready for setEvents.
// Returns null if the result can't be meaningfully placed (no coords, no date).
import { parseSparqlDate, datePartToYear } from './dateUtils.js';

export function resolvedToPin(resolved, { entityLabel, groupId, groupColor, category = 'culture', significance = 'national', wikipediaUrl = null } = {}) {
  if (!resolved) return null;

  let year = 0;
  let datePart = null;

  if (resolved.dateString) {
    datePart = parseSparqlDate(resolved.dateString);
    year     = datePartToYear(datePart);
  }

  // If we have neither coordinates nor a date, the pin isn't useful
  const hasCoords = resolved.lat != null && resolved.lng != null;
  const hasDate   = year !== 0;
  if (!hasCoords && !hasDate) return null;

  return {
    id:           `${groupId}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    title:        `${entityLabel} — ${resolved.label}`,
    description:  resolved.rawValue,
    year:         year || new Date().getFullYear(),
    date:         datePart ? { start: datePart, end: null } : null,
    latitude:     resolved.lat  ?? 0,
    longitude:    resolved.lng  ?? 0,
    category,
    significance,
    source:       'Wikidata',
    search_group: groupId,
    search_query: entityLabel,
    search_color: groupColor,
    wikipedia_url: wikipediaUrl || '',
  };
}

// ── 10. Low-level SPARQL runner ───────────────────────────────────────────────
// All functions above use this. Centralised so error handling and headers
// only need to change in one place.
export async function runSparql(sparql, { con } = {}) {
  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(sparql)}&format=json`;
  const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json' } });
  if (!res.ok) throw new Error(`SPARQL HTTP ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.results?.bindings || [];
}

// ── 11. Fetch structured event data for a Q-id ────────────────────────────────
// Follows the prescribed event pipeline:
//   location (P276 or P625) → start time (P580) → end time (P582)
//   → point in time (P585) → country (P17)
// Resolves coordinates via the existing pipeline if only a place entity is returned.
// Returns a structured object ready for pin building, or null on failure.
export async function fetchEventData(qid, { con } = {}) {
  con?.log(`[wikidata] fetching event data for ${qid}…`);

  const sparql = `
    SELECT ?coords ?location ?locationLabel ?startDate ?endDate ?pointInTime ?countryLabel WHERE {
      OPTIONAL { wd:${qid} wdt:P625 ?coords . }
      OPTIONAL {
        wd:${qid} wdt:P276 ?location .
      }
      OPTIONAL { wd:${qid} wdt:P580 ?startDate . }
      OPTIONAL { wd:${qid} wdt:P582 ?endDate . }
      OPTIONAL { wd:${qid} wdt:P585 ?pointInTime . }
      OPTIONAL { wd:${qid} wdt:P17 ?country . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    } LIMIT 1`;

  try {
    const rows = await runSparql(sparql, { con });
    if (!rows.length) {
      con?.warn(`[wikidata] no event data found for ${qid}`);
      return null;
    }

    const row = rows[0];
    con?.log(`[wikidata] event data received — resolving coordinates…`);

    // Step 1 — try direct P625 coordinates first
    let lat = null, lng = null, locationLabel = null;

    if (row.coords?.value) {
      const parsed = parseCoordinate(row.coords.value);
      if (parsed) {
        lat = parsed.lat;
        lng = parsed.lng;
        con?.log(`[wikidata] direct P625 coords: lat:${lat} lng:${lng}`);
      }
    }

    // Step 2 — if no direct coords, resolve via P276 location entity
    if (lat === null && row.location?.value) {
      const locationQid = row.location.value.split('/').pop();
      locationLabel = row.locationLabel?.value || locationQid;
      con?.log(`[wikidata] no direct coords — resolving via location entity ${locationQid} (${locationLabel})…`);
      const resolved = await resolveEntityCoordinates(locationQid, { con });
      if (resolved) {
        lat = resolved.lat;
        lng = resolved.lng;
      }
    }

    if (lat === null) {
      con?.warn(`[wikidata] no coordinates resolved for ${qid}`);
    }

    const result = {
      lat,
      lng,
      locationLabel: locationLabel || row.locationLabel?.value || null,
      startDate:     row.startDate?.value   || null,
      endDate:       row.endDate?.value     || null,
      pointInTime:   row.pointInTime?.value || null,
      country:       row.countryLabel?.value || null,
    };

    con?.log(`[wikidata] event data: start=${result.startDate || '—'} end=${result.endDate || '—'} point=${result.pointInTime || '—'}`);
    return result;

  } catch (err) {
    con?.error(`[wikidata] fetchEventData failed: ${err.message}`);
    return null;
  }
}
