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
export async function resolveTextToEntities(text, { limit = 30, con } = {}) {
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
  // Try P625 directly first; if the entity has none, walk up to its
  // administrative territory (P131) or country (P17) — both of which
  // reliably carry P625.  One UNION query so it is still a single request.
  const sparql = `
    SELECT ?coords WHERE {
      { wd:${qid} wdt:P625 ?coords . }
      UNION
      { wd:${qid} wdt:P131 ?territory . ?territory wdt:P625 ?coords . }
      UNION
      { wd:${qid} wdt:P17  ?country   . ?country   wdt:P625 ?coords . }
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

// ── Properties that point to abstract type-nodes; never useful for location ──
const SKIP_FOR_LOCATION_RECURSION = new Set([
  'P31',  // instance of
  'P279', // subclass of
  'P18',  // image
  'P154', // logo image
  'P910', // topic's main category
  'P373', // Commons category
  'P935', // Commons gallery
  'P856', // official website
  'P625', // coordinate location (handled inline already)
  'P571', // inception (date, not Q-item)
  'P576', // dissolved (date)
  'P7',   // brother
  'P9',   // sister
  'P22',  // father
  'P25',  // mother
  'P26',  // spouse
  'P40',  // child
]);

// ── Fetch all Q-item-valued statements on an entity (for graph walking) ───────
export async function fetchEntityStatements(qid, { con } = {}) {
  con?.log(`[wikidata] fetchEntityStatements: querying Q-valued statements for ${qid}`);
  // Variables must follow ?X / ?XLabel pattern for the label service to auto-fill labels.
  // ?prop → ?propLabel   (the property entity, e.g. wd:P495)
  // ?value → ?valueLabel (the value entity, e.g. wd:Q30)
  const sparql = `
    SELECT DISTINCT ?prop ?propLabel ?value ?valueLabel WHERE {
      wd:${qid} ?claim ?value .
      ?prop wikibase:directClaim ?claim .
      FILTER(ISIRI(?value) && STRSTARTS(STR(?value), "http://www.wikidata.org/entity/Q"))
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" }
    } LIMIT 50`;
  try {
    const rows = await runSparql(sparql, { con });
    con?.log(`[wikidata] fetchEntityStatements: ${rows.length} raw row(s) for ${qid}`);
    return rows
      .map(r => ({
        propId:     r.prop?.value.split('/').pop() || '',
        propLabel:  r.propLabel?.value || '',
        valueQid:   r.value?.value.split('/').pop() || '',
        valueLabel: r.valueLabel?.value || r.value?.value || '',
      }))
      .filter(s => s.propId && s.valueQid && !SKIP_FOR_LOCATION_RECURSION.has(s.propId));
  } catch (err) {
    con?.warn(`[wikidata] fetchEntityStatements failed for ${qid}: ${err.message}`);
    return [];
  }
}

// ── Resolve coordinates for many QIDs in one SPARQL (uses same UNION cascade) ─
export async function batchResolveCoordinates(qids, { con } = {}) {
  if (!qids.length) return new Map();
  const valuesClause = qids.map(q => `wd:${q}`).join(' ');
  const sparql = `
    SELECT DISTINCT ?entity ?coords WHERE {
      VALUES ?entity { ${valuesClause} }
      {
        { ?entity wdt:P625 ?coords . }
        UNION
        { ?entity wdt:P131 ?place   . ?place   wdt:P625 ?coords . }
        UNION
        { ?entity wdt:P17  ?country . ?country wdt:P625 ?coords . }
      }
    } LIMIT ${qids.length * 3}`;
  try {
    const rows   = await runSparql(sparql, { con });
    const result = new Map();
    for (const row of rows) {
      if (!row.entity?.value || !row.coords?.value) continue;
      const qid = row.entity.value.split('/').pop();
      if (!result.has(qid)) {
        const coords = parseCoordinate(row.coords.value);
        if (coords) result.set(qid, coords);
      }
    }
    return result;
  } catch (err) {
    con?.warn(`[wikidata] batchResolveCoordinates failed: ${err.message}`);
    return new Map();
  }
}

// ── BFS graph walk — builds pins from related entities up to maxDepth ─────────
// Each BFS level: parallel fetchEntityStatements + one batchResolveCoordinates.
export async function resolveDeepLocationPins(
  rootQid, agentName, baseYear, groupId, groupColor, wikipediaUrl,
  { con, maxDepth = 2, maxWidthPerLevel = 10 } = {}
) {
  const visited = new Set([rootQid]);
  const pins    = [];
  let currentLevel = [{ entityQid: rootQid, pathLabel: agentName }];

  for (let depth = 0; depth <= maxDepth; depth++) {
    if (!currentLevel.length) break;
    con?.log(`[wikidata:deep] depth ${depth} — processing ${currentLevel.length} entity/entities`);

    // Fetch all Q-valued statements for every entity at this level in parallel
    const statementSets = await Promise.all(
      currentLevel.map(({ entityQid, pathLabel }) =>
        fetchEntityStatements(entityQid, { con }).then(stmts => ({ stmts, pathLabel }))
      )
    );

    // Gather unique new QIDs we haven't visited yet
    const statementPool = [];
    for (const { stmts, pathLabel } of statementSets) {
      for (const stmt of stmts) {
        if (!visited.has(stmt.valueQid)) {
          statementPool.push({ ...stmt, fromPathLabel: pathLabel });
        }
      }
    }
    if (!statementPool.length) break;

    // One coordinate batch call covers the whole level
    const uniqueQids = [...new Set(statementPool.map(s => s.valueQid))];
    const coordsMap  = await batchResolveCoordinates(uniqueQids, { con });

    const nextLevelCandidates = [];
    for (const stmt of statementPool) {
      if (visited.has(stmt.valueQid)) continue; // another statement in this batch already claimed it
      const coords = coordsMap.get(stmt.valueQid);

      if (coords) {
        const pinTitle = depth === 0
          ? `${agentName} — ${stmt.propLabel}: ${stmt.valueLabel}`
          : `${stmt.fromPathLabel} — ${stmt.propLabel}: ${stmt.valueLabel}`;
        pins.push({
          title:        pinTitle,
          description:  `${agentName} is linked to ${stmt.valueLabel} via "${stmt.propLabel}".`,
          year:         baseYear || new Date().getFullYear(),
          date:         null,
          latitude:     coords.lat,
          longitude:    coords.lng,
          category:     'artificialAgents',
          significance: 'national',
          source:       'Wikidata SPARQL (deep)',
          wikipedia_url: wikipediaUrl,
        });
        con?.log(`[wikidata:deep] ✓ depth ${depth}: "${stmt.propLabel}: ${stmt.valueLabel}"`);
        visited.add(stmt.valueQid);
      } else if (depth < maxDepth) {
        nextLevelCandidates.push({
          entityQid: stmt.valueQid,
          pathLabel: `${stmt.fromPathLabel} → ${stmt.valueLabel}`,
        });
        visited.add(stmt.valueQid);
      }
    }

    currentLevel = nextLevelCandidates.slice(0, maxWidthPerLevel);
  }

  con?.log(`[wikidata:deep] walk complete — ${pins.length} pin(s) found`);
  return pins;
}

// ── Fetch ALL statements on an entity in ProfileViewer format ─────────────────
// Covers Q-items, dates, strings and URLs — ready to pass straight to setProfileData.
export async function fetchAllStatements(qid, { con } = {}) {
  con?.log(`[wikidata] fetchAllStatements: querying all statements for ${qid}`);
  // ?prop → ?propLabel, ?value → ?valueLabel via label service convention
  const sparql = `
    SELECT DISTINCT ?prop ?propLabel ?value ?valueLabel WHERE {
      wd:${qid} ?claim ?value .
      ?prop wikibase:directClaim ?claim .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" }
    }
    ORDER BY ?prop
    LIMIT 100`;
  try {
    const rows   = await runSparql(sparql, { con });
    con?.log(`[wikidata] fetchAllStatements: ${rows.length} raw row(s) for ${qid}`);
    const propMap = new Map();

    for (const row of rows) {
      const propId   = row.prop?.value.split('/').pop();
      const propLabel = row.propLabel?.value || propId || '';
      const rawValue = row.value?.value || '';
      if (!propId || !rawValue) continue;

      let display = row.valueLabel?.value || rawValue;
      let type    = 'string';

      if (rawValue.startsWith('http://www.wikidata.org/entity/')) {
        type = 'string';                              // Q-item: show its label
      } else if (propId === 'P18' || propId === 'P154' || propId === 'P41') {
        type    = 'image';
        display = rawValue;
      } else if ((rawValue.startsWith('http://') || rawValue.startsWith('https://')) &&
                 !rawValue.includes('wikidata.org')) {
        type    = 'url';
        display = rawValue;
      } else if (/^\d{4}-\d{2}-\d{2}T/.test(rawValue)) {
        display = rawValue.slice(0, 10);              // YYYY-MM-DD only
      }

      if (!propMap.has(propId)) {
        propMap.set(propId, { id: propId, label: propLabel, type, values: [] });
      }
      const prop = propMap.get(propId);
      if (!prop.values.some(v => v.raw === rawValue)) {
        prop.values.push({ display, raw: rawValue });
      }
    }

    const result = Array.from(propMap.values());
    con?.log(`[wikidata] fetchAllStatements: ${result.length} distinct property/properties for ${qid}`);
    return result;
  } catch (err) {
    con?.warn(`[wikidata] fetchAllStatements failed for ${qid}: ${err.message}`);
    return [];
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

// ── People search pin builder ─────────────────────────────────────────────

/**
 * Given an already-resolved QID and the original search term,
 * fetches birth/death data via SPARQL and returns raw pin objects.
 * Returns { pins, personName, wikipediaUrl }.
 * Caller is responsible for assigning group fields and IDs.
 */
export async function buildPeopleSearchPins(qid, searchTerm, { con } = {}) {
  const propDefs = [
    { id: 'P569', label: 'Birth', sparqlVar: 'birthDate', placeId: 'P19', placeVar: 'birthPlace' },
    { id: 'P570', label: 'Death', sparqlVar: 'deathDate', placeId: 'P20', placeVar: 'deathPlace' },
  ];

  let selectClause = 'SELECT ?itemLabel ?wikipediaUrl';
  let whereClause  = `
    OPTIONAL {
      ?article schema:about wd:${qid};
               schema:isPartOf <https://en.wikipedia.org/>;
               schema:name ?wikipediaTitle.
      BIND(IRI(CONCAT("https://en.wikipedia.org/wiki/", ENCODE_FOR_URI(?wikipediaTitle))) AS ?wikipediaUrl)
    }`;

  propDefs.forEach(prop => {
    selectClause += ` ?${prop.sparqlVar}`;
    if (prop.placeVar) selectClause += ` ?${prop.placeVar}Label ?${prop.placeVar}Coords`;
    whereClause += `
      OPTIONAL {
        wd:${qid} wdt:${prop.id} ?${prop.sparqlVar}.
        ${prop.placeVar ? `OPTIONAL {
          wd:${qid} wdt:${prop.placeId} ?${prop.placeVar}.
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
  if (!results.length) return { pins: [], personName: searchTerm, wikipediaUrl: null };

  const row          = results[0];
  const personName   = row.itemLabel?.value || searchTerm;
  const wikipediaUrl = row.wikipediaUrl?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(personName)}`;
  const pins         = [];

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
        longitude = parseFloat(parts[0]);
        latitude  = parseFloat(parts[1]);
      }
      const labelBinding = row[`${prop.placeVar}Label`];
      if (labelBinding?.value) locationDescription = labelBinding.value;
    }

    pins.push({
      title:        `${personName} — ${prop.label}`,
      description:  `${prop.label} of ${personName}${prop.placeVar ? ` in ${locationDescription}` : ''}.`,
      year,
      date:         { start: datePart, end: null },
      latitude,     longitude,
      category:     'people',
      significance: 'global',
      source:       'Wikidata SPARQL',
      wikipedia_url: wikipediaUrl,
    });
  });

  return { pins, personName, wikipediaUrl };
}

