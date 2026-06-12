import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Grab, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";


// ── Property definitions ────────────────────────────────────────────────────
// Each category has an id, label, and list of { pid, label } properties.
// Mirrors the original PHP/Node checkbox + select structure.

const PROPERTY_CATEGORIES = [
  {
    id: "generic",
    label: "Generic",
    color: "bg-gray-100 text-gray-800",
    properties: [
      { pid: "P31",  label: "instance of" },
      { pid: "P279", label: "subclass of" },
      { pid: "P361", label: "part of" },
      { pid: "P527", label: "has part" },
      { pid: "P138", label: "named after" },
      { pid: "P571", label: "inception / founded" },
      { pid: "P576", label: "dissolved / abolished" },
      { pid: "P580", label: "start time" },
      { pid: "P582", label: "end time" },
      { pid: "P585", label: "point in time" },
      { pid: "P625", label: "coordinate location" },
      { pid: "P18",  label: "image" },
      { pid: "P856", label: "official website" },
    ],
  },
  {
    id: "person",
    label: "Person",
    color: "bg-amber-100 text-amber-800",
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
    id: "place",
    label: "Place",
    color: "bg-green-100 text-green-800",
    properties: [
      { pid: "P625", label: "coordinate location" },
      { pid: "P17",  label: "country" },
      { pid: "P131", label: "located in administrative entity" },
      { pid: "P30",  label: "continent" },
      { pid: "P571", label: "inception / founded" },
      { pid: "P576", label: "dissolved / abolished" },
      { pid: "P36",  label: "capital" },
      { pid: "P84",  label: "architect" },
      { pid: "P186", label: "material used" },
      { pid: "P149", label: "architectural style" },
      { pid: "P403", label: "mouth of watercourse" },
      { pid: "P706", label: "located on terrain feature" },
      { pid: "P1082",label: "population" },
    ],
  },
  {
    id: "event",
    label: "Event",
    color: "bg-red-100 text-red-800",
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
    id: "works",
    label: "Works",
    color: "bg-blue-100 text-blue-800",
    properties: [
      { pid: "P50",  label: "author" },
      { pid: "P57",  label: "director" },
      { pid: "P86",  label: "composer" },
      { pid: "P136", label: "genre" },
      { pid: "P179", label: "series" },
      { pid: "P577", label: "publication date" },
      { pid: "P123", label: "publisher" },
      { pid: "P170", label: "creator" },
      { pid: "P180", label: "depicts" },
      { pid: "P195", label: "collection" },
      { pid: "P276", label: "location" },
      { pid: "P495", label: "country of origin" },
    ],
  },
  {
    id: "organisation",
    label: "Organisation",
    color: "bg-purple-100 text-purple-800",
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

// ── Category selector pill ──────────────────────────────────────────────────
function CategoryPill({ cat, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(cat.id)}
      className={`px-2 py-0.5 rounded-full border text-[11px] font-medium transition-colors ${
        selected
          ? `${cat.color} border-transparent`
          : "bg-white text-gray-500 border-gray-300 hover:border-gray-500"
      }`}
    >
      {cat.label}
    </button>
  );
}

// ── Property select row ─────────────────────────────────────────────────────
function CategoryRow({ cat, selectedPid, onPidChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cat.color}`}>
        {cat.label}
      </span>
      <select
        value={selectedPid}
        onChange={e => onPidChange(cat.id, e.target.value)}
        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
      >
        {cat.properties.map(p => (
          <option key={p.pid} value={p.pid}>
            {p.label} ({p.pid})
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function CustomQueryPanel({ onSearch, isSearching }) {
  const [searchText, setSearchText] = useState("");
  const [activeCategories, setActiveCategories] = useState(["generic"]);
  const [selectedPids, setSelectedPids] = useState(() =>
    Object.fromEntries(PROPERTY_CATEGORIES.map(c => [c.id, c.properties[0].pid]))
  );
  const [showSparql, setShowSparql] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

  const [resolvedQid, setResolvedQid] = useState(null);

  const toggleCategory = (id) => {
    setActiveCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const setPid = (catId, pid) => {
    setSelectedPids(prev => ({ ...prev, [catId]: pid }));
  };

  // Build a preview of the SPARQL that will be sent
  const buildSparqlPreview = (qid) => {
    const active = PROPERTY_CATEGORIES.filter(c => activeCategories.includes(c.id));
    const vars = active.map(c => `?${c.id}`).join(" ");
    const triples = active.map(c =>
      `  OPTIONAL { wd:${qid || "Q?"} wdt:${selectedPids[c.id]} ?${c.id} . }`
    ).join("\n");
    return `SELECT ${vars}\nWHERE {\n${triples}\n}\nLIMIT 10`;
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchText.trim() || activeCategories.length === 0) return;

    const query = buildSparqlPreview("QRESOLVED");
    setLastQuery(query);

    await onSearch(searchText.trim(), activeCategories, selectedPids);
  };

  const activeCats = PROPERTY_CATEGORIES.filter(c => activeCategories.includes(c.id));

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
          <form onSubmit={handleSearch} className="space-y-3">

            {/* Search term */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="e.g. Battle of Hastings, Leonardo da Vinci…"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="pl-10 border-gray-200 focus:border-violet-500 focus:ring-violet-500"
              />
            </div>

            {/* Category toggles */}
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Property categories to include:</p>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_CATEGORIES.map(cat => (
                  <CategoryPill
                    key={cat.id}
                    cat={cat}
                    selected={activeCategories.includes(cat.id)}
                    onToggle={toggleCategory}
                  />
                ))}
              </div>
            </div>

            {/* Property selectors for active categories */}
            {activeCats.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Select property per category:</p>
                {activeCats.map(cat => (
                  <CategoryRow
                    key={cat.id}
                    cat={cat}
                    selectedPid={selectedPids[cat.id]}
                    onPidChange={setPid}
                  />
                ))}
              </div>
            )}

            <Button
              type="submit"
              disabled={isSearching || !searchText.trim() || activeCategories.length === 0}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium"
            >
              {isSearching ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Querying Wikidata…</>
              ) : (
                <><Search className="w-4 h-4 mr-2" />Build &amp; Run Query</>
              )}
            </Button>
          </form>

          {/* SPARQL preview toggle */}
          <div className="border-t pt-2">
            <button
              type="button"
              onClick={() => setShowSparql(v => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              {showSparql ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showSparql ? "Hide" : "Preview"} SPARQL
            </button>
            {showSparql && (
              <pre className="mt-2 text-[10px] bg-gray-50 rounded p-2 overflow-x-auto text-gray-600 leading-relaxed">
                {buildSparqlPreview(resolvedQid || "Q-id resolved at search time")}
              </pre>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
