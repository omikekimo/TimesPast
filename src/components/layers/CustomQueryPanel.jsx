import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Grab, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { resolveTextToEntities } from "@/lib/wikidataUtils";

// ── Property definitions ─────────────────────────────────────────────────────
const PROPERTY_CATEGORIES = [
  {
    id: "generic", label: "Generic", color: "bg-gray-100 text-gray-800",
    properties: [
      { pid: "P31",   label: "instance of" },
      { pid: "P279",  label: "subclass of" },
      { pid: "P361",  label: "part of" },
      { pid: "P527",  label: "has part" },
      { pid: "P138",  label: "named after" },
      { pid: "P571",  label: "inception / founded" },
      { pid: "P576",  label: "dissolved / abolished" },
      { pid: "P580",  label: "start time" },
      { pid: "P582",  label: "end time" },
      { pid: "P585",  label: "point in time" },
      { pid: "P625",  label: "coordinate location" },
      { pid: "P18",   label: "image" },
      { pid: "P856",  label: "official website" },
    ],
  },
  {
    id: "person", label: "Person", color: "bg-amber-100 text-amber-800",
    properties: [
      { pid: "P569",  label: "date of birth" },
      { pid: "P570",  label: "date of death" },
      { pid: "P19",   label: "place of birth" },
      { pid: "P20",   label: "place of death" },
      { pid: "P21",   label: "sex or gender" },
      { pid: "P106",  label: "occupation" },
      { pid: "P1317", label: "floruit (active period)" },
      { pid: "P27",   label: "country of citizenship" },
      { pid: "P22",   label: "father" },
      { pid: "P25",   label: "mother" },
      { pid: "P26",   label: "spouse" },
      { pid: "P40",   label: "child" },
      { pid: "P607",  label: "conflict (military)" },
      { pid: "P410",  label: "military rank" },
      { pid: "P241",  label: "military branch" },
    ],
  },
  {
    id: "place", label: "Place", color: "bg-green-100 text-green-800",
    properties: [
      { pid: "P625",  label: "coordinate location" },
      { pid: "P17",   label: "country" },
      { pid: "P131",  label: "located in administrative entity" },
      { pid: "P30",   label: "continent" },
      { pid: "P571",  label: "inception / founded" },
      { pid: "P576",  label: "dissolved / abolished" },
      { pid: "P36",   label: "capital" },
      { pid: "P84",   label: "architect" },
      { pid: "P186",  label: "material used" },
      { pid: "P149",  label: "architectural style" },
      { pid: "P403",  label: "mouth of watercourse" },
      { pid: "P706",  label: "located on terrain feature" },
      { pid: "P1082", label: "population" },
    ],
  },
  {
    id: "event", label: "Event", color: "bg-red-100 text-red-800",
    properties: [
      { pid: "P276",  label: "location" },
      { pid: "P585",  label: "point in time" },
      { pid: "P580",  label: "start time" },
      { pid: "P582",  label: "end time" },
      { pid: "P710",  label: "participant" },
      { pid: "P664",  label: "organizer" },
      { pid: "P1346", label: "winner" },
      { pid: "P1478", label: "has immediate cause" },
      { pid: "P1534", label: "end cause" },
      { pid: "P726",  label: "candidate (elections)" },
      { pid: "P991",  label: "successful candidate" },
    ],
  },
  {
    id: "works", label: "Works", color: "bg-blue-100 text-blue-800",
    properties: [
      { pid: "P50",   label: "author" },
      { pid: "P57",   label: "director" },
      { pid: "P86",   label: "composer" },
      { pid: "P136",  label: "genre" },
      { pid: "P179",  label: "series" },
      { pid: "P577",  label: "publication date" },
      { pid: "P123",  label: "publisher" },
      { pid: "P170",  label: "creator" },
      { pid: "P180",  label: "depicts" },
      { pid: "P195",  label: "collection" },
      { pid: "P276",  label: "location" },
      { pid: "P495",  label: "country of origin" },
    ],
  },
  {
    id: "organisation", label: "Organisation", color: "bg-purple-100 text-purple-800",
    properties: [
      { pid: "P571",  label: "inception / founded" },
      { pid: "P576",  label: "dissolved / abolished" },
      { pid: "P112",  label: "founded by" },
      { pid: "P740",  label: "location of formation" },
      { pid: "P159",  label: "headquarters location" },
      { pid: "P452",  label: "industry" },
      { pid: "P169",  label: "CEO" },
      { pid: "P1128", label: "employees" },
      { pid: "P355",  label: "subsidiary" },
      { pid: "P199",  label: "business division" },
      { pid: "P118",  label: "league (sports)" },
      { pid: "P115",  label: "home venue (sports)" },
    ],
  },
];