// ── People life-event pin enricher ───────────────────────────────────────────
/**
 * Fetches positions, employers, education, residences and work locations
 * for a person with qualifier start/end dates where Wikidata has them.
 * Returns raw pins in the same shape as buildPeopleSearchPins — no id/group fields.
 */
export async function fetchPersonEventPins(qid, personName, birthYear, wikipediaUrl, { con } = {}) {
  con?.log(`[wikidata] fetching life-event pins for ${qid} (${personName})…`);

  const sparql = `SELECT ?propLabel ?entity ?entityLabel ?coords ?startDate ?endDate WHERE {`
    + ` { wd:${qid} p:P39  ?stmt . ?stmt ps:P39  ?entity . ?entity wdt:P625 ?coords .`
    + `   OPTIONAL { ?stmt pq:P580 ?startDate } OPTIONAL { ?stmt pq:P582 ?endDate }`
    + `   BIND("position held" AS ?propLabel) }`
    + ` UNION { wd:${qid} p:P108 ?stmt . ?stmt ps:P108 ?entity . ?entity wdt:P625 ?coords .`
    + `   OPTIONAL { ?stmt pq:P580 ?startDate } OPTIONAL { ?stmt pq:P582 ?endDate }`
    + `   BIND("employer" AS ?propLabel) }`
    + ` UNION { wd:${qid} p:P69  ?stmt . ?stmt ps:P69  ?entity . ?entity wdt:P625 ?coords .`
    + `   OPTIONAL { ?stmt pq:P580 ?startDate } OPTIONAL { ?stmt pq:P582 ?endDate }`
    + `   BIND("educated at" AS ?propLabel) }`
    + ` UNION { wd:${qid} p:P551 ?stmt . ?stmt ps:P551 ?entity . ?entity wdt:P625 ?coords .`
    + `   OPTIONAL { ?stmt pq:P580 ?startDate } OPTIONAL { ?stmt pq:P582 ?endDate }`
    + `   BIND("residence" AS ?propLabel) }`
    + ` UNION { wd:${qid} p:P937 ?stmt . ?stmt ps:P937 ?entity . ?entity wdt:P625 ?coords .`
    + `   OPTIONAL { ?stmt pq:P580 ?startDate } OPTIONAL { ?stmt pq:P582 ?endDate }`
    + `   BIND("work location" AS ?propLabel) }`
    + ` SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" }`
    + ` } LIMIT 30`;

  const parseYear = (isoString) => {
    if (!isoString) return null;
    const match = isoString.match(/^(-?\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  try {
    const endpointUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    con?.log(`[wikidata] fetchPersonEventPins URL length: ${endpointUrl.length}`);
    const response = await fetch(endpointUrl, { headers: { Accept: 'application/sparql-results+json' } });
    if (!response.ok) throw new Error(`SPARQL ${response.status}: ${response.statusText}`);
    const data = await response.json();
    const rows = data.results?.bindings || [];
    con?.log(`[wikidata] fetchPersonEventPins: ${rows.length} row(s) for ${personName}`);

    const pins = [];
    for (const row of rows) {
      const propLabel   = row.propLabel?.value   || '';
      const entityLabel = row.entityLabel?.value || row.entity?.value || '';
      const rawCoords   = row.coords?.value      || '';
      if (!rawCoords) continue;

      const coordParts = rawCoords.replace('Point(', '').replace(')', '').split(' ');
      const longitude  = parseFloat(coordParts[0]);
      const latitude   = parseFloat(coordParts[1]);
      if (isNaN(latitude) || isNaN(longitude)) continue;

      const rawStart  = row.startDate?.value || null;
      const rawEnd    = row.endDate?.value   || null;
      const startYear = parseYear(rawStart);
      const endYear   = parseYear(rawEnd);
      const year      = startYear || endYear || birthYear;
      if (!year) continue;

      const dateRange = startYear && endYear ? ` (${startYear}–${endYear})`
                      : startYear            ? ` (from ${startYear})`
                      : endYear              ? ` (until ${endYear})`
                      : '';

      pins.push({
        title:        `${personName} — ${propLabel}${dateRange}: ${entityLabel}`,
        description:  `${propLabel}${dateRange}: ${entityLabel}.`,
        year,
        date:         { start: rawStart, end: rawEnd },
        latitude,
        longitude,
        category:     'people',
        significance: 'national',
        source:       'Wikidata SPARQL',
        wikipedia_url: wikipediaUrl || null,
      });
    }
    con?.log(`[wikidata] fetchPersonEventPins: ${pins.length} mappable pin(s) for ${personName}`);
    return pins;
  } catch (err) {
    con?.warn(`[wikidata] fetchPersonEventPins failed for ${qid}: ${err.message}`);
    return [];
  }
}

// ── Event pin builder ─────────────────────────────────────────────────────

/**
 * Converts already-fetched eventData into an array of pin objects.
 * groupId, groupColor, and wikipediaUrl must be resolved by the caller first.
 */
export function buildEventPins(eventData, label, groupId, groupColor, wikipediaUrl, category = 'events') {
  const { lat, lng, locationLabel, startDate, endDate, pointInTime } = eventData;

  const basePin = {
    latitude:      lat  ?? 0,
    longitude:     lng  ?? 0,
    category,
    significance:  'global',
    source:        'Wikidata Events',
    search_group:  groupId,
    search_color:  groupColor,
    search_query:  label,
    wikipedia_url: wikipediaUrl || '',
    links:         wikipediaUrl ? [{ label: 'Wikipedia', url: wikipediaUrl }] : [],
  };

  const pins = [];

  if (pointInTime && !startDate && !endDate) {
    const datePart = parseSparqlDate(pointInTime);
    const year     = datePartToYear(datePart);
    pins.push({
      ...basePin,
      id:          `event_${groupId}_0`,
      title:       label,
      description: `${label}${locationLabel ? ` at ${locationLabel}` : ''}.`,
      year,
      date: { start: datePart, end: null },
    });
  } else {
    if (startDate) {
      const datePart = parseSparqlDate(startDate);
      const year     = datePartToYear(datePart);
      pins.push({
        ...basePin,
        id:          `event_${groupId}_start`,
        title:       `${label} — Start`,
        description: `Start of ${label}${locationLabel ? ` at ${locationLabel}` : ''}.`,
        year,
        date: { start: datePart, end: null },
      });
    }
    if (endDate) {
      const datePart = parseSparqlDate(endDate);
      const year     = datePartToYear(datePart);
      pins.push({
        ...basePin,
        id:          `event_${groupId}_end`,
        title:       `${label} — End`,
        description: `End of ${label}${locationLabel ? ` at ${locationLabel}` : ''}.`,
        year,
        date: { start: datePart, end: null },
      });
    }
  }

  return pins;
}
// ── Organisation search ───────────────────────────────────────────────────────

/**
 * Property definitions for an organisation profile.
 * Pass to fetchEntityProfile to get a structured org profile.
 */
export const ORG_PROFILE_PROPS = [
  { id: 'P571', label: 'Founded',            type: 'date'   },
  { id: 'P576', label: 'Dissolved',          type: 'date'   },
  { id: 'P740', label: 'Formation location', type: 'place'  },
  { id: 'P159', label: 'Headquarters',       type: 'place'  },
  { id: 'P112', label: 'Founder',            type: 'person' },
  { id: 'P169', label: 'Chief executive',    type: 'person' },
  { id: 'P856', label: 'Website',            type: 'url'    },
  { id: 'P17',  label: 'Country',            type: 'place'  },
  { id: 'P452', label: 'Industry',           type: 'string' },
  { id: 'P154', label: 'Logo',               type: 'image'  },
];

/**
 * Fetch map pins for an organisation.
 * Tries P740 (location of formation) first; falls back to P159 (headquarters).
 * Uses P571 (inception date) for the founding pin, P576 (dissolution) for the closing pin.
 * Returns { pins, orgName, wikipediaUrl } — no IDs; caller stamps them.
 */
export async function buildOrgSearchPins(qid, orgName, { con } = {}) {
  const sparqlQuery = `
    SELECT ?itemLabel ?wikipediaUrl ?inceptionDate ?dissolutionDate
           ?formationPlace ?formationPlaceLabel ?formationPlaceCoords
           ?hqPlace ?hqPlaceLabel ?hqPlaceCoords
    WHERE {
      OPTIONAL {
        ?article schema:about wd:${qid};
                 schema:isPartOf <https://en.wikipedia.org/>;
                 schema:name ?wikiTitle.
        BIND(IRI(CONCAT("https://en.wikipedia.org/wiki/", ENCODE_FOR_URI(?wikiTitle))) AS ?wikipediaUrl)
      }
      OPTIONAL { wd:${qid} wdt:P571 ?inceptionDate . }
      OPTIONAL { wd:${qid} wdt:P576 ?dissolutionDate . }
      OPTIONAL {
        wd:${qid} wdt:P740 ?formationPlace .
        OPTIONAL { ?formationPlace wdt:P625 ?formationPlaceCoords . }
      }
      OPTIONAL {
        wd:${qid} wdt:P159 ?hqPlace .
        OPTIONAL { ?hqPlace wdt:P625 ?hqPlaceCoords . }
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    } LIMIT 1`;

  const endpointUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
  con?.log(`[sparql] org search: "${orgName}"`);

  const response = await fetch(endpointUrl, { headers: { Accept: 'application/sparql-results+json' } });
  if (!response.ok) throw new Error(`SPARQL error: ${response.statusText}`);
  const data    = await response.json();
  const results = data.results.bindings;
  if (!results.length) return { pins: [], orgName, wikipediaUrl: null };

  const row          = results[0];
  const resolvedName = row.itemLabel?.value || orgName;
  const wikipediaUrl = row.wikipediaUrl?.value
    || `https://en.wikipedia.org/wiki/${encodeURIComponent(resolvedName)}`;

  // ── Resolve location: P740 inline coords → P740 entity → P159 inline → P159 entity ──
  let latitude = 0, longitude = 0, locationDescription = resolvedName;

  const parseCoordsString = (pointStr) => {
    if (!pointStr) return null;
    const parts = pointStr.replace('Point(', '').replace(')', '').split(' ');
    return { lng: parseFloat(parts[0]), lat: parseFloat(parts[1]) };
  };

  const formationCoordsVal = row.formationPlaceCoords?.value;
  const hqCoordsVal        = row.hqPlaceCoords?.value;

  if (formationCoordsVal) {
    const c = parseCoordsString(formationCoordsVal);
    if (c) { latitude = c.lat; longitude = c.lng; locationDescription = row.formationPlaceLabel?.value || 'Formation location'; }
  } else if (hqCoordsVal) {
    const c = parseCoordsString(hqCoordsVal);
    if (c) { latitude = c.lat; longitude = c.lng; locationDescription = row.hqPlaceLabel?.value || 'Headquarters'; }
  } else if (row.formationPlace?.value) {
    const formationQid = row.formationPlace.value.split('/').pop();
    const resolved     = await resolveEntityCoordinates(formationQid, { con });
    if (resolved) { latitude = resolved.lat; longitude = resolved.lng; locationDescription = row.formationPlaceLabel?.value || 'Formation location'; }
  } else if (row.hqPlace?.value) {
    const hqQid    = row.hqPlace.value.split('/').pop();
    const resolved = await resolveEntityCoordinates(hqQid, { con });
    if (resolved) { latitude = resolved.lat; longitude = resolved.lng; locationDescription = row.hqPlaceLabel?.value || 'Headquarters'; }
  }

  // ── Build pins ────────────────────────────────────────────────────────────────
  const pins = [];

  if (row.inceptionDate?.value) {
    const datePart    = parseSparqlDate(row.inceptionDate.value);
    const inceptionYear = datePartToYear(datePart);
    if (inceptionYear) {
      pins.push({
        title:        `${resolvedName} — Founded`,
        description:  `${resolvedName} founded in ${locationDescription}.`,
        year:         inceptionYear,
        date:         { start: datePart, end: null },
        latitude, longitude,
        category:     'organisations',
        significance: 'national',
        source:       'Wikidata SPARQL',
        wikipedia_url: wikipediaUrl,
      });
    }
  }

  if (row.dissolutionDate?.value) {
    const datePart       = parseSparqlDate(row.dissolutionDate.value);
    const dissolutionYear = datePartToYear(datePart);
    if (dissolutionYear) {
      pins.push({
        title:        `${resolvedName} — Dissolved`,
        description:  `${resolvedName} dissolved.`,
        year:         dissolutionYear,
        date:         { start: datePart, end: null },
        latitude, longitude,
        category:     'organisations',
        significance: 'national',
        source:       'Wikidata SPARQL',
        wikipedia_url: wikipediaUrl,
      });
    }
  }

  // If no dated pins but we have a location, make an undated location pin
  if (pins.length === 0 && (latitude !== 0 || longitude !== 0)) {
    pins.push({
      title:        resolvedName,
      description:  `${resolvedName} — location: ${locationDescription}.`,
      year:         new Date().getFullYear(),
      date:         null,
      latitude, longitude,
      category:     'organisations',
      significance: 'national',
      source:       'Wikidata SPARQL',
      wikipedia_url: wikipediaUrl,
    });
  }

  return { pins, orgName: resolvedName, wikipediaUrl };
}

// ── People profile ────────────────────────────────────────────────────────────

export const PERSON_PROFILE_PROPS = [
  { id: 'P18',  label: 'Portrait',       type: 'image'  },
  { id: 'P569', label: 'Born',           type: 'date'   },
  { id: 'P570', label: 'Died',           type: 'date'   },
  { id: 'P19',  label: 'Place of birth', type: 'place'  },
  { id: 'P20',  label: 'Place of death', type: 'place'  },
  { id: 'P27',  label: 'Nationality',    type: 'place'  },
  { id: 'P106', label: 'Occupation',     type: 'string' },
  { id: 'P21',  label: 'Gender',         type: 'string' },
  { id: 'P26',  label: 'Spouse',         type: 'person' },
  { id: 'P22',  label: 'Father',         type: 'person' },
  { id: 'P25',  label: 'Mother',         type: 'person' },
  { id: 'P40',  label: 'Children',       type: 'person' },
  { id: 'P69',  label: 'Educated at',    type: 'string' },
  { id: 'P166', label: 'Awards',         type: 'string' },
];

/**
 * Generic entity profile fetcher.
 * propDefs: array of { id: 'P571', label: 'Founded', type: 'date' }
 * Returns { properties: [{ id, label, type, values: [{ display, raw }] }] }
 * Reuse for people (PERSON_PROFILE_PROPS), places, etc. by passing different propDefs.
 */
export async function fetchEntityProfile(qid, propDefs, { con } = {}) {
  const pids = propDefs.map(p => p.id);
  con?.log(`[sparql] fetching profile for ${qid} (${propDefs.length} properties)`);

  const rows = await fetchEntityProperties(qid, pids, { con });
  if (!rows?.length) return { properties: [] };

  // Collect all unique values per property across all SPARQL rows
  const valuesByPropId = {};

  rows.forEach(row => {
    propDefs.forEach(def => {
      const rawBinding   = row[`p${def.id}`];
      const labelBinding = row[`p${def.id}Label`];
      if (!rawBinding?.value) return;

      if (!valuesByPropId[def.id]) valuesByPropId[def.id] = [];

      const rawValue  = rawBinding.value;
      const alreadyIn = valuesByPropId[def.id].some(v => v.raw === rawValue);
      if (alreadyIn) return; // deduplicate

      // Format display value based on type hint
      let displayValue = labelBinding?.value || rawValue;

      if (def.type === 'date' && rawValue.match(/^-?\d{4}/)) {
        const datePart  = parseSparqlDate(rawValue);
        const yearValue = datePartToYear(datePart);
        if (yearValue) displayValue = String(yearValue);
      }
      if (def.type === 'image' || def.type === 'url') {
        displayValue = rawValue; // keep raw URL — renderer will handle it
      }

      valuesByPropId[def.id].push({ display: displayValue, raw: rawValue });
    });
  });

  const properties = propDefs
    .map(def => {
      const values = valuesByPropId[def.id];
      if (!values?.length) return null;
      return { id: def.id, label: def.label, type: def.type || 'string', values };
    })
    .filter(Boolean);

  return { properties };
}
// ── Living entity profile properties ─────────────────────────────────────────
export const LIVING_ENTITY_PROFILE_PROPS = [
  { id: 'P18',   label: 'Image',               type: 'image'  },
  { id: 'P2567', label: 'Common name',          type: 'string' },
  { id: 'P225',  label: 'Taxon name',           type: 'string' },
  { id: 'P105',  label: 'Taxon rank',           type: 'string' },
  { id: 'P171',  label: 'Parent taxon',         type: 'string' },
  { id: 'P141',  label: 'Conservation status',  type: 'string' },
  { id: 'P183',  label: 'Endemic to',           type: 'place'  },
  { id: 'P569',  label: 'Born / hatched',       type: 'date'   },
  { id: 'P570',  label: 'Died',                 type: 'date'   },
  { id: 'P19',   label: 'Place of origin',      type: 'place'  },
  { id: 'P17',   label: 'Country',              type: 'place'  },
];

// ── Living entity individual pin builder ──────────────────────────────────────
// Works like buildPeopleSearchPins but uses animal-relevant place properties
// and returns entityName (not personName) in its result object.
export async function buildLivingEntityPins(qid, searchTerm, { con } = {}) {
  con?.log(`[wikidata] building living entity pins for ${qid}…`);

  const propDefs = [
    { id: 'P569', label: 'Born / hatched', sparqlVar: 'birthDate', placeId: 'P19', placeVar: 'originPlace' },
    { id: 'P570', label: 'Died',           sparqlVar: 'deathDate', placeId: 'P20', placeVar: 'deathPlace'  },
  ];

  let selectClause = 'SELECT ?itemLabel ?wikipediaUrl';
  let whereClause  = `
    OPTIONAL {
      ?article schema:about wd:${qid};
               schema:isPartOf <https://en.wikipedia.org/>;
               schema:name ?wikipediaTitle.
      BIND(IRI(CONCAT("https://en.wikipedia.org/wiki/", ENCODE_FOR_URI(?wikipediaTitle))) AS ?wikipediaUrl)
    }`;

  propDefs.forEach(prop => {
    selectClause += ` ?${prop.sparqlVar}`;
    if (prop.placeVar) selectClause += ` ?${prop.placeVar}Label ?${prop.placeVar}Coords`;
    whereClause += `
      OPTIONAL {
        wd:${qid} wdt:${prop.id} ?${prop.sparqlVar}.
        ${prop.placeVar ? `OPTIONAL {
          wd:${qid} wdt:${prop.placeId} ?${prop.placeVar}.
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
  if (!results.length) return { pins: [], entityName: searchTerm, wikipediaUrl: null };

  const row          = results[0];
  const entityName   = row.itemLabel?.value || searchTerm;
  const wikipediaUrl = row.wikipediaUrl?.value || `https://en.wikipedia.org/wiki/${encodeURIComponent(entityName)}`;
  const pins         = [];

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
        longitude = parseFloat(parts[0]);
        latitude  = parseFloat(parts[1]);
      }
      const labelBinding = row[`${prop.placeVar}Label`];
      if (labelBinding?.value) locationDescription = labelBinding.value;
    }

    pins.push({
      title:        `${entityName} — ${prop.label}`,
      description:  `${prop.label} of ${entityName}${prop.placeVar ? ` in ${locationDescription}` : ''}.`,
      year,
      date:         { start: datePart, end: null },
      latitude,     longitude,
      category:     'livingEntities',
      significance: 'global',
      source:       'Wikidata SPARQL',
      wikipedia_url: wikipediaUrl,
    });
  });

  return { pins, entityName, wikipediaUrl };
}

// ── Artificial agent profile properties ───────────────────────────────────────
export const ARTIFICIAL_AGENT_PROFILE_PROPS = [
  { id: 'P18',   label: 'Image',                type: 'image'  },
  { id: 'P571',  label: 'Created / Inception',  type: 'date'   },
  { id: 'P576',  label: 'Dissolved / Ended',    type: 'date'   },
  { id: 'P178',  label: 'Developer',            type: 'string' },
  { id: 'P123',  label: 'Publisher',            type: 'string' },
  { id: 'P277',  label: 'Programming language', type: 'string' },
  { id: 'P856',  label: 'Website',              type: 'url'    },
  { id: 'P495',  label: 'Country of origin',    type: 'place'  },
  { id: 'P31',   label: 'Instance of',          type: 'string' },
  { id: 'P366',  label: 'Main use',             type: 'string' },
];

// ── Artificial agent pin builder ──────────────────────────────────────────────
// Fetches inception (P571) and dissolution (P576) dates.
// Location fallback chain: P740 → P276 → P131 → P361 (part of, resolved) → P495
export async function buildArtificialAgentPins(qid, agentName, { con } = {}) {
  con?.log(`[wikidata] building artificial agent pins for ${qid}…`);

  const sparqlQuery = `
    SELECT ?itemLabel ?wikipediaUrl ?inceptionDate ?endDate
           ?formationPlace ?formationPlaceLabel ?formationPlaceCoords
           ?locationPlace  ?locationPlaceLabel  ?locationPlaceCoords
           ?adminPlace     ?adminPlaceLabel     ?adminPlaceCoords
           ?partOfPlace    ?partOfPlaceLabel
           ?directCountry  ?directCountryLabel  ?directCountryCoords
           ?countryPlace   ?countryPlaceLabel   ?countryPlaceCoords
    WHERE {
      OPTIONAL {
        ?article schema:about wd:${qid};
                 schema:isPartOf <https://en.wikipedia.org/>;
                 schema:name ?wikiTitle.
        BIND(IRI(CONCAT("https://en.wikipedia.org/wiki/", ENCODE_FOR_URI(?wikiTitle))) AS ?wikipediaUrl)
      }
      OPTIONAL { wd:${qid} wdt:P571 ?inceptionDate . }
      OPTIONAL { wd:${qid} wdt:P576 ?endDate . }
      OPTIONAL {
        wd:${qid} wdt:P740 ?formationPlace .
        OPTIONAL { ?formationPlace wdt:P625 ?formationPlaceCoords . }
      }
      OPTIONAL {
        wd:${qid} wdt:P276 ?locationPlace .
        OPTIONAL { ?locationPlace wdt:P625 ?locationPlaceCoords . }
      }
      OPTIONAL {
        wd:${qid} wdt:P131 ?adminPlace .
        OPTIONAL { ?adminPlace wdt:P625 ?adminPlaceCoords . }
      }
              OPTIONAL { wd:${qid} wdt:P361 ?partOfPlace . }
        OPTIONAL {
          wd:${qid} wdt:P17 ?directCountry .
          OPTIONAL { ?directCountry wdt:P625 ?directCountryCoords . }
        }
        OPTIONAL {
          wd:${qid} wdt:P495 ?countryPlace .
        OPTIONAL { ?countryPlace wdt:P625 ?countryPlaceCoords . }
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    } LIMIT 1`;

  const endpointUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
  const response = await fetch(endpointUrl, { headers: { Accept: 'application/sparql-results+json' } });
  if (!response.ok) throw new Error(`SPARQL error: ${response.statusText}`);
  const data    = await response.json();
  const results = data.results.bindings;
  if (!results.length) return { pins: [], agentName, wikipediaUrl: null };

  const row          = results[0];
  const resolvedName = row.itemLabel?.value || agentName;
  const wikipediaUrl = row.wikipediaUrl?.value
    || `https://en.wikipedia.org/wiki/${encodeURIComponent(resolvedName)}`;

  const parseCoordsString = (pointStr) => {
    if (!pointStr) return null;
    const parts = pointStr.replace('Point(', '').replace(')', '').split(' ');
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  };

  // ── Location resolution — cascade through properties in priority order ────
  // Inline coords are tried first (fast, no extra round-trip).
  // Entity resolution is the fallback when only a QID is returned.
  // P361 (part of) is last before country — resolves the parent entity's coords.
  let latitude = 0, longitude = 0, locationDescription = resolvedName;

  const tryInline = (coordsValue, labelValue, description) => {
    const c = parseCoordsString(coordsValue);
    if (!c) return false;
    latitude = c.lat; longitude = c.lng;
    locationDescription = labelValue || description;
    return true;
  };

  const tryEntityResolve = async (entityValue, labelValue, description) => {
    if (!entityValue) return false;
    const entityQid = entityValue.split('/').pop();
    const resolved  = await resolveEntityCoordinates(entityQid, { con });
    if (!resolved) return false;
    latitude = resolved.lat; longitude = resolved.lng;
    locationDescription = labelValue || description;
    return true;
  };

  // 1. P740 — location of formation (inline)
  if (!tryInline(row.formationPlaceCoords?.value, row.formationPlaceLabel?.value, 'Formation location'))
  // 2. P276 — physical location (inline)
  if (!tryInline(row.locationPlaceCoords?.value,  row.locationPlaceLabel?.value,  'Location'))
  // 3. P131 — administrative territory (inline)
  if (!tryInline(row.adminPlaceCoords?.value,     row.adminPlaceLabel?.value,     'Administrative location'))
       // 4. P17 — direct country (inline)
     if (!tryInline(row.directCountryCoords?.value,  row.directCountryLabel?.value,  'Country'))
     // 5. P495 — country of origin (inline)
     if (!tryInline(row.countryPlaceCoords?.value,   row.countryPlaceLabel?.value,   'Country of origin')) {
       // No inline coords found — try entity resolution in the same order
       const resolved =
         await tryEntityResolve(row.formationPlace?.value,  row.formationPlaceLabel?.value,  'Formation location') ||
         await tryEntityResolve(row.locationPlace?.value,   row.locationPlaceLabel?.value,   'Location')           ||
         await tryEntityResolve(row.adminPlace?.value,      row.adminPlaceLabel?.value,      'Administrative location') ||
         // 6. P361 — part of: resolve the parent entity's own coordinates
         await tryEntityResolve(row.partOfPlace?.value,     row.partOfPlaceLabel?.value,     'Parent institution')  ||
         await tryEntityResolve(row.directCountry?.value,   row.directCountryLabel?.value,   'Country')             ||
         await tryEntityResolve(row.countryPlace?.value,    row.countryPlaceLabel?.value,    'Country of origin');

    if (resolved) con?.log(`[wikidata] resolved location via entity lookup: ${locationDescription}`);
    else con?.warn(`[wikidata] no location resolved for ${qid} — pin will have lat/lng 0`);
  }

  // ── Build pins ────────────────────────────────────────────────────────────
  const pins = [];

  if (row.inceptionDate?.value) {
    const datePart      = parseSparqlDate(row.inceptionDate.value);
    const inceptionYear = datePartToYear(datePart);
    if (inceptionYear) {
      pins.push({
        title:        `${resolvedName} — Created`,
        description:  `${resolvedName} created / first deployed in ${locationDescription}.`,
        year:         inceptionYear,
        date:         { start: datePart, end: null },
        latitude,     longitude,
        category:     'artificialAgents',
        significance: 'national',
        source:       'Wikidata SPARQL',
        wikipedia_url: wikipediaUrl,
      });
    }
  }

  if (row.endDate?.value) {
    const datePart = parseSparqlDate(row.endDate.value);
    const endYear  = datePartToYear(datePart);
    if (endYear) {
      pins.push({
        title:        `${resolvedName} — Ended`,
        description:  `${resolvedName} decommissioned / dissolved.`,
        year:         endYear,
        date:         { start: datePart, end: null },
        latitude,     longitude,
        category:     'artificialAgents',
        significance: 'national',
        source:       'Wikidata SPARQL',
        wikipedia_url: wikipediaUrl,
      });
    }
  }

  // If no dated pins but we have a location, make an undated presence pin
  if (pins.length === 0 && (latitude !== 0 || longitude !== 0)) {
    pins.push({
      title:        resolvedName,
      description:  `${resolvedName} — ${locationDescription}.`,
      year:         new Date().getFullYear(),
      date:         null,
      latitude,     longitude,
      category:     'artificialAgents',
      significance: 'national',
      source:       'Wikidata SPARQL',
      wikipedia_url: wikipediaUrl,
    });
  }

   const inceptionYear = row.inceptionDate?.value
     ? datePartToYear(parseSparqlDate(row.inceptionDate.value))
     : null;
   return { pins, agentName: resolvedName, wikipediaUrl, locationResolved: (latitude !== 0 || longitude !== 0), inceptionYear };
}

// ── Convex hull utility ───────────────────────────────────────────────────────
// Gift-wrapping (Jarvis march) algorithm.
// Input:  array of { lat, lng } objects
// Output: array of [lat, lng] pairs forming the hull boundary, or null if < 3 points.
export function computeConvexHull(latLngPoints) {
  const pts = latLngPoints.filter(p => p != null && isFinite(p.lat) && isFinite(p.lng));
  if (pts.length < 3) return null;

  const cross = (O, A, B) =>
    (A.lng - O.lng) * (B.lat - O.lat) - (A.lat - O.lat) * (B.lng - O.lng);

  // Start from the leftmost point
  let startIdx = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].lng < pts[startIdx].lng) startIdx = i;
  }

  const hull = [];
  let current = startIdx;
  let safety  = 0;

  do {
    hull.push([pts[current].lat, pts[current].lng]);
    let next = (current + 1) % pts.length;
    for (let i = 0; i < pts.length; i++) {
      if (cross(pts[current], pts[next], pts[i]) < 0) next = i;
    }
    current = next;
    safety++;
  } while (current !== startIdx && safety <= pts.length + 2);

  return hull.length >= 3 ? hull : null;
}

