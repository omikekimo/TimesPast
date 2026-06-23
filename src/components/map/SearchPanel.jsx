import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, Loader2, Calendar, Grab } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { resolveTextToEntities } from "@/lib/wikidataUtils";
import DisambiguationList from "@/components/ui/DisambiguationList";

// ── Panel states ──────────────────────────────────────────────────────────────
const STATE = {
  IDLE:           'idle',
  DISAMBIGUATING: 'disambiguating',
  SEARCHING:      'searching',
};

const categories = [
  { id: "war",              label: "War & Conflict",    color: "bg-red-100 text-red-800" },
  { id: "politics",         label: "Politics",          color: "bg-purple-100 text-purple-800" },
  { id: "culture",          label: "Culture",           color: "bg-green-100 text-green-800" },
  { id: "science",          label: "Science",           color: "bg-blue-100 text-blue-800" },
  { id: "natural_disaster", label: "Natural Disasters", color: "bg-orange-100 text-orange-800" },
  { id: "economics",        label: "Economics",         color: "bg-yellow-100 text-yellow-800" },
  { id: "religion",         label: "Religion",          color: "bg-indigo-100 text-indigo-800" },
  { id: "exploration",      label: "Exploration",       color: "bg-cyan-100 text-cyan-800" },
];

export default function EventSearchPanel({
  onSearch,
  isSearching,
  selectedCategories,
  onCategoryChange,
}) {
  const [query, setQuery]             = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [panelState, setPanelState]   = useState(STATE.IDLE);
  const [candidates, setCandidates]   = useState([]);

  const toggleCategory = (id) => {
    onCategoryChange(
      selectedCategories.includes(id)
        ? selectedCategories.filter(c => c !== id)
        : [...selectedCategories, id]
    );
  };

  // Step 1 — resolve text to candidates
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setPanelState(STATE.DISAMBIGUATING);
    setCandidates([]);

    const found = await resolveTextToEntities(query.trim(), { limit: 5 });
    setCandidates(found);

    // If exactly one result skip disambiguation
    if (found.length === 1) {
      await handleCandidateSelect(found[0]);
    }
  };

  // Step 2 — user picks candidate, fire search
  const handleCandidateSelect = async (candidate) => {
    setPanelState(STATE.SEARCHING);
    await onSearch(candidate.qid, candidate.label);
    setPanelState(STATE.IDLE);
    setCandidates([]);
  };

  const handleCancel = () => {
    setPanelState(STATE.IDLE);
    setCandidates([]);
  };

  return (
    <motion.div>
      <Card className="w-96 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:border-gray-700">
        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Search Events</h3>
            </div>
            <div className="flex items-center">
              <Button variant="ghost" size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <Filter className="w-4 h-4" />
              </Button>
              <Grab className="w-4 h-4 text-gray-400 ml-2" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* ── Search form ── */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-md text-sm
                  focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search events, battles, movements…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={panelState === STATE.SEARCHING || !query.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {panelState === STATE.SEARCHING ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching Wikidata…</>
              ) : panelState === STATE.DISAMBIGUATING ? (
                <><Search className="w-4 h-4 mr-2" />Search again</>
              ) : (
                <><Search className="w-4 h-4 mr-2" />Search Events</>
              )}
            </Button>
          </form>

          {/* ── Disambiguation ── */}
          {panelState === STATE.DISAMBIGUATING && candidates.length > 1 && (
            <DisambiguationList
              candidates={candidates}
              onSelect={handleCandidateSelect}
              onCancel={handleCancel}
            />
          )}

          {/* ── No results ── */}
          {panelState === STATE.DISAMBIGUATING && candidates.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400">
              No results found for "{query}"
              <button type="button" onClick={handleCancel}
                className="block mx-auto mt-2 text-xs text-blue-500 hover:text-blue-700">
                try again
              </button>
            </div>
          )}

          {/* ── Category filters (for filtering existing map events) ── */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-medium text-gray-700">
                    Filter visible events by category
                  </span>
                  {selectedCategories.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => onCategoryChange([])}
                      className="text-xs text-gray-500 hover:text-gray-700">
                      <X className="w-3 h-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <Badge
                      key={cat.id}
                      variant={selectedCategories.includes(cat.id) ? "default" : "outline"}
                      className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                        selectedCategories.includes(cat.id) ? cat.color : "hover:bg-gray-100"
                      }`}
                      onClick={() => toggleCategory(cat.id)}
                    >
                      {cat.label}
                    </Badge>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400">
                  Category filters apply to all events already on the map.
                  Use the search above to find and add new events from Wikidata.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

        </CardContent>
      </Card>
    </motion.div>
  );
}
