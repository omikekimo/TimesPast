import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Calendar, Grab, X } from "lucide-react";
import { motion } from "framer-motion";
import { resolveTextToEntities } from "@/lib/wikidataUtils";

const STATE = {
  IDLE:           'idle',
  DISAMBIGUATING: 'disambiguating',
  SEARCHING:      'searching',
};

export default function EventSearchPanel({
  onSearch,
  isSearching,
  onClose,
}) {
  const [query, setQuery]           = useState("");
  const [panelState, setPanelState] = useState(STATE.IDLE);
  const [candidates, setCandidates] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setPanelState(STATE.DISAMBIGUATING);
    setCandidates([]);
    const found = await resolveTextToEntities(query.trim(), { limit: 30 });
    setCandidates(found);
    if (found.length === 1) {
      await handleCandidateSelect(found[0]);
    }
  };

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
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="w-80 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:border-gray-700">
        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Search Events</h3>
            </div>
            <div className="flex items-center gap-2">
              <Grab className="w-4 h-4 text-gray-400" />
              {onClose && (
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">

          {/* Info box */}
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
            <p className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Search</strong> finds events, battles and movements and plots them on the map.
            </p>
          </div>

          {/* Search form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
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
              className="w-full items-center justify-center gap-1.5 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              {panelState === STATE.SEARCHING ? (
                <><Loader2 className="w-3 h-3 mr-2 animate-spin" />Searching Wikidata…</>
              ) : panelState === STATE.DISAMBIGUATING ? (
                <><Search className="w-3 h-3 mr-2" />Search again</>
              ) : (
                <><Search className="w-3 h-3 mr-2" />Search Events</>
              )}
            </Button>
          </form>

          {/* Disambiguation list */}
          {panelState === STATE.DISAMBIGUATING && candidates.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {candidates.length} results — which did you mean?
              </p>
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                {candidates.map(c => (
                  <button
                    key={c.qid}
                    onClick={() => handleCandidateSelect(c)}
                    className="w-full text-left flex items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{c.label}</p>
                      {c.description && (
                        <p className="text-[10px] text-gray-400 truncate">{c.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={handleCancel} className="w-full text-gray-500">
                ← Back
              </Button>
            </div>
          )}

          {/* No results */}
          {panelState === STATE.DISAMBIGUATING && candidates.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400">
              No results found for "{query}"
              <button type="button" onClick={handleCancel}
                className="block mx-auto mt-2 text-xs text-blue-500 hover:text-blue-700">
                try again
              </button>
            </div>
          )}

        </CardContent>
      </Card>
    </motion.div>
  );
}