// ── Phenomena spread pins ─────────────────────────────────────────────────────
// Queries for sub-events and affected locations of a phenomenon.
// Casts a wide net: parts of, located at, facets of.
// Returns { pins, phenomenonName, wikipediaUrl }.
export async function buildPhenomenaSpreadPins(qid, phenomenonName, { con } = {}) {
  con?.log(`[wikidata] fetching phenomena spread for ${qid} (${phenomenonName})…`);

  const sparql = `SELECT ?subEvent ?subEventLabel ?coords ?pointInTime ?startDate WHERE {`
    + ` { ?subEvent wdt:P361  wd:${qid} . ?subEvent wdt:P625 ?coords . }`
    + ` UNION { wd:${qid} wdt:P276 ?subEvent . ?subEvent wdt:P625 ?coords . }`
    + ` UNION { ?subEvent wdt:P276  wd:${qid} . ?subEvent wdt:P625 ?coords . }`
    + ` UNION { ?subEvent wdt:P1269 wd:${qid} . ?subEvent wdt:P625 ?coords . }`
    + ` OPTIONAL { ?subEvent wdt:P585 ?pointInTime }`
    + ` OPTIONAL { ?subEvent wdt:P580 ?startDate }`
    + ` SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" }`
    + ` } LIMIT 40`;

  const parseYear = (isoString) => {
    if (!isoString) return null;
    const match = isoString.match(/^(-?\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  try {
    const endpointUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    con?.log(`[wikidata] buildPhenomenaSpreadPins URL length: ${endpointUrl.length}`);
    const response = await fetch(endpointUrl, { headers: { Accept: 'application/sparql-results+json' } });
    if (!response.ok) throw new Error(`SPARQL ${response.status}: ${response.statusText}`);
    const data = await response.json();
    const rows = data.results?.bindings || [];
    con?.log(`[wikidata] buildPhenomenaSpreadPins: ${rows.length} row(s) for ${phenomenonName}`);

    const wikipediaUrl = await resolveWikipediaUrl(qid, { con });

    const pins = [];
    for (const row of rows) {
      const subEventLabel = row.subEventLabel?.value || row.subEvent?.value || '';
      const rawCoords     = row.coords?.value        || '';
      if (!rawCoords) continue;

      const coordParts = rawCoords.replace('Point(', '').replace(')', '').split(' ');
      const longitude  = parseFloat(coordParts[0]);
      const latitude   = parseFloat(coordParts[1]);
      if (isNaN(latitude) || isNaN(longitude)) continue;

      const rawPoint  = row.pointInTime?.value || null;
      const rawStart  = row.startDate?.value   || null;
      const year      = parseYear(rawPoint) || parseYear(rawStart) || null;

      pins.push({
        title:        `${phenomenonName} — ${subEventLabel}`,
        description:  `Part of ${phenomenonName}: ${subEventLabel}.`,
        year:         year || new Date().getFullYear(),
        date:         { start: rawPoint || rawStart || null, end: null },
        latitude,
        longitude,
        category:     'phenomena',
        significance: 'national',
        source:       'Wikidata SPARQL',
        wikipedia_url: wikipediaUrl || null,
      });
    }

    con?.log(`[wikidata] buildPhenomenaSpreadPins: ${pins.length} mappable pin(s) for ${phenomenonName}`);
    return { pins, phenomenonName, wikipediaUrl };
  } catch (err) {
    con?.warn(`[wikidata] buildPhenomenaSpreadPins failed for ${qid}: ${err.message}`);
    return { pins: [], phenomenonName, wikipediaUrl: null };
  }
}