// ── Panel states ─────────────────────────────────────────────────────────────
const STATE = {
  IDLE:            'idle',
  DISAMBIGUATING:  'disambiguating',
  SEARCHING:       'searching',
};

// ── Category selector pill ───────────────────────────────────────────────────
function CategoryPill({ cat, selected, onToggle }) {
  return (
    <button type="button" onClick={() => onToggle(cat.id)}
      className={`px-2 py-0.5 rounded-full border text-[11px] font-medium transition-colors ${
        selected
          ? `${cat.color} border-transparent`
          : "bg-white text-gray-500 border-gray-300 hover:border-gray-500"
      }`}>
      {cat.label}
    </button>
  );
}

// ── Property select row ──────────────────────────────────────────────────────
function CategoryRow({ cat, selectedPid, onPidChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cat.color}`}>
        {cat.label}
      </span>
      <select value={selectedPid} onChange={e => onPidChange(cat.id, e.target.value)}
        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white">
        {cat.properties.map(p => (
          <option key={p.pid} value={p.pid}>{p.label} ({p.pid})</option>
        ))}
      </select>
    </div>
  );
}

// ── Candidate card ───────────────────────────────────────────────────────────
function CandidateCard({ candidate, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(candidate)}
      className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-violet-400 hover:bg-violet-50 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {candidate.label}
            </span>
            <span className="text-[10px] text-gray-400 flex-shrink-0 font-mono">
              {candidate.qid}
            </span>
          </div>
          {candidate.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
              {candidate.description}
            </p>
          )}
        </div>
        <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-violet-400 flex-shrink-0 mt-1"
          onClick={e => { e.stopPropagation(); window.open(candidate.url, '_blank'); }}
        />
      </div>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function CustomQueryPanel({ onSearch, isSearching }) {
  const [searchText, setSearchText]       = useState("");
  const [activeCategories, setActiveCategories] = useState(["generic"]);
  const [selectedPids, setSelectedPids]   = useState(() =>
    Object.fromEntries(PROPERTY_CATEGORIES.map(c => [c.id, c.properties[0].pid]))
  );
  const [showSparql, setShowSparql]       = useState(false);
  const [panelState, setPanelState]       = useState(STATE.IDLE);
  const [candidates, setCandidates]       = useState([]);
  const [resolvedQid, setResolvedQid]     = useState(null);

  const toggleCategory = id =>
    setActiveCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );

  const setPid = (catId, pid) =>
    setSelectedPids(prev => ({ ...prev, [catId]: pid }));

  const activeCats = PROPERTY_CATEGORIES.filter(c => activeCategories.includes(c.id));

  // Build SPARQL preview string
  const buildSparqlPreview = (qid) => {
    const vars    = activeCats.map(c => `?${c.id}`).join(" ");
    const triples = activeCats.map(c =>
      `  OPTIONAL { wd:${qid} wdt:${selectedPids[c.id]} ?${c.id} . }`
    ).join("\n");
    return `SELECT ${vars}\nWHERE {\n${triples}\n}\nLIMIT 10`;
  };

  // Step 1 — resolve text to candidates
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchText.trim() || activeCategories.length === 0) return;
    setPanelState(STATE.DISAMBIGUATING);
    setCandidates([]);
    setResolvedQid(null);

    const found = await resolveTextToEntities(searchText, { limit: 5 });
    setCandidates(found);

    // If only one result, skip disambiguation and go straight to query
    if (found.length === 1) {
      await handleCandidateSelect(found[0]);
    }
  };

  // Step 2 — user picks a candidate, run the query
  const handleCandidateSelect = async (candidate) => {
    setResolvedQid(candidate.qid);
    setPanelState(STATE.SEARCHING);
    await onSearch(candidate.qid, candidate.label, activeCategories, selectedPids);
    setPanelState(STATE.IDLE);
  };

  const handleCancel = () => {
    setPanelState(STATE.IDLE);
    setCandidates([]);
    setResolvedQid(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="w-96 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:border-gray-700">
        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-violet-600" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Custom Query</h3>
            </div>
            <Grab className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Search Wikidata for any entity and select which properties to map.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* ── Search form — always visible ── */}
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                placeholder="e.g. Battle of Hastings, Woodstock…"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>

            {/* Category pills */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Property categories:</p>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_CATEGORIES.map(cat => (
                  <CategoryPill key={cat.id} cat={cat}
                    selected={activeCategories.includes(cat.id)}
                    onToggle={toggleCategory} />
                ))}
              </div>
            </div>

            {/* Property selectors */}
            {activeCats.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Select property per category:</p>
                {activeCats.map(cat => (
                  <CategoryRow key={cat.id} cat={cat}
                    selectedPid={selectedPids[cat.id]}
                    onPidChange={setPid} />
                ))}
              </div>
            )}

            <Button type="submit"
              disabled={panelState === STATE.SEARCHING || !searchText.trim() || activeCategories.length === 0}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium"
            >
              {panelState === STATE.SEARCHING ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Querying Wikidata…</>
              ) : panelState === STATE.DISAMBIGUATING ? (
                <><Search className="w-4 h-4 mr-2" />Search again</>
              ) : (
                <><Search className="w-4 h-4 mr-2" />Build &amp; Run Query</>
              )}
            </Button>
          </form>

          {/* ── Disambiguation panel — expands inline ── */}
          {panelState === STATE.DISAMBIGUATING && candidates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">
                  {candidates.length} result{candidates.length !== 1 ? 's' : ''} — which did you mean?
                </p>
                <button type="button" onClick={handleCancel}
                  className="text-xs text-gray-400 hover:text-gray-600">
                  cancel
                </button>
              </div>
              <div className="space-y-1.5">
                {candidates.map(c => (
                  <CandidateCard key={c.qid} candidate={c} onSelect={handleCandidateSelect} />
                ))}
              </div>
            </div>
          )}

          {/* ── No results message ── */}
          {panelState === STATE.DISAMBIGUATING && candidates.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400">
              No results found for "{searchText}"
              <button type="button" onClick={handleCancel}
                className="block mx-auto mt-2 text-xs text-violet-500 hover:text-violet-700">
                try again
              </button>
            </div>
          )}

          {/* ── SPARQL preview ── */}
          <div className="border-t pt-2">
            <button type="button" onClick={() => setShowSparql(v => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              {showSparql ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showSparql ? "Hide" : "Preview"} SPARQL
            </button>
            {showSparql && (
              <pre className="mt-2 text-[10px] bg-gray-50 rounded p-2 overflow-x-auto text-gray-600 leading-relaxed">
                {buildSparqlPreview(resolvedQid || "Q?")}
                {!resolvedQid && (
                  <span className="block mt-1 text-gray-400 italic">
                    Q-id resolved when you pick an entity above
                  </span>
                )}
              </pre>
            )}
          </div>

        </CardContent>
      </Card>
    </motion.div>
  );
}
